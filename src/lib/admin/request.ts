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

export async function getAdminSession(): Promise<AdminSession | null> {
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const config = readAdminAuthConfig();
    return unsealSession(token, config.sessionSecret);
  } catch {
    return null;
  }
}

export async function requireAdminSession(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  return session;
}
