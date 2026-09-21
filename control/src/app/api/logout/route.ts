import { cookies } from "next/headers";
import { assertTrustedOrigin, getSession, RequestDeniedError } from "../../../lib/security/request";
import { COOKIE_NAME } from "../../../lib/security/session";
export const dynamic = "force-dynamic";
export async function POST(request: Request) { try { assertTrustedOrigin(request); if (!(await getSession())) return Response.json({ ok: false }, { status: 401 }); (await cookies()).delete(COOKIE_NAME); return Response.redirect(new URL("/login", request.url), 303); } catch (error) { return Response.json({ ok: false }, { status: error instanceof RequestDeniedError ? 403 : 500 }); } }
