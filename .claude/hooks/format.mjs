// PostToolUse hook: format the file Claude just edited.
// .go → gofmt · .ts/.tsx/.css under frontend/ → prettier (if installed in frontend/node_modules)
// Never blocks Claude: any problem exits 0 silently.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

try {
  const input = JSON.parse(readFileSync(0, "utf8"));
  const file = input?.tool_input?.file_path;
  if (file) {
    const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
    const isWin = process.platform === "win32";
    const rel = path.relative(root, file).split(path.sep).join("/");

    if (file.endsWith(".go")) {
      execFileSync("gofmt", ["-w", file], { stdio: "ignore", shell: isWin });
    } else if (/\.(ts|tsx|css)$/.test(file) && rel.startsWith("frontend/")) {
      const bin = path.join(root, "frontend", "node_modules", ".bin", isWin ? "prettier.cmd" : "prettier");
      if (existsSync(bin)) execFileSync(bin, ["--write", file], { stdio: "ignore", shell: isWin });
    }
  }
} catch {
  // ignore — formatting is a convenience, not a gate
}
process.exit(0);
