import { readAdminAuthConfig } from "../../../../lib/admin/auth";
import {
  AdminRequestError,
  assertTrustedOrigin,
  getAdminSession,
} from "../../../../lib/admin/request";
import type { AdminSession } from "../../../../lib/admin/session";
import { publishDraft } from "../../../../lib/site-content/store";
import type { SiteContentV1 } from "../../../../lib/site-content/schema";

type PublishDependencies = {
  readSession: () => Promise<AdminSession | null>;
  readSiteOrigin: () => string;
  publish: () => Promise<SiteContentV1>;
};

const defaultDependencies: PublishDependencies = {
  readSession: getAdminSession,
  readSiteOrigin: () => readAdminAuthConfig().siteOrigin,
  publish: publishDraft,
};

function json(body: unknown, status: number) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

export function createPublishHandler(
  overrides: Partial<PublishDependencies> = {},
) {
  const dependencies = { ...defaultDependencies, ...overrides };

  return async function POST(request: Request): Promise<Response> {
    try {
      if (!(await dependencies.readSession())) {
        return json({ ok: false, error: "Требуется вход" }, 401);
      }
      assertTrustedOrigin(request, dependencies.readSiteOrigin());
      return json(
        { ok: true, content: await dependencies.publish() },
        200,
      );
    } catch (error) {
      if (error instanceof AdminRequestError) {
        return json(
          { ok: false, error: "Запрос отклонён" },
          error.status,
        );
      }
      return json(
        { ok: false, error: "Сервис временно недоступен" },
        500,
      );
    }
  };
}

export const POST = createPublishHandler();
