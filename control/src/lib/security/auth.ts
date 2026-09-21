import { scrypt, timingSafeEqual } from "node:crypto";

const MAX_PASSWORD_BYTES = 4096;

type ParsedHash = { N: number; r: number; p: number; salt: Buffer; expected: Buffer; maxmem: number };

function parseHash(encoded: string): ParsedHash | null {
  const [algorithm, n, r, p, salt, hash, extra] = encoded.split("$");
  if (algorithm !== "scrypt" || extra || !/^\d+$/.test(n ?? "") || !/^\d+$/.test(r ?? "") || !/^\d+$/.test(p ?? "")) return null;
  const N = Number(n), rNumber = Number(r), pNumber = Number(p);
  const saltValue = Buffer.from(salt ?? "", "base64"), expected = Buffer.from(hash ?? "", "base64");
  if (!Number.isSafeInteger(N) || N < 2 ** 14 || N > 2 ** 16 || (N & (N - 1)) !== 0 || !Number.isSafeInteger(rNumber) || rNumber < 1 || rNumber > 8 || !Number.isSafeInteger(pNumber) || pNumber < 1 || pNumber > 4 || saltValue.length < 16 || saltValue.length > 64 || expected.length < 32 || expected.length > 64) return null;
  const memory = 128 * N * rNumber;
  if (memory > 64 * 1024 * 1024 || N * rNumber * pNumber > 2 ** 21) return null;
  return { N, r: rNumber, p: pNumber, salt: saltValue, expected, maxmem: memory + 2 * 1024 * 1024 };
}

export async function verifyPassword(password: string, encoded: string) {
  if (Buffer.byteLength(password, "utf8") > MAX_PASSWORD_BYTES) return false;
  const parsed = parseHash(encoded);
  if (!parsed) return false;
  try {
    const actual = await new Promise<Buffer>((resolve, reject) => scrypt(password, parsed.salt, parsed.expected.length, { N: parsed.N, r: parsed.r, p: parsed.p, maxmem: parsed.maxmem }, (error, value) => error ? reject(error) : resolve(value as Buffer)));
    return timingSafeEqual(actual, parsed.expected);
  } catch { return false; }
}
