import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import {
  ContentEditor,
  contentEditorReducer,
  createContentEditorState,
  registerDirtyNavigationWarning,
  registerDirtyWarning,
  stableSerializeContent,
} from "../src/app/admin/(protected)/content/ContentEditor";
import { ContentPageView } from "../src/app/admin/(protected)/content/page";
import { DEFAULT_SITE_CONTENT } from "../src/lib/site-content/defaults";
import type { SiteContentV1 } from "../src/lib/site-content/schema";

function content(): SiteContentV1 {
  return structuredClone(DEFAULT_SITE_CONTENT);
}

describe("content editor state", () => {
  test("compares snapshots independently of object key order", () => {
    const draft = content();
    const reordered = {
      contacts: draft.contacts,
      team: draft.team,
      about: draft.about,
      home: draft.home,
      footer: draft.footer,
      navigation: draft.navigation,
      schemaVersion: draft.schemaVersion,
    } satisfies SiteContentV1;

    expect(stableSerializeContent(draft)).toBe(stableSerializeContent(reordered));
    expect(createContentEditorState(reordered).dirty).toBe(false);
  });

  test("resets edits to the last successfully saved snapshot", () => {
    let state = createContentEditorState(content());
    state = contentEditorReducer(state, {
      type: "set-text",
      path: "home.heroTitle",
      value: "Новый заголовок",
    });
    expect(state.dirty).toBe(true);
    expect(state.draft.home.heroTitle).toBe("Новый заголовок");

    const submittedDraft = structuredClone(state.draft);
    const submittedKey = stableSerializeContent(submittedDraft);
    state = contentEditorReducer(state, {
      type: "save-start",
      submittedDraft,
      submittedKey,
    });
    state = contentEditorReducer(state, {
      type: "save-success",
      submittedKey,
      content: submittedDraft,
    });
    state = contentEditorReducer(state, {
      type: "set-text",
      path: "home.heroTitle",
      value: "Ещё один заголовок",
    });
    state = contentEditorReducer(state, { type: "reset" });

    expect(state.draft.home.heroTitle).toBe("Новый заголовок");
    expect(state.lastSavedDraft.home.heroTitle).toBe("Новый заголовок");
    expect(state.dirty).toBe(false);
  });

  test("locks edits to the submitted snapshot and ignores a stale save response", () => {
    let state = createContentEditorState(content());
    state = contentEditorReducer(state, {
      type: "set-text",
      path: "contacts.title",
      value: "Как нас найти",
    });
    const submittedDraft = structuredClone(state.draft);
    const submittedKey = stableSerializeContent(submittedDraft);
    state = contentEditorReducer(state, {
      type: "save-start",
      submittedDraft,
      submittedKey,
    });
    const savingState = state;

    state = contentEditorReducer(state, {
      type: "set-text",
      path: "contacts.title",
      value: "Потерянное изменение",
    });
    expect(state).toBe(savingState);

    state = contentEditorReducer(state, {
      type: "save-success",
      submittedKey: "stale",
      content: content(),
    });
    expect(state).toBe(savingState);

    state = contentEditorReducer(state, {
      type: "save-success",
      submittedKey,
      content: submittedDraft,
    });
    expect(state.draft.contacts.title).toBe("Как нас найти");
    expect(state.lastSavedDraft.contacts.title).toBe("Как нас найти");
    expect(state.dirty).toBe(false);
  });

  test("preserves the form and maps server issues by exact field path", () => {
    let state = createContentEditorState(content());
    state = contentEditorReducer(state, {
      type: "set-text",
      path: "contacts.email",
      value: "неверный адрес",
    });
    const submittedDraft = structuredClone(state.draft);
    const submittedKey = stableSerializeContent(submittedDraft);
    state = contentEditorReducer(state, {
      type: "save-start",
      submittedDraft,
      submittedKey,
    });
    state = contentEditorReducer(state, {
      type: "save-error",
      submittedKey,
      error: "Проверьте отмеченные поля",
      issues: [
        {
          path: "contacts.email",
          message: "must be a valid email address",
        },
      ],
    });

    expect(state.draft.contacts.email).toBe("неверный адрес");
    expect(state.lastSavedDraft.contacts.email).not.toBe("неверный адрес");
    expect(state.issues["contacts.email"]).toEqual([
      "must be a valid email address",
    ]);
    expect(state.dirty).toBe(true);
  });

  test("adds at most 30 members with generated IDs, reorders and hides without deletion", () => {
    const initial = content();
    initial.team.members = [];
    let state = createContentEditorState(initial);

    for (let index = 0; index < 31; index += 1) {
      state = contentEditorReducer(state, {
        type: "add-member",
        id: `new-member-${index}`,
      });
    }
    expect(state.draft.team.members).toHaveLength(30);
    expect(state.draft.team.members[0]).toMatchObject({
      id: "new-member-0",
      isVisible: false,
    });

    state = contentEditorReducer(state, {
      type: "move-member",
      index: 1,
      direction: -1,
    });
    expect(state.draft.team.members[0].id).toBe("new-member-1");
    state = contentEditorReducer(state, {
      type: "set-member-visible",
      index: 0,
      isVisible: true,
    });
    expect(state.draft.team.members[0].isVisible).toBe(true);
    expect(state.draft.team.members).toHaveLength(30);
  });

  test("keeps the required member name as an editable empty string", () => {
    let state = createContentEditorState(content());
    state = contentEditorReducer(state, {
      type: "set-member-field",
      index: 0,
      field: "name",
      value: "",
    });

    expect(state.draft.team.members[0]).toHaveProperty("name", "");
    expect(state.dirty).toBe(true);
  });
});

