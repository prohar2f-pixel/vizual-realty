import { expect, test, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AdminShell } from "../src/components/admin/AdminShell";
import robots from "../src/app/robots";
import AdminProtectedLayout, {
  metadata,
} from "../src/app/admin/(protected)/layout";
import nextConfig from "../next.config";

const requireAdminSession = vi.hoisted(() => vi.fn());

vi.mock("../src/lib/admin/request", () => ({ requireAdminSession }));

test("renders only the approved Russian admin navigation and a POST logout form", () => {
  const html = renderToStaticMarkup(
    <AdminShell>
      <h1>Рабочая область</h1>
    </AdminShell>,
  );

  const labels = ["Избранные", "Тексты", "Предпросмотр", "Выйти"];
  const positions = labels.map((label) => html.indexOf(label));

  expect(positions.every((position) => position >= 0)).toBe(true);
  expect(
    positions.every(
      (position, index) => index === 0 || position > positions[index - 1],
    ),
  ).toBe(true);
  expect(html).toContain('href="/admin/featured"');
  expect(html).toContain('href="/admin/content"');
  expect(html).toContain('href="/admin/preview?page=home"');
  expect(html).toContain('<form action="/api/admin/logout" method="post">');
  expect(html).not.toContain("Настройки");
  expect(html).not.toContain("Пользователи");
});

test("disallows admin pages and admin APIs in robots", () => {
  const result = robots();
  const rule = Array.isArray(result.rules) ? result.rules[0] : result.rules;

  expect(rule?.disallow).toEqual(expect.arrayContaining(["/admin/", "/api/admin/"]));
});

test("protects the admin route group before rendering children and marks it noindex", async () => {
  const view = await AdminProtectedLayout({ children: <h1>Защищено</h1> });

  expect(requireAdminSession).toHaveBeenCalledOnce();
  expect(renderToStaticMarkup(view)).toContain("Защищено");
  expect(metadata.robots).toEqual({ index: false, follow: false });
});

test("configures private no-store and noindex headers for admin responses", async () => {
  const headers = await nextConfig.headers?.();

  expect(headers).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        source: "/admin/:path*",
        headers: expect.arrayContaining([
          { key: "Cache-Control", value: "private, no-store" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ]),
      }),
      expect.objectContaining({
        source: "/api/admin/:path*",
        headers: expect.arrayContaining([
          { key: "Cache-Control", value: "private, no-store" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ]),
      }),
    ]),
  );
});
