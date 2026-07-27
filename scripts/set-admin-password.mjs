import { randomBytes, scryptSync } from "node:crypto";
import {
  chmodSync,
  existsSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

const password = process.env.ADMIN_PASSWORD_PLAIN;
if (!password || password.length < 12) {
  console.error("admin password must contain at least 12 characters");
  process.exit(1);
}

const N = 16_384;
const r = 8;
const p = 1;
const salt = randomBytes(32);
const hash = scryptSync(password, salt, 32, {
  N,
  r,
  p,
  maxmem: 128 * N * r + 2 * 1024 * 1024,
});
const encoded = [
  "scrypt",
  N,
  r,
  p,
  salt.toString("base64"),
  hash.toString("base64"),
].join("$");

const path = join(process.cwd(), ".env");
const current = existsSync(path) ? readFileSync(path, "utf8") : "";
// Next.js expands unescaped `$NAME` sequences while loading `.env`. The
// scrypt salt and digest are base64 and can begin with a letter, so every
// delimiter must be escaped on disk to preserve the hash at runtime.
const stored = encoded.replaceAll("$", "\\$");
const line = `ADMIN_PASSWORD_HASH="${stored}"`;
const next = /^ADMIN_PASSWORD_HASH=.*$/m.test(current)
  ? current.replace(/^ADMIN_PASSWORD_HASH=.*$/m, line)
  : `${current.trimEnd()}${current.trim() ? "\n" : ""}${line}\n`;
const temp = `${path}.password-${process.pid}-${randomBytes(8).toString("hex")}`;

try {
  writeFileSync(temp, next, { mode: 0o600 });
  renameSync(temp, path);
  chmodSync(path, 0o600);
} finally {
  if (existsSync(temp)) unlinkSync(temp);
}

console.log("admin_password_hash_configured");
