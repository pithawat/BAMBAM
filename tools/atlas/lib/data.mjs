// Loads the project config and the atlas data (docs/atlas by default) and checks it.
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const CONFIG_FILE = "atlas.config.mjs";

/** Walks up from `start` to the folder that holds atlas.config.mjs. */
export function findRoot(start = process.cwd()) {
  let dir = path.resolve(start);
  for (;;) {
    if (existsSync(path.join(dir, CONFIG_FILE))) return dir;
    const up = path.dirname(dir);
    if (up === dir) throw new Error(`${CONFIG_FILE} not found in ${start} or any parent folder`);
    dir = up;
  }
}

export async function loadConfig(root) {
  const mod = await import(pathToFileURL(path.join(root, CONFIG_FILE)).href);
  const config = { dataDir: "docs/atlas", port: 4400, allowHosts: ["localhost", "127.0.0.1"], browser: {}, ...mod.default };
  if (!config.baseURL) throw new Error(`${CONFIG_FILE}: baseURL is required`);
  if (typeof config.session !== "function") throw new Error(`${CONFIG_FILE}: session(role) is required`);
  return config;
}

const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));

export function dataPaths(root, config) {
  const dir = path.join(root, config.dataDir);
  return { dir, project: path.join(dir, "project.json"), modules: path.join(dir, "modules"), notes: path.join(dir, "notes.json") };
}

function gitCommit(root) {
  try { return execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); } catch { return null; }
}

export function loadData(root, config) {
  const p = dataPaths(root, config);
  const project = readJson(p.project);
  const modules = project.modules.map((key) => readJson(path.join(p.modules, `${key}.json`)));
  const notes = existsSync(p.notes) ? readJson(p.notes) : {};
  const updated = Math.max(statSync(p.project).mtimeMs, ...project.modules.map((k) => statSync(path.join(p.modules, `${k}.json`)).mtimeMs));
  return {
    project, modules, notes,
    meta: {
      commit: gitCommit(root), updated: new Date(updated).toISOString(), baseURL: config.baseURL, target: config.target ?? null,
      dataDir: config.dataDir, notesFile: path.relative(root, p.notes).split(path.sep).join("/"),
    },
  };
}

export function saveNotes(root, config, notes) {
  if (!notes || typeof notes !== "object" || Array.isArray(notes)) throw new Error("notes must be an object");
  writeFileSync(dataPaths(root, config).notes, JSON.stringify(notes, null, 2) + "\n");
}

/** Stages a flow belongs to (explicit `stages`, else every stage that lists it), replaced stages left out. */
export function flowStages(m, f) {
  const ids = f.stages ?? m.stages.filter((s) => s.flows.includes(f.id)).map((s) => s.id);
  return ids.map((id) => m.stages.find((s) => s.id === id)).filter((s) => s && s.status !== "replaced");
}

/** A flow may be run on the real app only when every one of its stages is accepted and it has a tour. */
export function isRunnable(m, f) {
  const st = flowStages(m, f);
  return !!f.tour?.steps?.length && st.length > 0 && st.every((s) => s.status === "accepted");
}

const STATUSES = new Set(["accepted", "built", "progress", "pending", "replaced"]);
const NODE_TYPES = new Set(["start", "act", "dec", "end", "link", "note"]);

/** Returns a list of problems ("module/flow: message"). Empty = valid. `root` enables the tour.from file checks. */
export function check(data, root) {
  const out = [];
  const actors = data.project.actors ?? {};
  for (const m of data.modules) {
    const at = (s) => out.push(`${m.key}: ${s}`);
    const flowIds = new Set(m.flows.map((f) => f.id));
    const stageIds = new Set(m.stages.map((s) => s.id));
    for (const s of m.stages) {
      if (!STATUSES.has(s.status)) at(`stage ${s.id}: unknown status "${s.status}"`);
      if (s.status === "accepted" && !s.date) at(`stage ${s.id}: accepted stages need an acceptance date`);
      if (s.status !== "accepted" && s.date) at(`stage ${s.id}: only accepted stages carry a date`);
    }
    for (const c of m.crs ?? []) if (!stageIds.has(c.after)) at(`${c.id}: after unknown stage "${c.after}"`);
    for (const f of m.features) {
      if (!flowIds.has(f.flow)) at(`feature ${f.id}: unknown flow "${f.flow}"`);
      if (!stageIds.has(f.stage)) at(`feature ${f.id}: unknown stage "${f.stage}"`);
      for (const r of f.roles) if (!actors[r]) at(`feature ${f.id}: unknown actor "${r}"`);
    }
    for (const f of m.flows) {
      const fa = (s) => at(`flow ${f.id}: ${s}`);
      const lanes = new Set(f.lanes.map((l) => l.id));
      for (const l of lanes) if (!actors[l]) fa(`lane "${l}" is not in project.actors`);
      const nodes = new Map();
      for (const n of f.nodes) {
        if (nodes.has(n.i)) fa(`duplicate node "${n.i}"`);
        nodes.set(n.i, n);
        if (!lanes.has(n.l)) fa(`node ${n.i}: lane "${n.l}" is not declared`);
        if (!NODE_TYPES.has(n.t)) fa(`node ${n.i}: unknown type "${n.t}"`);
        if (n.t === "link" && !flowIds.has(n.to)) fa(`node ${n.i}: links to unknown flow "${n.to}"`);
        for (const id of n.ln ?? []) if (!flowIds.has(id)) fa(`node ${n.i}: chip to unknown flow "${id}"`);
      }
      for (const e of f.edges) if (!nodes.has(e.f) || !nodes.has(e.t)) fa(`edge ${e.f} → ${e.t}: unknown node`);
      for (const s of f.stages ?? []) if (!stageIds.has(s)) fa(`unknown stage "${s}"`);
      if (f.tour) {
        if (!isRunnable(m, f)) fa("has a tour but is not accepted in every stage (the UI will not offer it)");
        // tours are written only from e2e that passes: name the spec + tests, and the flow's features must be e2e "pass"
        const from = f.tour.from;
        if (!from?.spec) fa("tour.from.spec is required — the passing e2e spec the tour was written from");
        else if (root) {
          const file = path.join(root, from.spec);
          if (!existsSync(file)) fa(`tour.from.spec not found: ${from.spec}`);
          else {
            const src = readFileSync(file, "utf8");
            for (const t of [].concat(from.tests ?? [])) if (!src.includes(t)) fa(`tour.from: test "${t}" not found in ${from.spec}`);
          }
        }
        const notPassing = m.features.filter((x) => x.flow === f.id && x.e2e !== "pass").map((x) => `${x.id} (${x.e2e})`);
        if (notPassing.length) fa(`e2e is not "pass" for ${notPassing.join(", ")} — tours come only from passing e2e`);
        if (!f.tour.steps?.length) fa("tour has no steps");
        f.tour.steps?.forEach((s, i) => {
          if (!nodes.has(s.node)) fa(`tour step ${i + 1}: unknown node "${s.node}"`);
          if (i === 0 && !s.role) fa("tour step 1 needs a role");
          for (const r of [s.role, s.becomes]) if (r && !(data.project.sessionRoles ?? {})[r]) fa(`tour step ${i + 1}: role "${r}" is not in project.sessionRoles`);
        });
      }
    }
  }
  return out;
}
