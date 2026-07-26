import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

const TOKEN_VERSION = "v1";
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;
const NONCE_BYTES = 16;
const MIN_SECRET_BYTES = 32;
const MAX_TOKEN_LENGTH = 4_096;

export const ADMIN_SESSION_COOKIE = "vizual_admin_session";

export type AdminSession = {
  adminId: string;
  issuedAt: number;
  expiresAt: number;
  nonce: string;
};

export type AdminSessionInput = {
  adminId: string;
  expiresAt: number;
};

function deriveKey(secret: string) {
  if (Buffer.byteLength(secret, "utf8") < MIN_SECRET_BYTES) {
    throw new TypeError("Session secret is invalid");
  }
  return createHash("sha256").update(secret, "utf8").digest();
}

function isAdminSession(value: unknown): value is AdminSession {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  if (
    Object.keys(record).length !== 4 ||
    typeof record.adminId !== "string" ||
    !record.adminId ||
    record.adminId.length > 256 ||
    typeof record.issuedAt !== "number" ||
    !Number.isSafeInteger(record.issuedAt) ||
    typeof record.expiresAt !== "number" ||
    !Number.isSafeInteger(record.expiresAt) ||
    record.expiresAt <= record.issuedAt ||
    typeof record.nonce !== "string" ||
    !/^[A-Za-z0-9_-]{22}$/.test(record.nonce)
  ) {
    return false;
  }
  return true;
}

export function sealSession(
  payload: AdminSessionInput,
  secret: string,
  now = Date.now(),
): string {
  if (
    typeof payload.adminId !== "string" ||
    !payload.adminId ||
    payload.adminId.length > 256 ||
    !Number.isSafeInteger(now) ||
    !Number.isSafeInteger(payload.expiresAt) ||
    payload.expiresAt <= now
  ) {
    throw new TypeError("Session payload is invalid");
  }

  const session: AdminSession = {
    adminId: payload.adminId,
    issuedAt: now,
    expiresAt: payload.expiresAt,
    nonce: randomBytes(NONCE_BYTES).toString("base64url"),
  };
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", deriveKey(secret), iv, {
    authTagLength: AUTH_TAG_BYTES,
  });
  const plaintext = Buffer.from(JSON.stringify(session), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${TOKEN_VERSION}.${Buffer.concat([iv, ciphertext, authTag]).toString("base64url")}`;
}

export function unsealSession(
  token: string,
  secret: string,
  now = Date.now(),
): AdminSession | null {
  try {
    if (
      typeof token !== "string" ||
      token.length > MAX_TOKEN_LENGTH ||
      !Number.isSafeInteger(now)
    ) {
      return null;
    }
    const [version, encoded, extra] = token.split(".");
    if (version !== TOKEN_VERSION || !encoded || extra !== undefined) return null;
    if (!/^[A-Za-z0-9_-]+$/.test(encoded)) return null;

    const sealed = Buffer.from(encoded, "base64url");
    if (sealed.length <= IV_BYTES + AUTH_TAG_BYTES) return null;
    const iv = sealed.subarray(0, IV_BYTES);
    const authTag = sealed.subarray(sealed.length - AUTH_TAG_BYTES);
    const ciphertext = sealed.subarray(IV_BYTES, sealed.length - AUTH_TAG_BYTES);
    const decipher = createDecipheriv("aes-256-gcm", deriveKey(secret), iv, {
      authTagLength: AUTH_TAG_BYTES,
    });
    decipher.setAuthTag(authTag);
    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString("utf8");
    const session: unknown = JSON.parse(plaintext);

    if (!isAdminSession(session) || session.expiresAt <= now) return null;
    return session;
  } catch {
    return null;
  }
}
