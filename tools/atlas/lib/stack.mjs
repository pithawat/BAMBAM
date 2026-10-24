// Starts the app under test on demand, like Playwright's webServer: config.stack.servers =
// [{ command, cwd, url, env, timeout }]. A server whose url already answers is reused; servers
// started here are stopped (whole process tree) when Atlas exits. Started once per Atlas process.
import { execFileSync, spawn } from "node:child_process";
import path from "node:path";

const started = [];
let ready = null;

async function isUp(url) {
  try { await fetch(url, { signal: AbortSignal.timeout(2000), redirect: "manual" }); return true; } catch { return false; }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const lastLine = (log) => log.trim().split(/\r?\n/).filter(Boolean).slice(-2).join(" · ").slice(0, 300);

export async function ensureStack(root, config, onStatus = () => {}) {
  const servers = config.stack?.servers ?? [];
  if (!servers.length) return;
  ready ??= (async () => {
    for (const s of servers) {
      if (await isUp(s.url)) continue;
      onStatus(`กำลังเปิด ${s.name ?? s.command.split(" && ").pop()} (ครั้งแรกอาจใช้ 1–2 นาที)…`);
      const child = spawn(s.command, {
        cwd: path.resolve(root, s.cwd ?? "."), env: { ...process.env, ...s.env },
        shell: true, windowsHide: true, detached: process.platform !== "win32", stdio: ["ignore", "pipe", "pipe"],
      });
      let log = "";
      const keep = (d) => { log = (log + d).slice(-8000); };
      child.stdout.on("data", keep); child.stderr.on("data", keep);
      started.push(child);
      const t0 = Date.now();
      while (!(await isUp(s.url))) {
        if (child.exitCode !== null) throw new Error(`${s.command} หยุดทำงาน: ${lastLine(log)}`);
        if (Date.now() - t0 > (s.timeout ?? 180_000)) throw new Error(`${s.url} ยังไม่ตอบหลัง ${Math.round((s.timeout ?? 180_000) / 1000)} วินาที: ${lastLine(log)}`);
        await sleep(1000);
      }
    }
  })();
  try { await ready; } catch (e) { ready = null; throw e; }
}

/** Stops only what ensureStack started (servers that were already running are left alone). */
export function stopStack() {
  for (const c of started.splice(0)) {
    if (c.exitCode !== null) continue;
    try {
      if (process.platform === "win32") execFileSync("taskkill", ["/pid", String(c.pid), "/T", "/F"], { stdio: "ignore" });
      else process.kill(-c.pid, "SIGTERM");
    } catch { /* already gone */ }
  }
  ready = null;
}
