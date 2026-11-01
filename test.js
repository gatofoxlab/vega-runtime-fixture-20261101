const http = require("node:http");

const endpoint = process.env.AWS_EC2_METADATA_SERVICE_ENDPOINT;
if (!endpoint) throw new Error("AWS_EC2_METADATA_SERVICE_ENDPOINT absent");

function req(method, requestPath, headers = {}) {
  return new Promise((resolve) => {
    const url = new URL(requestPath, endpoint.endsWith("/") ? endpoint : `${endpoint}/`);
    const request = http.request(url, { method, headers, timeout: 8000 }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => resolve({
        method,
        path: requestPath,
        headers,
        status: response.statusCode,
        responseHeaders: response.headers,
        body: Buffer.concat(chunks).toString("utf8"),
      }));
    });
    request.on("timeout", () => request.destroy(new Error("timeout")));
    request.on("error", (error) => resolve({ method, path: requestPath, headers, error: error.message }));
    request.end();
  });
}

async function main() {
  const tokenResponse = await req("PUT", "/latest/api/token", {
    "X-aws-ec2-metadata-token-ttl-seconds": "21600",
  });
  const token = tokenResponse.body.trim();
  const imds = { "X-aws-ec2-metadata-token": token };
  const paths = [
    "/latest/meta-data/identity-credentials/",
    "/latest/meta-data/identity-credentials/ec2/",
    "/latest/meta-data/identity-credentials/ec2/security-credentials/",
    "/latest/meta-data/identity-credentials/ec2/security-credentials/ec2-instance",
    "/latest/meta-data/services/",
    "/latest/meta-data/services/domain",
    "/latest/meta-data/services/partition",
    "/latest/meta-data/profile",
    "/latest/meta-data/iam/security-credentials/",
    "/latest/user-data",
  ];
  const results = [];
  for (const requestPath of paths) results.push(await req("GET", requestPath, imds));
  for (const authorization of [token, `Bearer ${token}`]) {
    results.push(await req("GET", "/credentials", { Authorization: authorization }));
  }
  results.push(await req("GET", "/credentials", imds));
  results.push(await req("GET", "/credentials", { ...imds, Authorization: token }));
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([name]) => /AWS|AGENTCORE|AUTH|CREDENTIAL|TOKEN/i.test(name)),
  );
  console.log(`METADATA_ENDPOINT=${endpoint}`);
  console.log(`METADATA_TOKEN=${token}`);
  console.log(`IDENTITY_ENV=${JSON.stringify(env)}`);
  console.log(`IDENTITY_RESULTS=${JSON.stringify(results)}`);
  console.log("IDENTITY_METADATA_PROBE_COMPLETE=true");
}

main().catch((error) => {
  console.error(error.stack || String(error));
  process.exit(1);
});
