import { readAdminAuthConfig } from "../../../../lib/admin/auth";
import {
  AdminRequestError,
  assertTrustedOrigin,
  getAdminSession,
} from "../../../../lib/admin/request";
import type { AdminSession } from "../../../../lib/admin/session";
import {
  readLimitedJsonBody,
  RouteBodyError,
} from "../../../../lib/admin/route-body";
import {
  FeaturedValidationError,
  getAdminFeaturedProperties,
  replaceFeaturedPropertyIds,
  type AdminFeaturedPropertyCardData,
} from "../../../../lib/featured";

const MAX_BODY_BYTES = 8_192;

type FeaturedDependencies = {
  readSession: () => Promise<AdminSession | null>;
  readSiteOrigin: () => string;
  getItems: () => Promise<AdminFeaturedPropertyCardData[]>;
  replace: (ids: unknown) => Promise<void>;
};

const defaultDependencies: FeaturedDependencies = {
  readSession: getAdminSession,
  readSiteOrigin: () => readAdminAuthConfig().siteOrigin,
  getItems: getAdminFeaturedProperties,
  replace: replaceFeaturedPropertyIds,
};

function json(body: unknown, status: number) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function validationMessage(error: FeaturedValidationError) {
  switch (error.code) {
    case "INVALID_COUNT":
      return "Выберите от одного до трёх объектов";
    case "DUPLICATE_IDS":
      return "Каждый объект можно выбрать только один раз";
    case "PROPERTY_NOT_PUBLIC":
      return "Один или несколько объектов скрыты или недоступны";
    case "INVALID_SEARCH":
      return "Некорректные параметры поиска";
  }
}

export function createFeaturedHandlers(
  overrides: Partial<FeaturedDependencies> = {},
) {
  const dependencies = { ...defaultDependencies, ...overrides };

  async function GET(): Promise<Response> {
    try {
      if (!(await dependencies.readSession())) {
        return json({ ok: false, error: "Требуется вход" }, 401);
      }
      return json({ ok: true, items: await dependencies.getItems() }, 200);
    } catch {
      return json({ ok: false, error: "Сервис временно недоступен" }, 500);
    }
  }

  async function POST(request: Request): Promise<Response> {
    try {
      if (!(await dependencies.readSession())) {
        return json({ ok: false, error: "Требуется вход" }, 401);
      }
      assertTrustedOrigin(request, dependencies.readSiteOrigin());
      const body = (await readLimitedJsonBody(request, MAX_BODY_BYTES)) as {
        ids?: unknown;
      } | null;
      if (!body || typeof body !== "object" || !("ids" in body)) {
        return json({ ok: false, error: "Некорректный запрос" }, 400);
      }
      await dependencies.replace(body.ids);
      return json(
        { ok: true, items: await dependencies.getItems() },
        200,
      );
    } catch (error) {
      if (error instanceof AdminRequestError) {
        return json({ ok: false, error: "Запрос отклонён" }, error.status);
      }
      if (error instanceof FeaturedValidationError) {
        return json({ ok: false, error: validationMessage(error) }, 400);
      }
      if (error instanceof RouteBodyError) {
        return json({ ok: false, error: "Некорректный запрос" }, 400);
      }
      return json(
        { ok: false, error: "Не удалось сохранить избранные объекты" },
        500,
      );
    }
  }

  return { GET, POST };
}

const handlers = createFeaturedHandlers();

export const GET = handlers.GET;
export const POST = handlers.POST;
