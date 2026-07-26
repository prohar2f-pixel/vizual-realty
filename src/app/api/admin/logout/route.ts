import { cookies } from "next/headers";
import {
  readAdminAuthConfig,
  type AdminAuthConfig,
} from "../../../../lib/admin/auth";
import {
  AdminRequestError,
  assertTrustedOrigin,
  getAdminSession,
} from "../../../../lib/admin/request";
import {
  ADMIN_SESSION_COOKIE,
  type AdminSession,
} from "../../../../lib/admin/session";

type LogoutDependencies = {
  readConfig: () => AdminAuthConfig;
  readSession: () => Promise<AdminSession | null>;
  getCookieStore: () => Promise<{ delete(name: string): void }>;
};

const defaultDependencies: LogoutDependencies = {
  readConfig: readAdminAuthConfig,
  readSession: getAdminSession,
  getCookieStore: cookies,
};

function json(body: unknown, status: number) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export function createLogoutHandler(
  overrides: Partial<LogoutDependencies> = {},
) {
  const dependencies = { ...defaultDependencies, ...overrides };

  return async function POST(request: Request): Promise<Response> {
    try {
      const config = dependencies.readConfig();
      assertTrustedOrigin(request, config.siteOrigin);
      if (!(await dependencies.readSession())) {
        return json({ ok: false, error: "Требуется вход" }, 401);
      }
      (await dependencies.getCookieStore()).delete(ADMIN_SESSION_COOKIE);
      return Response.redirect(new URL("/admin/login", config.siteOrigin), 303);
    } catch (error) {
      if (error instanceof AdminRequestError) {
        return json({ ok: false, error: "Запрос отклонён" }, error.status);
      }
      return json({ ok: false, error: "Не удалось выйти" }, 500);
    }
  };
}

export const POST = createLogoutHandler();
