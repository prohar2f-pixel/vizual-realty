import { scrypt, timingSafeEqual } from "node:crypto";

const DEFAULT_SESSION_TTL_HOURS = 12;
const MIN_SESSION_SECRET_BYTES = 32;
const MAX_PASSWORD_BYTES = 4_096;
const MAX_SCRYPT_MEMORY = 512 * 1024 * 1024;

export type AdminAuthConfig = {
  username: string;
  passwordHash: string;
  sessionSecret: string;
  siteOrigin: string;
  sessionTtlSeconds: number;
  secureCookie: boolean;
};

export class AdminConfigurationError extends Error {
  constructor() {
    super("Admin authentication is not configured");
    this.name = "AdminConfigurationError";
  }
}

type Environment = Record<string, string | undefined>;

function configurationError(): never {
  throw new AdminConfigurationError();
}

function required(value: string | undefined) {
  const normalized = value?.trim();
  if (!normalized) configurationError();
  return normalized;
}

function parseSiteOrigin(value: string) {
  try {
    const url = new URL(value);
    if (
      url.origin !== value ||
      (url.protocol !== "http:" && url.protocol !== "https:")
    ) {
      configurationError();
    }
    return value;
  } catch (error) {
    if (error instanceof AdminConfigurationError) throw error;
    return configurationError();
  }
}

export function readAdminAuthConfig(
  env: Environment = process.env,
): AdminAuthConfig {
  const username = required(env.ADMIN_USERNAME);
  const passwordHash = required(env.ADMIN_PASSWORD_HASH);
  const sessionSecret = required(env.ADMIN_SESSION_SECRET);
  const siteOrigin = parseSiteOrigin(required(env.SITE_ORIGIN));
  if (
    username.length > 256 ||
    Buffer.byteLength(sessionSecret, "utf8") < MIN_SESSION_SECRET_BYTES
  ) {
    configurationError();
  }

  const ttlHoursText = env.ADMIN_SESSION_TTL_HOURS?.trim();
  const ttlHours = ttlHoursText
    ? Number(ttlHoursText)
    : DEFAULT_SESSION_TTL_HOURS;
  if (!Number.isFinite(ttlHours) || ttlHours <= 0) configurationError();
  const sessionTtlSeconds = ttlHours * 60 * 60;
  if (!Number.isSafeInteger(sessionTtlSeconds)) configurationError();

  return {
    username,
    passwordHash,
    sessionSecret,
    siteOrigin,
    sessionTtlSeconds,
    secureCookie: env.NODE_ENV === "production",
  };
}

type ScryptHash = {
  N: number;
  r: number;
  p: number;
  salt: Buffer;
  expected: Buffer;
  maxmem: number;
};

function decodeBase64(value: string) {
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
    return null;
  }
  const decoded = Buffer.from(value, "base64");
  return decoded.toString("base64") === value ? decoded : null;
}

function parseScryptHash(encoded: string): ScryptHash | null {
  const [algorithm, nText, rText, pText, saltText, hashText, extra] =
    encoded.split("$");
  if (
    algorithm !== "scrypt" ||
    extra !== undefined ||
    !/^\d+$/.test(nText ?? "") ||
    !/^\d+$/.test(rText ?? "") ||
    !/^\d+$/.test(pText ?? "")
  ) {
    return null;
  }

  const N = Number(nText);
  const r = Number(rText);
  const p = Number(pText);
  const salt = decodeBase64(saltText ?? "");
  const expected = decodeBase64(hashText ?? "");
  if (
    !Number.isSafeInteger(N) ||
    N < 2 ||
    N > 1_048_576 ||
    (N & (N - 1)) !== 0 ||
    !Number.isSafeInteger(r) ||
    r < 1 ||
    r > 32 ||
    !Number.isSafeInteger(p) ||
    p < 1 ||
    p > 16 ||
    !salt ||
    salt.length < 8 ||
    salt.length > 1_024 ||
    !expected ||
    expected.length < 16 ||
    expected.length > 128
  ) {
    return null;
  }

  const requiredMemory = 128 * N * r + 128 * r * p + 1024 * 1024;
  if (!Number.isSafeInteger(requiredMemory) || requiredMemory > MAX_SCRYPT_MEMORY) {
    return null;
  }

  return {
    N,
    r,
    p,
    salt,
    expected,
    maxmem: Math.max(32 * 1024 * 1024, requiredMemory),
  };
}

export async function verifyAdminPassword(
  password: string,
  encodedScryptHash: string,
): Promise<boolean> {
  if (
    typeof password !== "string" ||
    Buffer.byteLength(password, "utf8") > MAX_PASSWORD_BYTES ||
    typeof encodedScryptHash !== "string"
  ) {
    return false;
  }
  const parsed = parseScryptHash(encodedScryptHash);
  if (!parsed) return false;

  try {
    const actual = await new Promise<Buffer>((resolve, reject) => {
      scrypt(
        password,
        parsed.salt,
        parsed.expected.length,
        {
          N: parsed.N,
          r: parsed.r,
          p: parsed.p,
          maxmem: parsed.maxmem,
        },
        (error, derivedKey) => {
          if (error) reject(error);
          else resolve(derivedKey as Buffer);
        },
      );
    });
    return timingSafeEqual(actual, parsed.expected);
  } catch {
    return false;
  }
}
