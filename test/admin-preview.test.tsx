// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import nextConfig from "../next.config";
import PreviewPage, {
  metadata,
  parsePreviewPage,
} from "../src/app/admin/(protected)/preview/page";
import { PreviewBar } from "../src/components/admin/PreviewBar";
import { SitePageRenderer } from "../src/components/site-content/SitePageRenderer";
import { DEFAULT_SITE_CONTENT } from "../src/lib/site-content/defaults";

const getDraftContent = vi.hoisted(() => vi.fn());
const getSiteContentStatus = vi.hoisted(() => vi.fn());
const refresh = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  db: { property: { findMany: vi.fn().mockResolvedValue([]) } },
}));

vi.mock("../src/components/PropertyCard", () => ({
  PropertyCard: () => null,
}));

vi.mock("../src/lib/site-content/store", () => ({
  getDraftContent,
  getSiteContentStatus,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

const mounted: Array<{ container: HTMLDivElement; root: Root }> = [];

async function mountBar(canRollback = false) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  mounted.push({ container, root });
  await act(async () => {
    root.render(
      <PreviewBar
        page="home"
        status={{
          draftUpdatedAt: "2026-07-26T08:00:00.000Z",
          publishedAt: "2026-07-25T10:30:00.000Z",
          canRollback,
        }}
      />,
    );
  });
  return container;
}

function button(container: HTMLElement, name: string) {
  const result = Array.from(container.querySelectorAll("button")).find(
    (candidate) => candidate.textContent?.includes(name),
  );
  if (!(result instanceof HTMLButtonElement)) {
    throw new Error(`Button not found: ${name}`);
  }
  return result;
}

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
    .IS_REACT_ACT_ENVIRONMENT = true;
  refresh.mockReset();
  getDraftContent.mockResolvedValue(structuredClone(DEFAULT_SITE_CONTENT));
  getSiteContentStatus.mockResolvedValue({
    draftUpdatedAt: new Date("2026-07-26T08:00:00.000Z"),
    publishedAt: new Date("2026-07-25T10:30:00.000Z"),
    canRollback: false,
  });
});

afterEach(async () => {
  for (const item of mounted.splice(0)) {
    await act(async () => item.root.unmount());
    item.container.remove();
  }
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

test("accepts only known public preview pages and defaults malformed input to home", () => {
  expect(parsePreviewPage("about")).toBe("about");
  expect(parsePreviewPage("object/secret")).toBe("home");
  expect(parsePreviewPage(["team", "contacts"])).toBe("home");
  expect(parsePreviewPage(undefined)).toBe("home");
});

test("renders the protected draft marker and selected public page from server data", async () => {
  const draft = structuredClone(DEFAULT_SITE_CONTENT);
  draft.about.title = "Черновик страницы о компании";
  getDraftContent.mockResolvedValue(draft);

  const html = renderToStaticMarkup(
    await PreviewPage({ searchParams: Promise.resolve({ page: "about" }) }),
  );

  expect(getDraftContent).toHaveBeenCalledOnce();
  expect(html).toContain("Предпросмотр черновика");
  expect(html).toContain("Черновик страницы о компании");
  expect(html).toContain('href="/admin/content"');
  expect(html).toContain("Опубликовать");
  expect(html).toContain('href="/admin/preview?page=team"');
});

test("keeps preview noindex and covered by private no-store headers", async () => {
  const headers = await nextConfig.headers?.();
  expect(metadata.robots).toEqual({ index: false, follow: false });
  expect(headers).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        source: "/admin/:path*",
        headers: expect.arrayContaining([
          { key: "Cache-Control", value: "private, no-store" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ]),
      }),
    ]),
  );
});

test("omits hidden employees and renders an empty team without a broken carousel", async () => {
  const draft = structuredClone(DEFAULT_SITE_CONTENT);
  draft.team.members[0].name = "Скрытый сотрудник";
  draft.team.members.forEach((member) => {
    member.isVisible = false;
  });

  const html = renderToStaticMarkup(
    await SitePageRenderer({ page: "team", content: draft, preview: true }),
  );

  expect(html).not.toContain("Скрытый сотрудник");
  expect(html).toContain("Нет сотрудников для показа");
  expect(html).not.toContain("NaN");
});

test("requires confirmation before publish and refreshes server status after success", async () => {
  const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
  const fetchMock = vi.fn(async () =>
    Response.json({ ok: true }, { status: 200 }),
  );
  vi.stubGlobal("fetch", fetchMock);
  const container = await mountBar();

  await act(async () => button(container, "Опубликовать").click());
  expect(fetchMock).not.toHaveBeenCalled();

  await act(async () => button(container, "Опубликовать").click());

  expect(confirm).toHaveBeenNthCalledWith(
    2,
    "Опубликовать текущий черновик на сайте?",
  );
  expect(fetchMock).toHaveBeenCalledWith("/api/admin/publish", {
    method: "POST",
  });
  expect(refresh).toHaveBeenCalledOnce();
  expect(container.textContent).toContain("Черновик опубликован");
});

test("disables unavailable rollback and locks both actions while a request is pending", async () => {
  const disabledContainer = await mountBar(false);
  expect(button(disabledContainer, "Откатить").disabled).toBe(true);

  let resolveRequest: ((response: Response) => void) | undefined;
  const pending = new Promise<Response>((resolve) => {
    resolveRequest = resolve;
  });
  vi.spyOn(window, "confirm").mockReturnValue(true);
  vi.stubGlobal("fetch", vi.fn(async () => pending));
  const container = await mountBar(true);

  await act(async () => {
    button(container, "Откатить").click();
    await Promise.resolve();
  });
  expect(button(container, "Опубликовать").disabled).toBe(true);
  expect(button(container, "Откатываем…").disabled).toBe(true);

  resolveRequest?.(Response.json({ ok: true }, { status: 200 }));
  await act(async () => {
    await pending;
    await Promise.resolve();
  });
  expect(refresh).toHaveBeenCalledOnce();
  expect(button(container, "Откатить").disabled).toBe(false);
  expect(container.textContent).toContain("Предыдущая версия опубликована");
});

test("keeps controls usable and shows only a safe Russian error after failure", async () => {
  vi.spyOn(window, "confirm").mockReturnValue(true);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json(
        { ok: false, error: "private database detail" },
        { status: 500 },
      ),
    ),
  );
  const container = await mountBar(true);

  await act(async () => button(container, "Опубликовать").click());

  expect(container.textContent).toContain(
    "Не удалось выполнить действие. Попробуйте ещё раз.",
  );
  expect(container.textContent).not.toContain("private database detail");
  expect(button(container, "Опубликовать").disabled).toBe(false);
});
