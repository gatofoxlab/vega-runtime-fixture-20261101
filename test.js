const fs = require("node:fs");
const path = require("node:path");

function walk(root, out = []) {
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const root = "/usr/local/lib/python3.13/site-packages/vega_agentcore";
const files = walk(root).filter((file) => file.endsWith(".py"));
console.log(`VEGA_AGENTCORE_FILES=${JSON.stringify(files)}`);
for (const file of files) {
  const bytes = fs.readFileSync(file);
  console.log(`VEGA_AGENTCORE_SOURCE=${JSON.stringify({ file, base64: bytes.toString("base64") })}`);
}
console.log("VEGA_AGENTCORE_SOURCE_COMPLETE=true");
