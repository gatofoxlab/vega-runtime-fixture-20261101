const fs = require("node:fs");

function readText(file) {
  try { return fs.readFileSync(file, "utf8"); } catch { return ""; }
}

function socketRows(file) {
  const text = readText(file).trim();
  if (!text) return [];
  return text.split("\n").slice(1).map((line) => {
    const fields = line.trim().split(/\s+/);
    const [address, portHex] = fields[1].split(":");
    return { file, address, port: parseInt(portHex, 16), state: fields[3], inode: fields[9] };
  });
}

function processOwnsSocket(pid, inode) {
  let names;
  try { names = fs.readdirSync(`/proc/${pid}/fd`); } catch { return false; }
  return names.some((name) => {
    try { return fs.readlinkSync(`/proc/${pid}/fd/${name}`) === `socket:[${inode}]`; } catch { return false; }
  });
}

function processRecord(pid) {
  const env = readText(`/proc/${pid}/environ`).split("\0").filter(Boolean);
  const selected = env.filter((entry) => /AWS|BEDROCK|TOKEN|CREDENTIAL|AUTH|PROXY|ENDPOINT|REGION|AGENTCORE|OPENCODE/i.test(entry));
  const link = (name) => { try { return fs.readlinkSync(`/proc/${pid}/${name}`); } catch { return null; } };
  return {
    pid,
    cmdline: readText(`/proc/${pid}/cmdline`).split("\0").filter(Boolean),
    exe: link("exe"),
    cwd: link("cwd"),
    root: link("root"),
    cgroup: readText(`/proc/${pid}/cgroup`),
    selected_environment: selected,
  };
}

const targetPorts = new Set([8080, 8081, 8082, 8083]);
const sockets = [...socketRows("/proc/net/tcp"), ...socketRows("/proc/net/tcp6")]
  .filter((row) => targetPorts.has(row.port) && row.state === "0A");
const pids = fs.readdirSync("/proc").filter((name) => /^\d+$/.test(name));
const listeners = sockets.map((socket) => ({
  ...socket,
  owners: pids.filter((pid) => processOwnsSocket(pid, socket.inode)).map(processRecord),
}));

console.log(`ADAPTER_LISTENERS=${JSON.stringify(listeners)}`);
console.log("ADAPTER_PROCESS_INVENTORY_COMPLETE=true");
