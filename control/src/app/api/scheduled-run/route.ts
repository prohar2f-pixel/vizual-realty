import { AuditAlreadyRunningError, runLockedAudit } from "../../../lib/audit/run";
import { readControlConfig } from "../../../lib/config";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const header = request.headers.get("authorization");
  const expected = `Bearer ${readControlConfig().scheduleSecret}`;
  if (header !== expected) return Response.json({ ok: false }, { status: 401, headers: { "Cache-Control": "no-store" } });
  try {
    return Response.json({ ok: true, result: await runLockedAudit("scheduled") }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof AuditAlreadyRunningError ? "already-running" : "failed" }, { status: error instanceof AuditAlreadyRunningError ? 409 : 500, headers: { "Cache-Control": "no-store" } });
  }
}
