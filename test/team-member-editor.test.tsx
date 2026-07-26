import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import {
  TeamMemberEditor,
  teamImagePreviewUrl,
  uploadTeamImage,
} from "../src/components/admin/TeamMemberEditor";
import type { TeamMemberV1 } from "../src/lib/site-content/schema";

const UUID = "2f0aa7f4-18b8-4c44-9175-e73bb634a024";

function member(overrides: Partial<TeamMemberV1> = {}): TeamMemberV1 {
  return {
    id: "ayanot-elena",
    name: "Аянот Елена",
    phone: "+7 (949) 537-55-65",
    imageId: "ayanot-elena",
    isVisible: true,
    ...overrides,
  };
}

describe("team image handling", () => {
  test("derives previews only for canonical uploads and known legacy slugs", () => {
    expect(teamImagePreviewUrl(UUID)).toBe(`/api/team-images/${UUID}`);
    expect(teamImagePreviewUrl("ayanot-elena")).toBe(
      "/managers/ayanot-elena-card.webp",
    );
    expect(teamImagePreviewUrl("unknown-safe-slug")).toBeUndefined();
    expect(teamImagePreviewUrl("https://example.com/photo.jpg")).toBeUndefined();
    expect(teamImagePreviewUrl("../private")).toBeUndefined();
  });

  test("returns a new image ID only after a successful valid response", async () => {
    const file = new File(["image"], "manager.webp", { type: "image/webp" });
    const request = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.method).toBe("POST");
      expect(init?.body).toBeInstanceOf(FormData);
      return Response.json(
        { ok: true, imageId: UUID, url: `/api/team-images/${UUID}` },
        { status: 201 },
      );
    });

    await expect(uploadTeamImage(file, request)).resolves.toBe(UUID);
  });

  test("rejects failed or malformed uploads so the old image can be preserved", async () => {
    const file = new File(["image"], "manager.webp", { type: "image/webp" });
    const failedRequest = vi.fn(async () =>
      Response.json({ ok: false, error: "Некорректный файл" }, { status: 400 }),
    );
    const malformedRequest = vi.fn(async () =>
      Response.json(
        {
          ok: true,
          imageId: "https://example.com/photo.jpg",
          url: "https://example.com/photo.jpg",
        },
        { status: 201 },
      ),
    );

    await expect(uploadTeamImage(file, failedRequest)).rejects.toThrow(
      "Некорректный файл",
    );
    await expect(uploadTeamImage(file, malformedRequest)).rejects.toThrow(
      "Некорректный ответ сервера",
    );
  });
});

test("renders named accessible employee controls without physical deletion", () => {
  const html = renderToStaticMarkup(
    createElement(TeamMemberEditor, {
      member: member(),
      index: 0,
      total: 2,
      issues: {},
      disabled: false,
      onChange: vi.fn(),
      onMove: vi.fn(),
      onVisibilityChange: vi.fn(),
      onUploadingChange: vi.fn(),
    }),
  );

  expect(html).toContain("Сотрудник 1: Аянот Елена");
  for (const label of [
    "Имя",
    "Должность",
    "Телефон",
    "E-mail",
    "Telegram",
    "ID сотрудника в Topnlab",
    "Фотография",
  ]) {
    expect(html).toContain(label);
  }
  expect(html).toContain('alt="Аянот Елена"');
  expect(html).toContain(
    'aria-label="Переместить сотрудника 1: Аянот Елена выше"',
  );
  expect(html).toContain(
    'aria-label="Скрыть сотрудника 1: Аянот Елена"',
  );
  expect(html).toContain("Скрыть сотрудника");
  expect(html).not.toContain("Удалить сотрудника");
});

test("offers restoration for a hidden employee", () => {
  const html = renderToStaticMarkup(
    createElement(TeamMemberEditor, {
      member: member({ isVisible: false }),
      index: 0,
      total: 1,
      issues: {},
      disabled: false,
      onChange: vi.fn(),
      onMove: vi.fn(),
      onVisibilityChange: vi.fn(),
      onUploadingChange: vi.fn(),
    }),
  );

  expect(html).toContain("Восстановить сотрудника");
  expect(html).toContain(
    'aria-label="Восстановить сотрудника 1: Аянот Елена"',
  );
  expect(html).toContain("Скрыт с сайта");
});
