import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import {
  ManagerCard,
  type TeamManager,
} from "../src/components/TeamCarousel";
import { managers } from "../src/app/(public)/team/managers";

test("renders an e-mail action without opening a browser tab", () => {
  const manager: TeamManager = {
    id: "olga-krivutsa",
    name: "Ольга Кривуца",
    phone: "+7 (978) 059-26-69",
    phoneHref: "tel:+79780592669",
    contactUrl: "mailto:olya_malina22@mail.ru",
    contactLabel: "Написать на e-mail",
    contactExternal: false,
    photoUrl: "/managers/olga-krivutsa-card.webp",
  };

  const html = renderToStaticMarkup(<ManagerCard manager={manager} />);

  expect(html).toContain('href="mailto:olya_malina22@mail.ru"');
  expect(html).toContain("Написать на e-mail");
  expect(html).not.toContain('target="_blank"');
});

test("keeps Telegram actions external", () => {
  const manager: TeamManager = {
    id: "ayanot-elena",
    name: "Аянот Елена",
    phone: "+7 (949) 537-55-65",
    phoneHref: "tel:+79495375565",
    contactUrl: "https://t.me/Lena_Katana",
    contactLabel: "Написать в Telegram",
    contactExternal: true,
    photoUrl: "/managers/ayanot-elena-card.webp",
  };

  const html = renderToStaticMarkup(<ManagerCard manager={manager} />);

  expect(html).toContain('href="https://t.me/Lena_Katana"');
  expect(html).toContain('target="_blank"');
  expect(html).toContain('rel="noreferrer"');
});

test("Olga and Viktoria are seventh and eighth in the team carousel", () => {
  expect(managers).toHaveLength(8);
  expect(managers[6]).toMatchObject({
    name: "Ольга Кривуца",
    contactUrl: "mailto:olya_malina22@mail.ru",
    contactLabel: "Написать на e-mail",
    contactExternal: false,
  });
  expect(managers[7]).toMatchObject({
    name: "Тсаренко Виктория",
    contactUrl: "mailto:tsarenko.viktoria2000@mail.ru",
    contactLabel: "Написать на e-mail",
    contactExternal: false,
  });
});
