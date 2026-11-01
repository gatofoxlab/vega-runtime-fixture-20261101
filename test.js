const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

function parse(file) {
  const text = fs.readFileSync(file, "utf8").trim();
  if (!text) return [];
  return text.split("\n").slice(1).map((line) => {
    const f = line.trim().split(/\s+/);
    return { file, local: f[1], remote: f[2], state: f[3], inode: f[9] };
  });
}

const rows = [...parse("/proc/net/tcp"), ...parse("/proc/net/tcp6")];
console.log(`TCP_ROWS=${JSON.stringify(rows)}`);
try { console.log(`SS_OUTPUT=${JSON.stringify(execFileSync("ss", ["-tanp"], { encoding: "utf8" }))}`); }
catch (error) { console.log(`SS_ERROR=${JSON.stringify(String(error))}`); }
console.log("BROKER_NETWORK_INVENTORY_COMPLETE=true");
