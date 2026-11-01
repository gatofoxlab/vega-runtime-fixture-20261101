const fs = require("node:fs");
const file = "/app/vega_agentcore/supervisor.py";
console.log(`SUPERVISOR_SOURCE_BASE64=${fs.readFileSync(file).toString("base64")}`);
console.log("SUPERVISOR_SOURCE_COMPLETE=true");
