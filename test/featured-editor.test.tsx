import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import {
  FeaturedEditor,
  buildPropertySearchUrl,
  createEditorState,
  featuredEditorReducer,
  registerDirtyWarning,
} from "../src/app/admin/(protected)/featured/FeaturedEditor";
import type { AdminFeaturedPropertyCardData } from "../src/lib/featured";
import { FeaturedPageView } from "../src/app/admin/(protected)/featured/page";

function card(
  id: string,
  overrides: Partial<AdminFeaturedPropertyCardData> = {},
): AdminFeaturedPropertyCardData {
  return {
    id,
    shortId: null,
    title: `Объект ${id}`,
    price: 5_000_000,
    rooms: 2,
    area: 54,
    city: "Донецк",
    district: "Калининский",
    address: "ул. Тестовая, 1",
    photo: null,
    agent: null,
    isFeed: true,
    ...overrides,
  };
}

describe("featured editor state", () => {
  test("moves, removes and adds cards without exceeding three or duplicating IDs", () => {
    let state = createEditorState([card("a"), card("b"), card("c")]);
    state = featuredEditorReducer(state, { type: "move", id: "b", direction: -1 });
    expect(state.selected.map((item) => item.id)).toEqual(["b", "a", "c"]);
    state = featuredEditorReducer(state, { type: "move", id: "b", direction: -1 });
    expect(state.selected.map((item) => item.id)).toEqual(["b", "a", "c"]);
    state = featuredEditorReducer(state, { type: "remove", id: "a" });
    state = featuredEditorReducer(state, { type: "add", item: card("d") });
    state = featuredEditorReducer(state, { type: "add", item: card("d") });
    state = featuredEditorReducer(state, { type: "add", item: card("e") });
    expect(state.selected.map((item) => item.id)).toEqual(["b", "c", "d"]);
    expect(state.dirty).toBe(true);
  });

  test("keeps the selected cards when saving fails", () => {
    let state = createEditorState([card("a")]);
    state = featuredEditorReducer(state, { type: "add", item: card("b") });
    state = featuredEditorReducer(state, {
      type: "save-error",
      error: "Не удалось сохранить избранные объекты",
    });

    expect(state.selected.map((item) => item.id)).toEqual(["a", "b"]);
    expect(state.error).toBe("Не удалось сохранить избранные объекты");
    expect(state.dirty).toBe(true);
  });

  test("builds a bounded encoded search URL", () => {
    expect(buildPropertySearchUrl("улица & дом", 2)).toBe(
      "/api/admin/properties?q=%D1%83%D0%BB%D0%B8%D1%86%D0%B0+%26+%D0%B4%D0%BE%D0%BC&page=2",
    );
  });

  test("keeps pagination on the last submitted query while draft input changes", () => {
    let state = createEditorState([card("a")]);
    state = featuredEditorReducer(state, { type: "set-query", query: "дом A" });
    state = featuredEditorReducer(state, {
      type: "search-start",
      query: state.query,
    });
    state = featuredEditorReducer(state, {
      type: "search-success",
      result: { items: [], total: 40, page: 1, pageSize: 20 },
    });
    state = featuredEditorReducer(state, { type: "set-query", query: "дом B" });

    expect(state.activeQuery).toBe("дом A");
    expect(buildPropertySearchUrl(state.activeQuery, 2)).toBe(
      "/api/admin/properties?q=%D0%B4%D0%BE%D0%BC+A&page=2",
    );
  });

  test("locks selection actions to the IDs submitted while saving", () => {
    let state = createEditorState([card("a"), card("b")]);
    state = featuredEditorReducer(state, { type: "remove", id: "a" });
    const submittedIds = state.selected.map(({ id }) => id);
    state = featuredEditorReducer(state, { type: "save-start", submittedIds });
    const savingState = state;

    state = featuredEditorReducer(state, { type: "add", item: card("c") });
    state = featuredEditorReducer(state, { type: "remove", id: "b" });
    state = featuredEditorReducer(state, { type: "move", id: "b", direction: 1 });
    expect(state).toBe(savingState);
    expect(state.pendingSaveIds).toEqual(["b"]);

    state = featuredEditorReducer(state, {
      type: "save-success",
      submittedIds,
      items: [card("b")],
    });
    expect(state.selected.map(({ id }) => id)).toEqual(["b"]);
    expect(state.saving).toBe(false);
  });
});

test("registers and removes beforeunload protection only while dirty", () => {
  const listeners = new Map<string, EventListener>();
  const target = {
    addEventListener: vi.fn((name: string, listener: EventListener) => {
      listeners.set(name, listener);
    }),
    removeEventListener: vi.fn((name: string) => listeners.delete(name)),
  };

  const cleanUpClean = registerDirtyWarning(target, false);
  expect(target.addEventListener).not.toHaveBeenCalled();
  cleanUpClean();

  const cleanUpDirty = registerDirtyWarning(target, true);
  const event = new Event("beforeunload", { cancelable: true }) as BeforeUnloadEvent;
  listeners.get("beforeunload")?.(event);
  expect(event.defaultPrevented).toBe(true);
  expect(target.addEventListener).toHaveBeenCalledOnce();
  cleanUpDirty();
  expect(target.removeEventListener).toHaveBeenCalledOnce();
});

test("renders three selected cards, ordering controls, search and disabled add", () => {
  const items = [card("a"), card("b"), card("c")];
  const html = renderToStaticMarkup(
    createElement(FeaturedEditor, {
      initialItems: items,
      initialSearch: {
        items: [card("available", { isFeed: true })],
        total: 1,
        page: 1,
        pageSize: 20,
      },
    }),
  );

  expect((html.match(/>Выше</g) ?? [])).toHaveLength(3);
  expect((html.match(/>Ниже</g) ?? [])).toHaveLength(3);
  expect((html.match(/>Убрать</g) ?? [])).toHaveLength(3);
  expect(html).toContain("Поиск по ID, названию, адресу или городу");
  expect(html).toMatch(/<button[^>]*disabled[^>]*>Добавить<\/button>/);
  expect(html).toContain("Сохранить");
});

test("marks a saved hidden property for explicit removal", () => {
  const html = renderToStaticMarkup(
    createElement(FeaturedEditor, {
      initialItems: [card("hidden", { isFeed: false })],
    }),
  );

  expect(html).toContain("Скрыт из каталога — уберите объект перед сохранением");
  expect(html).toContain("Убрать");
});

test("renders the protected featured page heading and editor", () => {
  const html = renderToStaticMarkup(
    createElement(FeaturedPageView, { items: [card("a")] }),
  );

  expect(html).toContain("Избранные объекты");
  expect(html).toContain("Объект a");
});
