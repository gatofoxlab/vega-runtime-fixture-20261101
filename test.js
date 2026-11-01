const fs = require("node:fs");
const net = require("node:net");
const tls = require("node:tls");

function ipv4(hex) {
  const b = Buffer.from(hex, "hex");
  return `${b[3]}.${b[2]}.${b[1]}.${b[0]}`;
}
function rows() {
  return fs.readFileSync("/proc/net/tcp", "utf8").trim().split("\n").slice(1).map((line) => {
    const f = line.trim().split(/\s+/); const [lh, lp] = f[1].split(":"); const [rh, rp] = f[2].split(":");
    return { local_ip: ipv4(lh), local_port: parseInt(lp,16), remote_ip: ipv4(rh), remote_port: parseInt(rp,16), state:f[3], inode:f[9] };
  });
}
function owners(inode) {
  const out=[];
  for (const pid of fs.readdirSync("/proc").filter(x=>/^\d+$/.test(x))) {
    let fds=[]; try { fds=fs.readdirSync(`/proc/${pid}/fd`); } catch { continue; }
    if (fds.some(fd=>{try{return fs.readlinkSync(`/proc/${pid}/fd/${fd}`)===`socket:[${inode}]`;}catch{return false;}})) {
      let cmd=""; try {cmd=fs.readFileSync(`/proc/${pid}/cmdline`,"utf8").replaceAll("\0"," ");}catch{}
      out.push({pid,cmd});
    }
  }
  return out;
}
function connect(ip,port){return new Promise(resolve=>{const s=net.connect({host:ip,port});const done=v=>{s.destroy();resolve(v);};s.setTimeout(700);s.on("connect",()=>done(true));s.on("timeout",()=>done(false));s.on("error",()=>done(false));});}
function cert(ip,port){return new Promise(resolve=>{const s=tls.connect({host:ip,port,rejectUnauthorized:false});const done=v=>{s.destroy();resolve(v);};s.setTimeout(1500);s.on("secureConnect",()=>{const c=s.getPeerCertificate();done({subject:c.subject,issuer:c.issuer,subjectaltname:c.subjectaltname,fingerprint256:c.fingerprint256,authorized:s.authorized,authorizationError:s.authorizationError});});s.on("timeout",()=>done(null));s.on("error",e=>done({error:String(e)}));});}

(async()=>{
 const established=rows().filter(r=>r.state==="01"&&r.remote_ip!=="127.0.0.1").map(r=>({...r,owners:owners(r.inode)}));
 console.log(`ESTABLISHED=${JSON.stringify(established)}`);
 const ips=[...new Set(established.filter(r=>r.owners.length===0).map(r=>r.remote_ip))];
 for(const ip of ips){const open=[];for(const port of [80,443,8080,8443,9000,9901,15000,15001,3128,4318])if(await connect(ip,port))open.push(port);console.log(`HIDDEN_ENDPOINT=${JSON.stringify({ip,open})}`);for(const port of open.filter(p=>[443,8443,9901,15000].includes(p)))console.log(`TLS_CERT=${JSON.stringify({ip,port,cert:await cert(ip,port)})}`);}
 console.log("HIDDEN_BROKER_NETWORK_COMPLETE=true");
})().catch(e=>{console.error(e.stack||String(e));process.exit(1);});
