const http = require("node:http");

const endpoint = process.env.AWS_EC2_METADATA_SERVICE_ENDPOINT;
if (!endpoint) throw new Error("AWS_EC2_METADATA_SERVICE_ENDPOINT is absent");

function request(method, requestPath, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(requestPath, endpoint.endsWith("/") ? endpoint : `${endpoint}/`);
    const req = http.request(url, { method, headers, timeout: 10000 }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve({
        method,
        url: url.toString(),
        status: res.statusCode,
        headers: res.headers,
        body: Buffer.concat(chunks).toString("utf8"),
      }));
    });
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
    req.end();
  });
}

async function main() {
  console.log(`AWS_EC2_METADATA_SERVICE_ENDPOINT=${endpoint}`);
  const tokenResponse = await request("PUT", "/latest/api/token", {
    "X-aws-ec2-metadata-token-ttl-seconds": "21600",
  });
  console.log(`IMDS_TOKEN_RESPONSE=${JSON.stringify(tokenResponse)}`);
  const token = tokenResponse.body.trim();
  const headers = token ? { "X-aws-ec2-metadata-token": token } : {};

  const paths = [
    "/",
    "/latest/meta-data/",
    "/latest/meta-data/iam/",
    "/latest/meta-data/iam/info",
    "/latest/meta-data/iam/security-credentials/",
    "/latest/dynamic/instance-identity/document",
    "/v2/credentials",
    "/credentials",
  ];
  const results = [];
  for (const requestPath of paths) {
    try {
      results.push(await request("GET", requestPath, headers));
    } catch (error) {
      results.push({ method: "GET", path: requestPath, error: error.message });
    }
  }

  const roleResponse = results.find((item) => item.url && item.url.endsWith("/latest/meta-data/iam/security-credentials/"));
  const roles = (roleResponse?.body || "").split(/\s+/).filter(Boolean);
  for (const role of roles) {
    results.push(await request("GET", `/latest/meta-data/iam/security-credentials/${encodeURIComponent(role)}`, headers));
  }
  console.log(`IMDS_RESULTS=${JSON.stringify(results)}`);
  console.log("IMDS_PROBE_COMPLETE=true");
}

main().catch((error) => {
  console.error(error.stack || String(error));
  process.exit(1);
});
