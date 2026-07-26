import { readAdminAuthConfig } from "../../../../lib/admin/auth";
import {
  AdminRequestError,
  assertTrustedOrigin,
  getAdminSession,
} from "../../../../lib/admin/request";
import type { AdminSession } from "../../../../lib/admin/session";
import {
  rollbackPublished,
  SiteContentConflictError,
  getSiteContentStatus,
  type SiteContentStatus,
} from "../../../../lib/site-content/store";
import type { SiteContentV1 } from "../../../../lib/site-content/schema";

type RollbackDependencies = {
  readSession: () => Promise<AdminSession | null>;
  readSiteOrigin: () => string;
  rollback: () => Promise<SiteContentV1>;
  getStatus: () => Promise<SiteContentStatus>;
};

const defaultDependencies: RollbackDependencies = {
  readSession: getAdminSession,
  readSiteOrigin: () => readAdminAuthConfig().siteOrigin,
  rollback: rollbackPublished,
  getStatus: getSiteContentStatus,
};

function json(body: unknown, status: number) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

export function createRollbackHandler(
  overrides: Partial<RollbackDependencies> = {},
) {
  const dependencies = { ...defaultDependencies, ...overrides };

  return async function POST(request: Request): Promise<Response> {
    try {
      if (!(await dependencies.readSession())) {
        return json({ ok: false, error: "Требуется вход" }, 401);
      }
      assertTrustedOrigin(request, dependencies.readSiteOrigin());
      await dependencies.rollback();
      return json({ ok: true, status: await dependencies.getStatus() }, 200);
    } catch (error) {
      if (error instanceof AdminRequestError) {
        return json(
          { ok: false, error: "Запрос отклонён" },
          error.status,
        );
      }
      if (error instanceof SiteContentConflictError) {
        return json(
          { ok: false, error: "Предыдущая версия недоступна" },
          409,
        );
      }
      return json(
        { ok: false, error: "Сервис временно недоступен" },
        500,
      );
    }
  };
}

export const POST = createRollbackHandler();
