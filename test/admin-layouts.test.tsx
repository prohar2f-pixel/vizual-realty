import { expect, test, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import AdminLayout from "../src/app/admin/layout";
import PublicLayout from "../src/app/(public)/layout";

vi.mock("next/font/google", () => ({
  Cormorant_Garamond: () => ({ variable: "--font-cormorant" }),
  Manrope: () => ({ variable: "--font-manrope" }),
}));

test("keeps public Header and Footer in the public root layout", () => {
  const html = renderToStaticMarkup(
    <PublicLayout>
      <h1>Публичная страница</h1>
    </PublicLayout>,
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
