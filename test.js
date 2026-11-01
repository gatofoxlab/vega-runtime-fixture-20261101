const fs = require("node:fs");
const { spawnSync } = require("node:child_process");

function read(file) {
  try { return fs.readFileSync(file, "utf8"); } catch (error) { return `ERROR:${error.code || error.message}`; }
}

function link(file) {
  try { return fs.readlinkSync(file); } catch (error) { return `ERROR:${error.code || error.message}`; }
}

function run(command, args = [], timeout = 10000) {
  const result = spawnSync(command, args, { encoding: "utf8", timeout, maxBuffer: 2 * 1024 * 1024 });
  return {
    command: [command, ...args],
    status: result.status,
    signal: result.signal,
    error: result.error ? String(result.error) : null,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
  };
}

function namespaces(pid) {
  const names = ["cgroup", "ipc", "mnt", "net", "pid", "pid_for_children", "time", "time_for_children", "user", "uts"];
  return Object.fromEntries(names.map((name) => [name, link(`/proc/${pid}/ns/${name}`)]));
}

const pids = fs.readdirSync("/proc").filter((name) => /^\d+$/.test(name)).sort((a, b) => Number(a) - Number(b));
const processes = pids.map((pid) => ({
  pid,
  cmdline: read(`/proc/${pid}/cmdline`).split("\0").filter(Boolean),
  status: read(`/proc/${pid}/status`).split("\n").filter((line) => /^(Name|Pid|PPid|TracerPid|Uid|Gid|NSpid|Cap(Inh|Prm|Eff|Bnd|Amb)|NoNewPrivs|Seccomp):/.test(line)),
  cgroup: read(`/proc/${pid}/cgroup`),
  namespaces: namespaces(pid),
}));

const candidatePaths = [
  "/host", "/rootfs", "/proc/1/root", "/proc/1/root/proc", "/run/containerd", "/var/lib/containerd",
  "/run/docker.sock", "/var/run/docker.sock", "/run", "/var/run", "/sys/fs/cgroup",
];
const pathFacts = Object.fromEntries(candidatePaths.map((item) => {
  try {
    const st = fs.lstatSync(item);
    return [item, { exists: true, mode: (st.mode & 0o7777).toString(8), uid: st.uid, gid: st.gid, link: st.isSymbolicLink() ? link(item) : null }];
  } catch (error) {
    return [item, { exists: false, error: error.code || error.message }];
  }
}));

const toolNames = ["id", "capsh", "nsenter", "unshare", "mount", "findmnt", "ip", "ss", "tcpdump", "strace", "gdb", "gcore", "lsof", "busybox"];
const tools = Object.fromEntries(toolNames.map((name) => [name, run("sh", ["-lc", `command -v ${name} || true`]).stdout.trim()]));

const result = {
  node_pid: process.pid,
  node_uid: process.getuid(),
  node_gid: process.getgid(),
  self_status: read("/proc/self/status"),
  self_namespaces: namespaces("self"),
  pid1_namespaces: namespaces("1"),
  processes,
  mountinfo: read("/proc/self/mountinfo"),
  mounts: read("/proc/mounts"),
  cgroup_procs: read("/sys/fs/cgroup/cgroup.procs"),
  cgroup_threads: read("/sys/fs/cgroup/cgroup.threads"),
  ptrace_scope: read("/proc/sys/kernel/yama/ptrace_scope"),
  tcp: read("/proc/net/tcp"),
  tcp6: read("/proc/net/tcp6"),
  unix: read("/proc/net/unix"),
  path_facts: pathFacts,
  tools,
  commands: {
    id: run("id"),
    capsh: tools.capsh ? run("capsh", ["--print"]) : null,
    findmnt: tools.findmnt ? run("findmnt", ["-R", "/"]) : null,
    sockets: tools.ss ? run("ss", ["-lntupae"]) : null,
    unix_sockets: tools.ss ? run("ss", ["-lxap"]) : null,
    proc_tree: run("sh", ["-lc", "ps -efww || true"]),
    nsenter_pid1_all: tools.nsenter ? run("nsenter", ["-t", "1", "-a", "true"]) : null,
    unshare_all: tools.unshare ? run("unshare", ["--mount", "--pid", "--net", "--fork", "true"]) : null,
    mount_proc: run("sh", ["-lc", "d=$(mktemp -d); mount -t proc proc \"$d\"; s=$?; [ $s -eq 0 ] && { head -5 \"$d/1/status\"; umount \"$d\"; }; rmdir \"$d\"; exit $s"]),
    runtime_sockets: run("sh", ["-lc", "find /run /var/run /tmp -xdev -type s -printf '%m %u:%g %p\\n' 2>/dev/null | head -500"]),
  },
};

console.log(`SIDECAR_NAMESPACE_FACTS=${JSON.stringify(result)}`);
console.log("SIDECAR_NAMESPACE_PROBE_COMPLETE=true");
