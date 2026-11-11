#!/usr/bin/env node
// System Atlas CLI. Run from anywhere inside a project that has atlas.config.mjs.
//   serve                      UI + runner on http://127.0.0.1:<port> (default command)
//   check                      validate the data in <dataDir>
//   verify [module[/flow]]     headless run of every runnable tour, no waiting — does it still pass? (nothing is saved)
//   export [file]              one self-contained HTML (data only) to share; no runner
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { check, findRoot, isRunnable, loadConfig, loadData } from "./lib/data.mjs";
import { TourRun } from "./lib/runner.mjs";
import { serve } from "./lib/server.mjs";
import { stopStack } from "./lib/stack.mjs";

const [cmd = "serve", arg] = process.argv.slice(2);
const root = findRoot();
process.chdir(root); // config.session() and relative paths resolve from the project root
const config = await loadConfig(root);

function validate() {
  const problems = check(loadData(root, config), root);
  for (const p of problems) console.log(`  ✗ ${p}`);
  return problems.length;
}

if (cmd === "serve") {
  const n = validate();
  if (n) console.log(`${n} problem(s) in ${config.dataDir} — the UI still opens; fix them with \`node tools/atlas/cli.mjs check\``);
  serve({ root, config });
  // servers Atlas started for the app under test (config.stack) stop with it
  for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => { stopStack(); process.exit(0); });
  process.on("exit", stopStack);
} else if (cmd === "check") {
  const n = validate();
  console.log(n ? `${n} problem(s)` : "atlas data OK");
  process.exit(n ? 1 : 0);
} else if (cmd === "verify") {
  const data = loadData(root, config);
  const [onlyModule, onlyFlow] = (arg ?? "").split("/");
  let failed = 0;
  for (const m of data.modules) {
    if (onlyModule && m.key !== onlyModule) continue;
    for (const f of m.flows) {
      if (onlyFlow && f.id !== onlyFlow) continue;
      if (!isRunnable(m, f)) { if (onlyFlow) console.log(`${m.key}/${f.id}: not runnable (needs a tour and every stage accepted)`); continue; }
      process.stdout.write(`${m.key}/${f.id} … `);
      const s = await new TourRun({ root, config, project: data.project, module: m, flow: f, mode: "verify" }).start();
      console.log(s.state === "done" ? s.message : `${s.state} at step ${s.step + 1}: ${s.message}`);
      if (s.state !== "done") failed++;
    }
  }
  stopStack();
  process.exit(failed ? 1 : 0);
} else if (cmd === "export") {
  const data = { ...loadData(root, config), runner: false };
  const ui = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "ui", "index.html"), "utf8");
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  const out = path.resolve(arg ?? path.join(config.dataDir, "dist", "atlas.html"));
  mkdirSync(path.dirname(out), { recursive: true });
  writeFileSync(out, ui.replace("<!--ATLAS_DATA-->", `<script>window.__ATLAS__=${json}</script>`));
  console.log(`exported → ${path.relative(root, out)}`);
} else {
  console.log("usage: node tools/atlas/cli.mjs [serve | check | verify [module[/flow]] | export [file]]");
  process.exit(2);
}
