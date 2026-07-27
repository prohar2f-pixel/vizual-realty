import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import {
  ManagerCard,
  type TeamManager,
} from "../src/components/TeamCarousel";
import { toTeamManagers } from "../src/components/site-content/TeamPageView";
import { DEFAULT_SITE_CONTENT } from "../src/lib/site-content/defaults";

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

test("shows an employee description only when it is provided", () => {
  const manager: TeamManager = {
    id: "olga-krivutsa",
    name: "Ольга Кривуца",
    contactExternal: false,
    description: "Специалист по сопровождению сделок с жилой недвижимостью.",
  };

  const html = renderToStaticMarkup(<ManagerCard manager={manager} />);

  expect(html).toContain(manager.description);
  expect(html).not.toContain("Подробная информация об опыте");
});

test("does not show a legacy placeholder when an employee description is empty", () => {
  const manager: TeamManager = {
    id: "olga-krivutsa",
    name: "Ольга Кривуца",
    contactExternal: false,
  };

  const html = renderToStaticMarkup(<ManagerCard manager={manager} />);

  expect(html).not.toContain("Подробная информация об опыте");
});

test("Olga and Viktoria are seventh and eighth in the team carousel", () => {
  const managers = toTeamManagers(DEFAULT_SITE_CONTENT.team);

  expect(managers).toHaveLength(8);
  expect(managers[6]).toMatchObject({
    name: "Ольга Кривуца",
    contactUrl: "https://t.me/olyadanskaya",
  });
  expect(managers[7]).toMatchObject({
    name: "Тсаренко Виктория",
    contactUrl: "https://t.me/Vikel_22",
  });
});
