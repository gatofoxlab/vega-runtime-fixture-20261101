const fs = require("node:fs");
const file = "/app/vega_agentcore/opencode_adapter.py";
const bytes = fs.readFileSync(file);
console.log(`VEGA_SOURCE_FILE=${file}`);
console.log(`VEGA_SOURCE_BASE64=${bytes.toString("base64")}`);
console.log("VEGA_SOURCE_COMPLETE=true");
