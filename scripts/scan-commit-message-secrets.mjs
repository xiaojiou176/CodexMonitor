#!/usr/bin/env node

import { readFileSync } from "node:fs";

const messageFile = process.argv[2];

const SECRET_PATTERNS = [
  { name: "OpenAI key", regex: /\bsk-[A-Za-z0-9]{20,}\b/ },
  { name: "GitHub token", regex: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/ },
  { name: "AWS access key", regex: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: "Bearer token literal", regex: /\bBearer\s+[A-Za-z0-9._-]{20,}\b/i },
  { name: "Private key block", regex: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/ },
];

function main() {
  if (!messageFile) {
    console.error("[security][commit-msg] missing commit message file path.");
    process.exit(1);
  }

  const message = readFileSync(messageFile, "utf8");
  for (const pattern of SECRET_PATTERNS) {
    if (pattern.regex.test(message)) {
      console.error(`[security][commit-msg] blocked. detected ${pattern.name} in commit message.`);
      process.exit(1);
    }
  }

  console.log("[security][commit-msg] scan passed.");
}

main();
