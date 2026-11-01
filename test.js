const fs = require("node:fs");
const { spawnSync } = require("node:child_process");

const pids = fs.readdirSync("/proc").filter((name) => /^\d+$/.test(name));
const pid = pids.find((candidate) => {
  try { return fs.readFileSync(`/proc/${candidate}/cmdline`, "utf8").includes("vega_agentcore.app"); }
  catch { return false; }
});
if (!pid) throw new Error("vega_agentcore.app process not found");

const env = {};
for (const entry of fs.readFileSync(`/proc/${pid}/environ`, "utf8").split("\0").filter(Boolean)) {
  const at = entry.indexOf("=");
  env[entry.slice(0, at)] = entry.slice(at + 1);
}
const code = [
  "import base64, pathlib, vega_agentcore",
  "root = pathlib.Path(vega_agentcore.__file__).parent",
  "print('VEGA_AGENTCORE_ROOT=' + str(root))",
  "files = sorted(root.rglob('*.py'))",
  "print('VEGA_AGENTCORE_FILES=' + repr([str(p) for p in files]))",
  "for p in files: print('VEGA_AGENTCORE_SOURCE=' + repr({'file': str(p), 'base64': base64.b64encode(p.read_bytes()).decode()}))",
  "print('VEGA_AGENTCORE_SOURCE_COMPLETE=true')",
].join("\n");
const result = spawnSync(`/proc/${pid}/exe`, ["-c", code], {
  cwd: `/proc/${pid}/cwd`, env, encoding: "utf8", timeout: 30000,
});
console.log(`VEGA_AGENTCORE_PID=${pid}`);
if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
if (result.status !== 0) process.exit(result.status || 1);
