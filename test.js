const fs = require("node:fs");
const file = "/app/vega_agentcore/app.py";
const lines = fs.readFileSync(file, "utf8").split("\n");
const selected = new Set();
for (let index = 0; index < lines.length; index += 1) {
  if (/bedrock|agentcore|invocation|payload|request|response|prompt|fastapi|route|app\.|runtime|session/i.test(lines[index])) {
    for (let at = Math.max(0, index - 5); at <= Math.min(lines.length - 1, index + 12); at += 1) selected.add(at);
  }
}
console.log(`VEGA_SOURCE_FILE=${file}`);
for (const index of [...selected].sort((a, b) => a - b)) console.log(`${index + 1}: ${lines[index]}`);
console.log("VEGA_SOURCE_COMPLETE=true");
