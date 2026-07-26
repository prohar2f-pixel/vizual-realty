import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { readAdminAuthConfig } from "./auth";
import {
  ADMIN_SESSION_COOKIE,
  unsealSession,
  type AdminSession,
} from "./session";

export class AdminRequestError extends Error {
  readonly status = 403;

  constructor() {
    super("Forbidden");
    this.name = "AdminRequestError";
  }
}

export function assertTrustedOrigin(request: Request, siteOrigin?: string): void {
  const expectedOrigin = siteOrigin ?? readAdminAuthConfig().siteOrigin;
  if (request.headers.get("origin") !== expectedOrigin) {
    throw new AdminRequestError();
  }
}

export async function getAdminSessionState(): Promise<{
  session: AdminSession | null;
  invalidCookie: boolean;
}> {
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
  if (!token) return { session: null, invalidCookie: false };

  try {
    const config = readAdminAuthConfig();
    const session = unsealSession(token, config.sessionSecret);
    return { session, invalidCookie: session === null };
  } catch {
    return { session: null, invalidCookie: true };
  }
}

export async function getAdminSession(): Promise<AdminSession | null> {
  return (await getAdminSessionState()).session;
}

export async function requireAdminSession(): Promise<AdminSession> {
  const result = await getAdminSessionState();
  if (!result.session) {
    redirect(
      result.invalidCookie
        ? "/api/admin/session/clear"
        : "/admin/login",
    );
  }
  return result.session;
}