test("registers unload and client-navigation warnings only while dirty", () => {
  const unloadListeners = new Map<string, EventListener>();
  const unloadTarget = {
    addEventListener: vi.fn((name: string, listener: EventListener) => {
      unloadListeners.set(name, listener);
    }),
    removeEventListener: vi.fn((name: string) => unloadListeners.delete(name)),
  };
  const cleanUnload = registerDirtyWarning(unloadTarget, true);
  const unloadEvent = new Event("beforeunload", {
    cancelable: true,
  }) as BeforeUnloadEvent;
  unloadListeners.get("beforeunload")?.(unloadEvent);
  expect(unloadEvent.defaultPrevented).toBe(true);
  cleanUnload();

  let navigationListener: EventListener | undefined;
  let navigationCapture = false;
  let navigationReached = false;
  const navigationTarget = {
    addEventListener: vi.fn((
      _name: string,
      listener: EventListener,
      capture?: boolean,
    ) => {
      navigationListener = listener;
      navigationCapture = capture === true;
    }),
    removeEventListener: vi.fn(),
  };
  const confirmLeave = vi.fn(() => false);
  const cleanNavigation = registerDirtyNavigationWarning(
    navigationTarget,
    true,
    confirmLeave,
  );
  const event = new Event("click", { cancelable: true });
  Object.defineProperty(event, "target", {
    value: { closest: () => ({ href: "/admin/preview" }) },
  });
  if (navigationCapture) navigationListener?.(event);
  if (!event.defaultPrevented) navigationReached = true;
  if (!navigationCapture) navigationListener?.(event);
  expect(confirmLeave).toHaveBeenCalledOnce();
  expect(event.defaultPrevented).toBe(true);
  expect(navigationReached).toBe(false);
  cleanNavigation();
});

test("renders the four Russian tabs, explicit field groups and save status", () => {
  const html = renderToStaticMarkup(
    createElement(ContentEditor, { initialDraft: content() }),
  );

  for (const tab of ["Главная", "О нас", "Команда", "Контакты"]) {
    expect(html).toContain(`>${tab}<`);
  }
  expect(html).toContain("Заголовок первого экрана");
  expect(html).toContain("Текст в подвале");
  expect(html).toContain("Черновик сохранён");
  expect(html).toContain("Сохранить изменения");
  expect(html).toContain('href="/admin/preview"');
});

test("renders the protected content page heading and editor", () => {
  const html = renderToStaticMarkup(
    createElement(ContentPageView, { initialDraft: content() }),
  );

  expect(html).toContain("Тексты и команда");
  expect(html).toContain("Главная");
});
