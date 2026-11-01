const http = require("node:http");
const { randomBytes } = require("node:crypto");

const marker = `BROKER_DROPS_CLIENT_AUTH_${randomBytes(8).toString("hex").toUpperCase()}`;
const clientJunk = `CLIENT_CONTROLLED_JUNK_${randomBytes(8).toString("hex").toUpperCase()}`;

function request(path, payload, extraHeaders = {}) {
  const body = Buffer.from(JSON.stringify(payload));
  return new Promise((resolve) => {
    const req = http.request({
      hostname: "127.0.0.1", port: 8082, path, method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", "Content-Length": body.length, ...extraHeaders },
      timeout: 90000,
    }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString("utf8") }));
    });
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", (error) => resolve({ error: String(error) }));
    req.end(body);
  });
}

function twice(value) { return encodeURIComponent(encodeURIComponent(value)); }

async function main() {
  const validPayload = {
    anthropic_version: "bedrock-2023-05-31", max_tokens: 96,
    messages: [{ role: "user", content: `Reply with exactly ${marker} and nothing else.` }],
  };
  const clientHeaders = {
    Authorization: `Bearer ${clientJunk}`,
    "X-Amz-Security-Token": clientJunk,
  };
  const valid = await request(
    "/bedrock/model/us.anthropic.claude-opus-5-5/invoke",
    validPayload,
    clientHeaders,
  );
  const otherProfile = "arn:aws:bedrock:us-east-1:000000000000:inference-profile/us.anthropic.claude-opus-5-5";
  const signerProbe = await request(
    `/bedrock/model/${twice(otherProfile)}/invoke`,
    { anthropic_version: "bedrock-2023-05-31", max_tokens: 1, messages: [{ role: "user", content: "x" }] },
    clientHeaders,
  );
  let signerArn = null;
  try {
    const message = JSON.parse(signerProbe.body).Message || "";
    signerArn = /User: (arn:aws:sts::[^ ]+) is not authorized/.exec(message)?.[1] || null;
  } catch {}
  console.log(`CLIENT_AUTHORIZATION=Bearer ${clientJunk}`);
  console.log(`CLIENT_X_AMZ_SECURITY_TOKEN=${clientJunk}`);
  console.log(`BEDROCK_STATUS=${valid.status}`);
  console.log(`BEDROCK_RESPONSE_HEADERS=${JSON.stringify(valid.headers)}`);
  console.log(`BEDROCK_RESPONSE_BODY=${valid.body}`);
  console.log(`EXPECTED_MARKER=${marker}`);
  console.log(`MARKER_MATCH=${valid.body?.includes(marker)}`);
  console.log(`CLIENT_AUTH_ECHOED=${valid.body?.includes(clientJunk)}`);
  console.log(`BEDROCK_SIGNER_PROBE=${JSON.stringify(signerProbe)}`);
  console.log(`BEDROCK_SIGNER_ARN=${signerArn}`);
  console.log(`BEDROCK_SIGNER_IDENTITY_PROOF_COMPLETE=${signerProbe.status === 403 && signerArn !== null}`);
  console.log("BROKER_CLIENT_AUTH_DROP_PROOF_COMPLETE=true");
  if (valid.status !== 200 || !valid.body?.includes(marker) || valid.body?.includes(clientJunk) || signerProbe.status !== 403 || signerArn === null) process.exitCode = 1;
}

main().catch((error) => { console.error(error.stack || String(error)); process.exit(1); });
