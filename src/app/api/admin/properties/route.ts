import { getAdminSession } from "../../../../lib/admin/request";
import type { AdminSession } from "../../../../lib/admin/session";
import {
  FeaturedValidationError,
  searchPublicProperties,
  type PropertySearchResult,
} from "../../../../lib/featured";

const PAGE_SIZE = 20;

type SearchDependencies = {
  readSession: () => Promise<AdminSession | null>;
  search: (input: {
    query: string;
    page: number;
    pageSize: number;
  }) => Promise<PropertySearchResult>;
};

const defaultDependencies: SearchDependencies = {
  readSession: getAdminSession,
  search: searchPublicProperties,
};

function json(body: unknown, status: number) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function readPage(value: string | null) {
  const text = value ?? "1";
  if (!/^\d+$/.test(text)) return null;
  const page = Number(text);
  return Number.isSafeInteger(page) && page >= 1 ? page : null;
}

export function createPropertySearchHandler(
  overrides: Partial<SearchDependencies> = {},
) {
  const dependencies = { ...defaultDependencies, ...overrides };

  return async function GET(request: Request): Promise<Response> {
    try {
      if (!(await dependencies.readSession())) {
        return json({ ok: false, error: "Требуется вход" }, 401);
      }
      const searchParams = new URL(request.url).searchParams;
      const query = searchParams.get("q") ?? "";
      const page = readPage(searchParams.get("page"));
      if (query.length > 120 || page === null) {
        return json({ ok: false, error: "Некорректные параметры поиска" }, 400);
      }
      const result = await dependencies.search({
        query,
        page,
        pageSize: PAGE_SIZE,
      });
      return json({ ok: true, ...result }, 200);
    } catch (error) {
      if (error instanceof FeaturedValidationError) {
        return json({ ok: false, error: "Некорректные параметры поиска" }, 400);
      }
      return json({ ok: false, error: "Сервис временно недоступен" }, 500);
    }
  };
}

export const GET = createPropertySearchHandler();
