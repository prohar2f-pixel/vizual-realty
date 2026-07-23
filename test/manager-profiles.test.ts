import { expect, test } from "vitest";

import { getManagerProfile, resolveManager } from "../src/lib/manager-profiles";

test("returns Ayanot Elena's approved public profile", () => {
  expect(getManagerProfile("296892")).toMatchObject({
    id: "296892",
    name: "Аянот Елена",
  });
});

test("returns undefined for an unapproved manager ID", () => {
  expect(getManagerProfile("unknown-manager")).toBeUndefined();
});

test("keeps Antonovich Vitaliy's CRM contact data when no public override is approved", () => {
  const crmPhone = "+7 (949) 555-00-00";

  expect(
    resolveManager({
      id: "297092",
      name: "Generic CRM name",
      phone: crmPhone,
      photoUrl: "/crm/antonovich.webp",
    }),
  ).toEqual({
    id: "297092",
    name: "Антонович Виталий",
    phone: crmPhone,
    photo: "/crm/antonovich.webp",
  });
});

test("uses Ayanot Elena's approved Telegram URL and portrait", () => {
  expect(
    resolveManager({
      id: "296892",
      name: "Generic CRM name",
      phone: null,
      photoUrl: null,
    }),
  ).toMatchObject({
    telegram: "https://t.me/Lena_Katan",
    photo: "/managers/ayanot-elena-card.webp",
  });
});
