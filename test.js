const fs = require("node:fs");
const file = "/app/vega_agentcore/callbacks.py";
console.log(`CALLBACKS_SOURCE_BASE64=${fs.readFileSync(file).toString("base64")}`);
console.log("CALLBACKS_SOURCE_COMPLETE=true");
