import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const COOKIE_NAME = "vizual_topnlab_control_session";
const VERSION = "v1";
const IV_BYTES = 12;
const TAG_BYTES = 16;
const MAX_TOKEN_LENGTH = 4096;

export { COOKIE_NAME };

export type ControlSession = { adminId: string; issuedAt: number; expiresAt: number; nonce: string };

function key(secret: string) {
  if (Buffer.byteLength(secret, "utf8") < 32) throw new TypeError("Invalid session secret");
  return createHash("sha256").update(secret, "utf8").digest();
}

export function sealSession(adminId: string, expiresAt: number, secret: string, now = Date.now()) {
  if (!adminId || !Number.isSafeInteger(expiresAt) || expiresAt <= now) throw new TypeError("Invalid session");
  const payload: ControlSession = { adminId, issuedAt: now, expiresAt, nonce: randomBytes(16).toString("base64url") };
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key(secret), iv, { authTagLength: TAG_BYTES });
  const data = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  return `${VERSION}.${Buffer.concat([iv, data, cipher.getAuthTag()]).toString("base64url")}`;
}

export function unsealSession(token: string, secret: string, now = Date.now()): ControlSession | null {
  try {
    if (token.length > MAX_TOKEN_LENGTH) return null;
    const [version, body, extra] = token.split(".");
    if (version !== VERSION || !body || extra !== undefined || !/^[A-Za-z0-9_-]+$/.test(body)) return null;
    const raw = Buffer.from(body, "base64url");
    if (raw.length <= IV_BYTES + TAG_BYTES) return null;
    const decipher = createDecipheriv("aes-256-gcm", key(secret), raw.subarray(0, IV_BYTES), { authTagLength: TAG_BYTES });
    decipher.setAuthTag(raw.subarray(-TAG_BYTES));
    const session: unknown = JSON.parse(Buffer.concat([decipher.update(raw.subarray(IV_BYTES, -TAG_BYTES)), decipher.final()]).toString("utf8"));
    if (!session || typeof session !== "object") return null;
    const value = session as Record<string, unknown>;
    if (typeof value.adminId !== "string" || !value.adminId || typeof value.issuedAt !== "number" || typeof value.expiresAt !== "number" || value.expiresAt <= now || typeof value.nonce !== "string") return null;
    return value as ControlSession;
  } catch { return null; }
}
