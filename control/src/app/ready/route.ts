export const dynamic = "force-dynamic";
export async function GET() { try { const { getDb } = await import("../../lib/db"); await getDb().$queryRawUnsafe("SELECT 1"); return Response.json({ ok: true }); } catch { return Response.json({ ok: false }, { status: 503 }); } }
