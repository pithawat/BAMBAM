// Local Atlas server: serves the UI and data, saves notes, and starts tour runs.
// Binds to 127.0.0.1 only; write routes refuse requests from other origins.
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isRunnable, loadData, saveNotes } from "./data.mjs";
import { TourRun } from "./runner.mjs";

const UI_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "ui");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml" };

function send(res, code, body, type = "application/json") {
  res.writeHead(code, { "content-type": type, "cache-control": "no-store" });
  res.end(type === "application/json" ? JSON.stringify(body) : body);
}

function sendFile(res, base, rel) {
  const file = path.resolve(base, rel);
  if (!file.startsWith(path.resolve(base) + path.sep) || !existsSync(file) || !statSync(file).isFile()) return send(res, 404, { error: "not found" });
  res.writeHead(200, { "content-type": TYPES[path.extname(file)] ?? "application/octet-stream", "cache-control": "no-store" });
  createReadStream(file).pipe(res);
}

async function body(req) {
  let raw = "";
  for await (const chunk of req) { raw += chunk; if (raw.length > 2_000_000) throw new Error("body too large"); }
  return raw ? JSON.parse(raw) : {};
}

export function serve({ root, config }) {
  const port = config.port;
  const origins = new Set([`http://127.0.0.1:${port}`, `http://localhost:${port}`]);
  let run = null;
  let status = { state: "idle" };
  // embed mode: latest screencast frame + status pushed to every open /api/run/stream (server-sent events)
  const clients = new Set();
  let frame = null, frameTimer = null;
  const emit = (event, data) => { for (const res of clients) res.write(`event: ${event}\ndata: ${data}\n\n`); };
  let runId = 0; // every status carries the id of its run, so a page can ignore an older run's events
  const onUpdate = (s) => { status = { ...s, id: runId }; emit("status", JSON.stringify(status)); };
  const onFrame = (data) => {
    frame = data;
    if (!frameTimer) frameTimer = setTimeout(() => { frameTimer = null; emit("frame", frame); }, 33); // ≤ 30 fps, newest frame wins
  };
  setInterval(() => { for (const res of clients) res.write(": keep-alive\n\n"); }, 20_000).unref();

  function startRun({ module, flow, from = 0, mode = "live" }) {
    if (run) return [409, { error: "มีการรันอยู่แล้ว หยุดรอบเดิมก่อน" }];
    const data = loadData(root, config);
    const m = data.modules.find((x) => x.key === module);
    const f = m?.flows.find((x) => x.id === flow);
    if (!f) return [404, { error: `ไม่พบ flow ${module}/${flow}` }];
    if (!isRunnable(m, f)) return [403, { error: "flow นี้ยังรันไม่ได้: ต้องตรวจรับครบทุก stage และมี tour" }];
    frame = null;
    runId++;
    run = new TourRun({ root, config, project: data.project, module: m, flow: f, from: Number(from) || 0, mode, onUpdate, onFrame });
    onUpdate({ ...run.status, mode });
    run.start()
      .catch((e) => { onUpdate({ ...status, state: "error", message: String(e?.message ?? e).split("\n")[0] }); })
      .finally(() => { run = null; emit("status", JSON.stringify(status)); });
    return [202, status];
  }

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      if (req.method !== "GET" && req.headers.origin && !origins.has(req.headers.origin)) return send(res, 403, { error: "origin not allowed" });

      if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
        return send(res, 200, readFileSync(path.join(UI_DIR, "index.html"), "utf8"), TYPES[".html"]);
      }
      if (req.method === "GET" && url.pathname === "/api/data") return send(res, 200, { ...loadData(root, config), runner: true, run: status });
      if (req.method === "GET" && url.pathname === "/api/run") return send(res, 200, status);
      if (req.method === "POST" && url.pathname === "/api/run") {
        const b = await body(req);
        const [c, r] = startRun({ ...b, mode: b.mode === "embed" ? "embed" : "live" });
        return send(res, c, r);
      }
      if (req.method === "GET" && url.pathname === "/api/run/stream") {
        res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-store", connection: "keep-alive" });
        res.write(`event: status\ndata: ${JSON.stringify(status)}\n\n`);
        if (run && frame) res.write(`event: frame\ndata: ${frame}\n\n`);
        clients.add(res);
        req.on("close", () => {
          clients.delete(res);
          // an embedded run has nobody to press Space once its page is gone
          if (!clients.size && run?.mode === "embed") run.stop();
        });
        return;
      }
      if (req.method === "POST" && url.pathname === "/api/run/next") { run?.next(); return send(res, 200, status); }
      if (req.method === "POST" && url.pathname === "/api/run/stop") { run?.stop(); return send(res, 200, status); }
      if (req.method === "PUT" && url.pathname === "/api/notes") { saveNotes(root, config, await body(req)); return send(res, 200, { ok: true }); }
      if (req.method === "GET" && url.pathname.startsWith("/ui/")) return sendFile(res, UI_DIR, decodeURIComponent(url.pathname.slice(4)));
      return send(res, 404, { error: "not found" });
    } catch (e) {
      return send(res, 500, { error: String(e?.message ?? e) });
    }
  });
  server.listen(port, "127.0.0.1", () => {
    console.log(`System Atlas → http://127.0.0.1:${port}`);
    console.log(`App under test → ${config.baseURL}  (Ctrl+C to stop)`);
  });
  return server;
}
