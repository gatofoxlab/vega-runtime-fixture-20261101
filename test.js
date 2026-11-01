const fs = require("node:fs");
const path = require("node:path");

function walk(root, out=[]) { for (const e of fs.readdirSync(root,{withFileTypes:true})) { const p=path.join(root,e.name); if(e.isDirectory()&&!p.includes("__pycache__"))walk(p,out); else if(e.isFile()&&/\.(py|json|toml|yaml|yml|conf)$/.test(e.name))out.push(p); } return out; }
const patterns=/internal\/agent|agent-egress|bedrock-proxy|token.vend|credential|provider.key|aws_access|secret_access|session_token|sigv4/i;
for(const file of walk("/app")){
 let lines; try{lines=fs.readFileSync(file,"utf8").split("\n");}catch{continue;}
 for(let i=0;i<lines.length;i++)if(patterns.test(lines[i]))console.log(`SOURCE_HIT=${JSON.stringify({file,line:i+1,text:lines[i]})}`);
}
console.log("APP_CREDENTIAL_STRING_SCAN_COMPLETE=true");
