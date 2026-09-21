import { runAudit } from "../../../lib/audit/run";
import { assertTrustedOrigin, getSession, RequestDeniedError } from "../../../lib/security/request";
export const dynamic = "force-dynamic";
let running = false;
export async function POST(request: Request) { try { assertTrustedOrigin(request); const session = await getSession(); if (!session) return Response.json({ ok: false, error: "Требуется вход" }, { status: 401 }); if (running) return Response.json({ ok: false, error: "Проверка уже выполняется" }, { status: 409 }); running = true; const result = await runAudit("manual"); return Response.json({ ok: true, result }, { headers: { "Cache-Control": "no-store" } }); } catch (error) { return Response.json({ ok: false, error: error instanceof RequestDeniedError ? "Запрос отклонён" : "Проверка завершилась ошибкой" }, { status: error instanceof RequestDeniedError ? 403 : 500 }); } finally { running = false; } }
