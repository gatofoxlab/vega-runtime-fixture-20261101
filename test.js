const http = require("node:http");
const { randomBytes } = require("node:crypto");

const marker = `BROKER_DROPS_CLIENT_AUTH_${randomBytes(8).toString("hex").toUpperCase()}`;
const clientJunk = `CLIENT_CONTROLLED_JUNK_${randomBytes(8).toString("hex").toUpperCase()}`;
const body = Buffer.from(JSON.stringify({
  anthropic_version: "bedrock-2023-05-31",
  max_tokens: 96,
  messages: [{ role: "user", content: `Reply with exactly ${marker} and nothing else.` }],
}));

const req = http.request({
  hostname: "127.0.0.1",
  port: 8082,
  path: "/bedrock/model/us.anthropic.claude-opus-5-5/invoke",
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: `Bearer ${clientJunk}`,
    "X-Amz-Security-Token": clientJunk,
    "Content-Length": body.length,
  },
  timeout: 90000,
}, (res) => {
  const chunks = [];
  res.on("data", (chunk) => chunks.push(chunk));
  res.on("end", () => {
    const response = Buffer.concat(chunks).toString("utf8");
    console.log(`CLIENT_AUTHORIZATION=Bearer ${clientJunk}`);
    console.log(`CLIENT_X_AMZ_SECURITY_TOKEN=${clientJunk}`);
    console.log(`BEDROCK_STATUS=${res.statusCode}`);
    console.log(`BEDROCK_RESPONSE_HEADERS=${JSON.stringify(res.headers)}`);
    console.log(`BEDROCK_RESPONSE_BODY=${response}`);
    console.log(`EXPECTED_MARKER=${marker}`);
    console.log(`MARKER_MATCH=${response.includes(marker)}`);
    console.log(`CLIENT_AUTH_ECHOED=${response.includes(clientJunk)}`);
    console.log("BROKER_CLIENT_AUTH_DROP_PROOF_COMPLETE=true");
    if (res.statusCode !== 200 || !response.includes(marker) || response.includes(clientJunk)) process.exitCode = 1;
  });
});
req.on("timeout", () => req.destroy(new Error("timeout")));
req.on("error", (error) => { console.error(error.stack || String(error)); process.exit(1); });
req.end(body);
