// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ContentEditor } from "../src/app/admin/(protected)/content/ContentEditor";
import { DEFAULT_SITE_CONTENT } from "../src/lib/site-content/defaults";
import type { SiteContentV1 } from "../src/lib/site-content/schema";

type MountedEditor = {
  container: HTMLDivElement;
  root: Root;
};

const mounted: MountedEditor[] = [];

function content(): SiteContentV1 {
  return structuredClone(DEFAULT_SITE_CONTENT);
}

async function mountEditor(initialDraft: SiteContentV1 = content()) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  mounted.push({ container, root });
  await act(async () => {
    root.render(<ContentEditor initialDraft={initialDraft} />);
  });
  return container;
}

function button(container: ParentNode, label: string) {
  const match = Array.from(container.querySelectorAll("button")).find(
    (candidate) => candidate.textContent?.trim() === label,
  );
  if (!(match instanceof HTMLButtonElement)) {
    throw new Error(`Button not found: ${label}`);
  }
  return match;
}

function input(container: ParentNode, name: string) {
  const match = container.querySelector(`[name="${name}"]`);
  if (!(match instanceof HTMLInputElement || match instanceof HTMLTextAreaElement)) {
    throw new Error(`Input not found: ${name}`);
  }
  return match;
}

async function click(element: HTMLElement) {
  await act(async () => {
    element.click();
  });
}

async function changeValue(
  element: HTMLInputElement | HTMLTextAreaElement,
  value: string,
) {
  const prototype =
    element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(element, value);
  await act(async () => {
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
    true;
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

afterEach(async () => {
  for (const item of mounted.splice(0)) {
    await act(async () => item.root.unmount());
    item.container.remove();
  }
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

test("mounts the client editor and switches through all four tabs", async () => {
  const container = await mountEditor();

  expect(input(container, "home.heroTitle")).toBeInstanceOf(HTMLInputElement);
  await click(button(container, "О нас"));
  expect(input(container, "about.title")).toBeInstanceOf(HTMLInputElement);
  await click(button(container, "Команда"));
  expect(input(container, "team.title")).toBeInstanceOf(HTMLInputElement);
  await click(button(container, "Контакты"));
  expect(input(container, "contacts.email")).toBeInstanceOf(HTMLInputElement);
  await click(button(container, "Главная"));
  expect(input(container, "home.heroTitle")).toBeInstanceOf(HTMLInputElement);
});

test("edits and saves a complete snapshot while locking the mounted form", async () => {
  const request = deferred<Response>();
  let submitted: SiteContentV1 | undefined;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      submitted = JSON.parse(String(init?.body)) as SiteContentV1;
      return request.promise;
    }),
  );
  const container = await mountEditor();
  const heroTitle = input(container, "home.heroTitle") as HTMLInputElement;
  await changeValue(heroTitle, "Новый заголовок для сайта");

  await act(async () => {
    button(container, "Сохранить изменения").click();
    await Promise.resolve();
  });
  expect(input(container, "home.heroTitle")).toHaveProperty("disabled", true);
  expect(button(container, "Сохраняем…")).toHaveProperty("disabled", true);
  expect(submitted).toMatchObject({
    schemaVersion: 1,
    navigation: DEFAULT_SITE_CONTENT.navigation,
    footer: DEFAULT_SITE_CONTENT.footer,
    home: { heroTitle: "Новый заголовок для сайта" },
    about: DEFAULT_SITE_CONTENT.about,
    team: DEFAULT_SITE_CONTENT.team,
    contacts: DEFAULT_SITE_CONTENT.contacts,
  });
  expect(Object.keys(submitted ?? {}).sort()).toEqual([
    "about",
    "contacts",
    "footer",
    "home",
    "navigation",
    "schemaVersion",
    "team",
  ]);

  request.resolve(
    Response.json({ ok: true, content: submitted }, { status: 200 }),
  );
  await act(async () => {
    await request.promise;
    await Promise.resolve();
  });
  expect(container.textContent).toContain("Черновик сохранён");
  expect(input(container, "home.heroTitle")).toHaveProperty(
    "value",
    "Новый заголовок для сайта",
  );
});

describe.each([
  ["array", []],
  ["partial object", { schemaVersion: 1 }],
])("malformed successful payload: %s", (_label, malformedContent) => {
  test("keeps both mounted draft copies dirty and shows a safe error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          { ok: true, content: malformedContent },
          { status: 200 },
        ),
      ),
    );
    const container = await mountEditor();
    await changeValue(
      input(container, "home.heroTitle"),
      "Текст, который нельзя потерять",
    );
    await click(button(container, "Сохранить изменения"));

    expect(input(container, "home.heroTitle")).toHaveProperty(
      "value",
      "Текст, который нельзя потерять",
    );
    expect(container.textContent).toContain("Есть изменения");
    expect(container.textContent).toContain(
      "Сервер вернул некорректный черновик.",
    );
    await click(button(container, "Отменить изменения"));
    expect(input(container, "home.heroTitle")).toHaveProperty(
      "value",
      DEFAULT_SITE_CONTENT.home.heroTitle,
    );
  });
});

