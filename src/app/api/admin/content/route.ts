import { readAdminAuthConfig } from "../../../../lib/admin/auth";
import {
  AdminRequestError,
  assertTrustedOrigin,
  getAdminSession,
} from "../../../../lib/admin/request";
import {
  readLimitedJsonBody,
  RouteBodyError,
} from "../../../../lib/admin/route-body";
import type { AdminSession } from "../../../../lib/admin/session";
import {
  getDraftContent,
  saveDraft,
} from "../../../../lib/site-content/store";
import {
  SiteContentValidationError,
  type SiteContentV1,
} from "../../../../lib/site-content/schema";

const CONTENT_MAX_BODY_BYTES = 256 * 1024;

type ContentDependencies = {
  readSession: () => Promise<AdminSession | null>;
  readSiteOrigin: () => string;
  getDraft: () => Promise<SiteContentV1>;
  save: (input: unknown) => Promise<SiteContentV1>;
};

const defaultDependencies: ContentDependencies = {
  readSession: getAdminSession,
  readSiteOrigin: () => readAdminAuthConfig().siteOrigin,
  getDraft: getDraftContent,
  save: saveDraft,
};

function json(body: unknown, status: number) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

export function createContentHandlers(
  overrides: Partial<ContentDependencies> = {},
) {
  const dependencies = { ...defaultDependencies, ...overrides };

  async function GET(): Promise<Response> {
    try {
      if (!(await dependencies.readSession())) {
        return json({ ok: false, error: "Требуется вход" }, 401);
      }
      return json(
        { ok: true, content: await dependencies.getDraft() },
        200,
      );
    } catch {
      return json(
        { ok: false, error: "Сервис временно недоступен" },
        500,
      );
    }
  }

  async function POST(request: Request): Promise<Response> {
    try {
      if (!(await dependencies.readSession())) {
        return json({ ok: false, error: "Требуется вход" }, 401);
      }
      assertTrustedOrigin(request, dependencies.readSiteOrigin());
      const input = await readLimitedJsonBody(
        request,
        CONTENT_MAX_BODY_BYTES,
      );
      return json(
        { ok: true, content: await dependencies.save(input) },
        200,
      );
    } catch (error) {
      if (error instanceof AdminRequestError) {
        return json(
          { ok: false, error: "Запрос отклонён" },
          error.status,
        );
      }
      if (error instanceof SiteContentValidationError) {
        return json({ ok: false, issues: error.issues }, 400);
      }
      if (error instanceof RouteBodyError) {
        return json(
          { ok: false, error: "Некорректный запрос" },
          400,
        );
      }
      return json(
        { ok: false, error: "Сервис временно недоступен" },
        500,
      );
    }
  }

  return { GET, POST };
}

const handlers = createContentHandlers();

export const GET = handlers.GET;
export const POST = handlers.POST;
