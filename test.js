const http=require("node:http");
const body=Buffer.from(JSON.stringify({anthropic_version:"bedrock-2023-05-31",max_tokens:1,messages:[{role:"user",content:"x"}]}));
const ids=[
 ["own-profile","arn:aws:bedrock:us-east-1:293180004455:inference-profile/us.anthropic.claude-opus-5-5"],
 ["other-profile","arn:aws:bedrock:us-east-1:000000000000:inference-profile/us.anthropic.claude-opus-5-5"],
 ["own-custom","arn:aws:bedrock:us-east-1:293180004455:custom-model/fake/000000000000"],
 ["other-custom","arn:aws:bedrock:us-east-1:000000000000:custom-model/fake/000000000000"],
];
function twice(id){return encodeURIComponent(encodeURIComponent(id));}
function req(name,id){return new Promise(resolve=>{const path=`/bedrock/model/${twice(id)}/invoke`;const r=http.request({hostname:"127.0.0.1",port:8082,path,method:"POST",headers:{"content-type":"application/json","content-length":body.length},timeout:45000},res=>{const c=[];res.on("data",x=>c.push(x));res.on("end",()=>resolve({name,id,path,status:res.statusCode,headers:res.headers,body:Buffer.concat(c).toString("utf8")}));});r.on("error",e=>resolve({name,error:String(e)}));r.end(body);});}
(async()=>{for(const [n,id] of ids)console.log(`ARN_AUTHORITY=${JSON.stringify(await req(n,id))}`);console.log("BEDROCK_ARN_AUTHORITY_COMPLETE=true");})().catch(e=>{console.error(e.stack||String(e));process.exit(1);});