test("routes an exact server issue to the mounted field", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json(
        {
          ok: false,
          issues: [
            { path: "contacts.email", message: "must be a valid email address" },
          ],
        },
        { status: 400 },
      ),
    ),
  );
  const container = await mountEditor();
  await changeValue(input(container, "home.heroTitle"), "Изменённый текст");
  await click(button(container, "Сохранить изменения"));

  const email = input(container, "contacts.email");
  expect(email.getAttribute("aria-invalid")).toBe("true");
  expect(container.textContent).toContain("Укажите корректный E-mail.");
});

describe.each([
  ["home.benefits", "home.benefits", "Главная", 1],
  ["home.benefits[0]", "home.benefits", "Главная", 1],
  ["about.introduction", "about.introduction", "О нас", 1],
  ["about.services[0]", "about.services", "О нас", 2],
  ["team.members[0].id", "team.members[0]", "Команда", 1],
  ["team.members[0].isVisible", "team.members[0]", "Команда", 1],
])("structured issue %s", (path, scope, expectedTab, occurrences) => {
  test("is rendered inside its current group or member card", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          {
            ok: false,
            issues: [{ path, message: `Ошибка пути ${path}` }],
          },
          { status: 400 },
        ),
      ),
    );
    const container = await mountEditor();
    await changeValue(input(container, "home.heroTitle"), "Изменённый текст");
    await click(button(container, "Сохранить изменения"));

    expect(
      button(container, expectedTab).getAttribute("aria-selected"),
    ).toBe("true");
    const summary = container.querySelector(`[data-issue-scope="${scope}"]`);
    expect(summary?.textContent).toContain(`Ошибка пути ${path}`);
    expect(
      container.textContent?.split(`Ошибка пути ${path}`).length,
    ).toBe(occurrences + 1);
  });
});

test("locks save during an upload and preserves mounted inputs and legacy image after failure", async () => {
  const upload = deferred<Response>();
  vi.stubGlobal("fetch", vi.fn(async () => upload.promise));
  const container = await mountEditor();
  await click(button(container, "Команда"));
  const phone = input(container, "team.members[0].phone") as HTMLInputElement;
  await changeValue(phone, "+7 (949) 111-22-33");
  const oldImage = container.querySelector(
    'img[src="/managers/ayanot-elena-card.webp"]',
  );
  expect(oldImage).not.toBeNull();

  const fileInput = container.querySelector('input[type="file"]');
  if (!(fileInput instanceof HTMLInputElement)) {
    throw new Error("File input not found");
  }
  Object.defineProperty(fileInput, "files", {
    configurable: true,
    value: [new File(["image"], "employee.webp", { type: "image/webp" })],
  });
  await act(async () => {
    fileInput.dispatchEvent(new Event("change", { bubbles: true }));
  });

  expect(button(container, "Сохранить изменения")).toHaveProperty(
    "disabled",
    true,
  );
  upload.resolve(
    Response.json({ ok: false, error: "Некорректный файл" }, { status: 400 }),
  );
  await act(async () => {
    await upload.promise;
  });

  expect(input(container, "team.members[0].phone")).toHaveProperty(
    "value",
    "+7 (949) 111-22-33",
  );
  expect(
    container.querySelector('img[src="/managers/ayanot-elena-card.webp"]'),
  ).not.toBeNull();
  expect(container.textContent).toContain("Некорректный файл");
});
