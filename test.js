const http = require("node:http");

const cases = [
  {name:"titan", path:"/bedrock/model/amazon.titan-text-express-v1/invoke", body:{inputText:"reply x",textGenerationConfig:{maxTokenCount:1}}},
  {name:"claude-v2", path:"/bedrock/model/anthropic.claude-v2/invoke", body:{prompt:"\\n\\nHuman: x\\n\\nAssistant:",max_tokens_to_sample:1}},
  {name:"llama", path:"/bedrock/model/us.meta.llama3-2-1b-instruct-v1:0/invoke", body:{prompt:"x",max_gen_len:1}},
  {name:"invalid-model", path:"/bedrock/model/arn%3Aaws%3Abedrock%3Aus-west-2%3A000000000000%3Ainference-profile%2Fdoes-not-exist/invoke", body:{anthropic_version:"bedrock-2023-05-31",max_tokens:1,messages:[{role:"user",content:"x"}]}},
  {name:"guardrail", path:"/bedrock/guardrail/aaaaaaaaaa/version/1/apply", body:{source:"TEXT",content:[{text:{text:"x"}}],outputScope:"INTERVENTIONS"}},
  {name:"count-tokens", path:"/bedrock/model/us.anthropic.claude-opus-5-5/count-tokens", body:{input:{invokeModel:{body:JSON.stringify({anthropic_version:"bedrock-2023-05-31",max_tokens:1,messages:[{role:"user",content:"x"}]})}}}},
];
function request(test){return new Promise(resolve=>{const body=Buffer.from(JSON.stringify(test.body));const req=http.request({hostname:"127.0.0.1",port:8082,path:test.path,method:"POST",headers:{"content-type":"application/json","accept":"application/json","content-length":body.length},timeout:45000},res=>{const chunks=[];res.on("data",c=>chunks.push(c));res.on("end",()=>resolve({name:test.name,path:test.path,status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks).toString("utf8").slice(0,20000)}));});req.on("timeout",()=>req.destroy(new Error("timeout")));req.on("error",e=>resolve({name:test.name,error:String(e)}));req.end(body);});}
(async()=>{for(const test of cases)console.log(`AUTHORITY_PROBE=${JSON.stringify(await request(test))}`);console.log("BEDROCK_AUTHORITY_IDENTITY_COMPLETE=true");})().catch(e=>{console.error(e.stack||String(e));process.exit(1);});
