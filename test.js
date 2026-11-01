const http = require("node:http");

function request(method, requestPath, body = null, headers = {}) {
  return new Promise((resolve) => {
    const data = body === null ? null : Buffer.from(JSON.stringify(body));
    const req = http.request({
      hostname: "127.0.0.1",
      port: 8082,
      path: requestPath,
      method,
      headers: {
        Accept: "application/json",
        ...(data ? { "Content-Type": "application/json", "Content-Length": data.length } : {}),
        ...headers,
      },
      timeout: 30000,
    }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve({
        method,
        path: requestPath,
        status: res.statusCode,
        headers: res.headers,
        body: Buffer.concat(chunks).toString("utf8"),
      }));
    });
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", (error) => resolve({ method, path: requestPath, error: error.message }));
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  const results = [];
  for (const path of [
    "/bedrock/foundation-models",
    "/bedrock/inference-profiles",
    "/bedrock/model/anthropic.claude-3-haiku-20240307-v1%3A0/invoke",
    "/bedrock/model/us.amazon.nova-premier-v1%3A0/invoke",
    "/bedrock/model/us.anthropic.claude-does-not-exist/invoke",
  ]) {
    if (path.endsWith("/invoke")) {
      results.push(await request("POST", path, {
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 8,
        messages: [{ role: "user", content: [{ type: "text", text: "Return exactly X" }] }],
      }));
    } else {
      results.push(await request("GET", path));
    }
  }
  console.log(`BEDROCK_PROXY_IDENTITY_RESULTS=${JSON.stringify(results)}`);
  console.log("BEDROCK_PROXY_IDENTITY_PROBE_COMPLETE=true");
}

main().catch((error) => {
  console.error(error.stack || String(error));
  process.exit(1);
});
