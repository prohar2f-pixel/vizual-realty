import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import ContactsPage from "../src/app/contacts/page";

test("contacts page shows Olga and Viktoria instead of a placeholder", () => {
  const html = renderToStaticMarkup(<ContactsPage />);

  expect(html).toContain("Ольга Кривуца");
  expect(html).toContain("+7 (978) 059-26-69");
  expect(html).toContain("mailto:olya_malina22@mail.ru");
  expect(html).toContain("/managers/olga-krivutsa.webp");
  expect(html).toContain("Тсаренко Виктория");
  expect(html).toContain("+7 (963) 532-80-09");
  expect(html).toContain("mailto:tsarenko.viktoria2000@mail.ru");
  expect(html).toContain("/managers/tsarenko-viktoria.webp");
  expect(html).not.toContain("Фамилия Имя");
});

test("contacts page preserves approved Telegram links", () => {
  const html = renderToStaticMarkup(<ContactsPage />);

  expect(html).toContain("https://t.me/Lena_Katana");
  expect(html).toContain("https://t.me/juliaborokha24");
});
