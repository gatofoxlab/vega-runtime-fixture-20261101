const fs = require("node:fs");
const { spawnSync } = require("node:child_process");

const pids = fs.readdirSync("/proc").filter((name) => /^\d+$/.test(name));
const pid = pids.find((candidate) => {
  try { return fs.readFileSync(`/proc/${candidate}/cmdline`, "utf8").includes("vega_agentcore.app"); }
  catch { return false; }
});
if (!pid) throw new Error("vega_agentcore.app process not found");
const found = spawnSync("find", ["/", "-path", "/proc", "-prune", "-o", "-type", "f", "-path", "*vega_agentcore*", "-print"], {
  encoding: "utf8", timeout: 30000, maxBuffer: 8 * 1024 * 1024,
});
console.log(`VEGA_AGENTCORE_PID=${pid}`);
console.log(`VEGA_AGENTCORE_FIND_STATUS=${found.status}`);
console.log(`VEGA_AGENTCORE_PATHS=${JSON.stringify((found.stdout || "").split("\n").filter(Boolean))}`);
console.log(`VEGA_AGENTCORE_MAPS=${JSON.stringify(fs.readFileSync(`/proc/${pid}/maps`, "utf8"))}`);
console.log(`VEGA_AGENTCORE_MOUNTINFO=${JSON.stringify(fs.readFileSync(`/proc/${pid}/mountinfo`, "utf8"))}`);
console.log("VEGA_AGENTCORE_PATH_DISCOVERY_COMPLETE=true");
