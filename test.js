const http = require("node:http");

const paths = [
  "/bedrock", "/bedrock/", "/bedrock/health", "/bedrock/healthz",
  "/bedrock/ready", "/bedrock/readyz", "/bedrock/config_dump",
  "/bedrock/clusters", "/bedrock/stats", "/bedrock/server_info",
  "/bedrock/certs", "/bedrock/runtime", "/bedrock/logging",
  "/bedrock/foundation-models", "/bedrock/models", "/bedrock/model",
  "/bedrock/internal", "/bedrock/internal/agent-token",
  "/bedrock/internal/agent-credentials", "/bedrock/.well-known",
];

function request(path) {
  return new Promise((resolve) => {
    const req = http.request({ hostname: "127.0.0.1", port: 8082, path, method: "GET", timeout: 15000 }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve({ path, status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString("utf8").slice(0, 12000) }));
    });
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", (error) => resolve({ path, error: String(error) }));
    req.end();
  });
}

(async () => {
  for (const path of paths) console.log(`BROKER_PROBE=${JSON.stringify(await request(path))}`);
  console.log("BROKER_ADMIN_PROBE_COMPLETE=true");
})().catch((error) => { console.error(error.stack || String(error)); process.exit(1); });
