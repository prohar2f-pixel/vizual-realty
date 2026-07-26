import { cookies } from "next/headers";
import { ADMIN_SESSION_COOKIE } from "../../../../../lib/admin/session";

type SessionClearDependencies = {
  getCookieStore: () => Promise<{
    delete(name: string): void;
  }>;
};

const defaultDependencies: SessionClearDependencies = {
  getCookieStore: cookies,
};

export function createSessionClearHandler(
  overrides: Partial<SessionClearDependencies> = {},
) {
  const dependencies = { ...defaultDependencies, ...overrides };

  return async function GET(request?: Request): Promise<Response> {
    void request;
    const cookieStore = await dependencies.getCookieStore();
    cookieStore.delete(ADMIN_SESSION_COOKIE);
    return new Response(null, {
      status: 303,
      headers: {
        Location: "/admin/login",
        "Cache-Control": "private, no-store",
      },
    });
  };
}

export const GET = createSessionClearHandler();
