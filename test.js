const http=require("node:http");
const paths=[
 "/bedrock/?a=%2f","/bedrock/?a=%2F","/bedrock/?a=%252f","/bedrock/?a=1&a=2",
 "/bedrock/?a=1&&b=2","/bedrock/?a","/bedrock/?a=","/bedrock/?=x",
 "/bedrock/?a=hello+world","/bedrock/?a=hello%20world","/bedrock/?a=%7E",
 "/bedrock/?a=%ff","/bedrock/?a=%00","/bedrock//unknown","/bedrock/%2e/unknown",
 "/bedrock/%252e/unknown","/bedrock/%25252e/unknown","/bedrock/unknown%2fchild",
 "/bedrock/unknown%252fchild","/bedrock/unknown%25252fchild"
];
function req(path){return new Promise(resolve=>{const r=http.request({hostname:"127.0.0.1",port:8082,path,method:"GET",timeout:15000},res=>{const c=[];res.on("data",x=>c.push(x));res.on("end",()=>resolve({path,status:res.statusCode,headers:res.headers,body:Buffer.concat(c).toString("utf8")}));});r.on("error",e=>resolve({path,error:String(e)}));r.end();});}
(async()=>{for(const p of paths){const v=await req(p);if(v.status!==404||!String(v.body).includes("UnknownOperation"))console.log(`CANONICAL_DIVERGENCE=${JSON.stringify(v)}`);}console.log("SIGNATURE_DIVERGENCE_SCAN_COMPLETE=true");})().catch(e=>{console.error(e.stack||String(e));process.exit(1);});
