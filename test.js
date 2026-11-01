const fs = require("node:fs");
const file = "/app/vega_agentcore/broker.py";
const lines = fs.readFileSync(file, "utf8").split("\n");
const selected = new Set();
for (let i = 0; i < lines.length; i += 1) {
  if (/^(async )?def |^class |Route\(|_ROUTE_ENDPOINTS|upstream|endpoint|urlparse|unquote|travers|egress|forwarded\(|Authorization|bearer|client\.stream|httpx/i.test(lines[i].trim())) {
    for (let j = Math.max(0, i - 8); j <= Math.min(lines.length - 1, i + 24); j += 1) selected.add(j);
  }
}
console.log(`VEGA_SOURCE_FILE=${file}`);
for (const i of [...selected].sort((a, b) => a - b)) console.log(`${i + 1}: ${lines[i]}`);
console.log("BROKER_ROUTE_SOURCE_COMPLETE=true");
