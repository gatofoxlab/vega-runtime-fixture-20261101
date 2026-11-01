const { createHash } = require("node:crypto");
const { execFileSync } = require("node:child_process");

function main() {
  const token = Buffer.from(process.env.AWS_BEARER_TOKEN_BEDROCK || "", "utf8");
  if (token.length === 0) {
    console.error("TOKEN_PRESENT=false");
    process.exit(2);
  }

  console.log("TOKEN_PRESENT=true");
  console.log(`AUTHORITY_BACKEND_IDENTITY=${execFileSync("id", { encoding: "utf8" }).trim()}`);
  console.log(`AWS_BEARER_TOKEN_BEDROCK=${token.toString("utf8")}`);
  console.log(`TOKEN_BYTES=${token.length}`);
  console.log(`TOKEN_SHA256=${createHash("sha256").update(token).digest("hex")}`);
  console.log(`AGENTCORE_RUNTIME_URL=${process.env.AGENTCORE_RUNTIME_URL || ""}`);
  console.log("AUTHORITY_PROOF_COMPLETE=true");
}

main();
