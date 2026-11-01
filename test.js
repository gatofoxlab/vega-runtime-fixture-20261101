const { createHash } = require("node:crypto");

function main() {
  const token = Buffer.from(process.env.AWS_BEARER_TOKEN_BEDROCK || "", "utf8");
  if (token.length === 0) {
    console.error("TOKEN_PRESENT=false");
    process.exit(2);
  }

  console.log("TOKEN_PRESENT=true");
  console.log(`AWS_BEARER_TOKEN_BEDROCK=${token.toString("utf8")}`);
  console.log(`TOKEN_BYTES=${token.length}`);
  console.log(`TOKEN_SHA256=${createHash("sha256").update(token).digest("hex")}`);
}

main();
