import { expect, test } from "vitest";

import { findManagerProfileByName, getManagerProfile, resolveManager } from "../src/lib/manager-profiles";
import { resolveTopnlabManager } from "../src/lib/topnlab/manager";
import { memberImageUrl } from "../src/components/site-content/member-view";
import type { TeamMemberV1 } from "../src/lib/site-content/schema";

test("returns Ayanot Elena's approved public profile", () => {
  expect(getManagerProfile("296892")).toMatchObject({
    id: "296892",
    name: "Аянот Елена",
  });
});

test("returns undefined for an unapproved manager ID", () => {
  expect(getManagerProfile("unknown-manager")).toBeUndefined();
});

test("finds an approved manager by the CRM full name", () => {
  expect(findManagerProfileByName("  Аянот   Елена ")).toMatchObject({ id: "296892" });
});

test("resolves the responsible Topnlab user without assigning unknown users", () => {
  expect(
    resolveTopnlabManager({ user: { agent_lastname: "Аянот", agent_name: "Елена" } }),
  ).toMatchObject({ id: "296892" });
  expect(resolveTopnlabManager({ user: { agent_lastname: "Неизвестный", agent_name: "Сотрудник" } })).toBeUndefined();
});

test("resolves the manager from Topnlab created_by", () => {
  expect(resolveTopnlabManager({ created_by: 298110 })).toMatchObject({
    id: "298110",
    name: "Хаджинова Алина",
  });
});

test("uses CRM contact fields only after an exact visible published match", () => {
  const crmPhone = "+7 (949) 555-00-00";
  const members: TeamMemberV1[] = [{
    id: "published-vitaliy",
    name: "Антонович Виталий",
    topnlabAgentId: "297092",
    isVisible: true,
  }];

  expect(
    resolveManager({
      id: "297092",
      name: "Generic CRM name",
      phone: crmPhone,
      photoUrl: "/crm/antonovich.webp",
    }, members),
  ).toEqual({
    id: "297092",
    name: "Антонович Виталий",
    phone: crmPhone,
    photo: "/crm/antonovich.webp",
  });
});

test("published manager fields override CRM fields", () => {
  const imageId = "11111111-1111-4111-8111-111111111111";
  const members: TeamMemberV1[] = [{
    id: "published-ayanot",
    name: "Опубликованная Аянот",
    phone: "+7 (949) 111-22-33",
    telegram: "published_ayanot",
    imageId,
    topnlabAgentId: "296892",
    isVisible: true,
  }];

  expect(
    resolveManager({
      id: "296892",
      name: "Generic CRM name",
      phone: null,
      photoUrl: null,
    }, members),
  ).toEqual({
    id: "296892",
    name: "Опубликованная Аянот",
    phone: "+7 (949) 111-22-33",
    telegram: "https://t.me/published_ayanot",
    photo: `/api/team-images/${imageId}`,
  });
});

test("does not expose unknown or hidden Topnlab agents as public managers", () => {
  const members: TeamMemberV1[] = [{
    id: "hidden",
    name: "Скрытый менеджер",
    phone: "+7 (949) 111-22-33",
    topnlabAgentId: "hidden-agent",
    isVisible: false,
  }];

  expect(resolveManager({
    id: "unknown-agent",
    name: "Неизвестный",
    phone: "+7 (949) 000-00-00",
    photoUrl: "/crm/unknown.webp",
  }, members)).toBeUndefined();
  expect(resolveManager({
    id: "hidden-agent",
    name: "Скрытый",
    phone: "+7 (949) 000-00-00",
    photoUrl: "/crm/hidden.webp",
  }, members)).toBeUndefined();
});

test("serves only uploaded UUIDs and allowlisted legacy manager images", () => {
  expect(memberImageUrl("ayanot-elena", "card")).toBe(
    "/managers/ayanot-elena-card.webp",
  );
  expect(memberImageUrl("unapproved-legacy-slug", "card")).toBeUndefined();
});
