import { expect, test, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import AdminLayout from "../src/app/admin/layout";
import PublicLayout from "../src/app/(public)/layout";
import { DEFAULT_SITE_CONTENT } from "../src/lib/site-content/defaults";

const getPublishedContent = vi.hoisted(() =>
  vi.fn(async () => structuredClone(DEFAULT_SITE_CONTENT)),
);

vi.mock("next/font/google", () => ({
  Cormorant_Garamond: () => ({ variable: "--font-cormorant" }),
  Manrope: () => ({ variable: "--font-manrope" }),
}));
vi.mock("../src/lib/site-content/published", () => ({ getPublishedContent }));

test("keeps public Header and Footer in the public root layout", async () => {
  const html = renderToStaticMarkup(
    await PublicLayout({ children: <h1>Публичная страница</h1> }),
  );

  expect(html).toContain("Главная");
  expect(html).toContain("Разделы");
  expect(html).toContain("Публичная страница");
});

test("omits public Header and Footer from the admin root layout", () => {
  const html = renderToStaticMarkup(
    <AdminLayout>
      <h1>Админ-страница</h1>
    </AdminLayout>,
  );

  expect(html).toContain("Админ-страница");
  expect(html).not.toContain("Главная");
  expect(html).not.toContain("Разделы");
});
