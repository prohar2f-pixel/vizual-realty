import { cookies } from "next/headers";
import { isIP } from "node:net";
import { readControlConfig } from "../../../lib/config";
import { verifyPassword } from "../../../lib/security/auth";
import { assertTrustedOrigin, RequestDeniedError } from "../../../lib/security/request";
import { consumeLoginAttempt } from "../../../lib/security/rate-limit";
import { COOKIE_NAME, sealSession } from "../../../lib/security/session";

export const dynamic = "force-dynamic";

function response(body: unknown, status: number, headers?: HeadersInit) { return Response.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } }); }
function clientKey(request: Request) { const ip = request.headers.get("x-real-ip")?.trim(); return ip && isIP(ip) ? ip : "unknown"; }
export async function POST(request: Request) { try { const config = readControlConfig(); assertTrustedOrigin(request); const rate = consumeLoginAttempt(clientKey(request)); if (!rate.allowed) return response({ ok: false, error: "Слишком много попыток. Попробуйте позже." }, 429, { "Retry-After": String(rate.retryAfterSeconds) }); const data = await request.formData(); const username = typeof data.get("username") === "string" ? data.get("username") as string : ""; const password = typeof data.get("password") === "string" ? data.get("password") as string : ""; if (username.length > 256 || !(await verifyPassword(password, config.adminPasswordHash)) || username !== config.adminUsername) return response({ ok: false, error: "Неверный логин или пароль" }, 401); const expiresAt = Date.now() + 12 * 60 * 60 * 1000; (await cookies()).set({ name: COOKIE_NAME, value: sealSession(username, expiresAt, config.sessionSecret), httpOnly: true, sameSite: "strict", secure: true, path: "/", maxAge: 12 * 60 * 60, expires: new Date(expiresAt) }); return response({ ok: true }, 200); } catch (error) { if (error instanceof RequestDeniedError) return response({ ok: false, error: "Запрос отклонён" }, 403); return response({ ok: false, error: "Сервис входа временно недоступен" }, 500); } }
