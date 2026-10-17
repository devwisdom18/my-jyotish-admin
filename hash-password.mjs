import { randomBytes, pbkdf2Sync } from "node:crypto";
const password = process.argv[2];
if (!password || password.length < 14) {
  console.error("Use: node hash-password.mjs 'a-long-unique-password'  (minimum 14 characters)");
  process.exit(1);
}
const iterations = 310000;
const salt = randomBytes(16);
const hash = pbkdf2Sync(password, salt, iterations, 32, "sha256");
const b64url = b => b.toString("base64url");
console.log(`pbkdf2$${iterations}$${b64url(salt)}$${b64url(hash)}`);
