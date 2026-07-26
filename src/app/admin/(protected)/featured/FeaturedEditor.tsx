"use client";

import { useEffect, useReducer } from "react";
import { formatPrice } from "../../../../lib/format";
import type {
  AdminFeaturedPropertyCardData,
  PropertyCardData,
  PropertySearchResult,
} from "../../../../lib/featured";

type EditorState = {
  selected: AdminFeaturedPropertyCardData[];
  savedIds: string[];
  results: PropertyCardData[];
  query: string;
  activeQuery: string;
  page: number;
  total: number;
  pageSize: number;
  searching: boolean;
  saving: boolean;
  pendingSaveIds: string[] | null;
  error: string;
  dirty: boolean;
};

type EditorAction =
  | { type: "move"; id: string; direction: -1 | 1 }
  | { type: "remove"; id: string }
  | { type: "add"; item: PropertyCardData }
  | { type: "set-query"; query: string }
  | { type: "search-start"; query: string }
  | { type: "search-success"; result: PropertySearchResult }
  | { type: "search-error"; error: string }
  | { type: "save-start"; submittedIds: string[] }
  | {
      type: "save-success";
      submittedIds: string[];
      items: AdminFeaturedPropertyCardData[];
    }
  | { type: "save-error"; error: string };

function idsMatch(left: string[], right: string[]) {
  return (
    left.length === right.length &&
    left.every((id, index) => id === right[index])
  );
}

function withDirty(state: EditorState): EditorState {
  return {
    ...state,
    dirty: !idsMatch(
      state.selected.map(({ id }) => id),
      state.savedIds,
    ),
  };
}

export function createEditorState(
  initialItems: AdminFeaturedPropertyCardData[],
  initialSearch?: PropertySearchResult,
): EditorState {
  return {
    selected: initialItems,
    savedIds: initialItems.map(({ id }) => id),
    results: initialSearch?.items ?? [],
    query: "",
    activeQuery: "",
    page: initialSearch?.page ?? 1,
    total: initialSearch?.total ?? 0,
    pageSize: initialSearch?.pageSize ?? 20,
    searching: false,
    saving: false,
    pendingSaveIds: null,
    error: "",
    dirty: false,
  };
}

export function featuredEditorReducer(
  state: EditorState,
  action: EditorAction,
): EditorState {
  if (
    state.saving &&
    (action.type === "move" ||
      action.type === "remove" ||
      action.type === "add" ||
      action.type === "set-query" ||
      action.type === "search-start")
  ) {
    return state;
  }
  switch (action.type) {
    case "move": {
      const currentIndex = state.selected.findIndex(({ id }) => id === action.id);
      const nextIndex = currentIndex + action.direction;
      if (
        currentIndex < 0 ||
        nextIndex < 0 ||
        nextIndex >= state.selected.length
      ) {
        return state;
      }
      const selected = [...state.selected];
      [selected[currentIndex], selected[nextIndex]] = [
        selected[nextIndex],
        selected[currentIndex],
      ];
      return withDirty({ ...state, selected, error: "" });
    }
    case "remove":
      return withDirty({
        ...state,
        selected: state.selected.filter(({ id }) => id !== action.id),
        error: "",
      });
    case "add":
      if (
        state.selected.length >= 3 ||
        state.selected.some(({ id }) => id === action.item.id)
      ) {
        return state;
      }
      return withDirty({
        ...state,
        selected: [...state.selected, { ...action.item, isFeed: true }],
        error: "",
      });
    case "set-query":
      return { ...state, query: action.query };
    case "search-start":
      return {
        ...state,
        activeQuery: action.query,
        searching: true,
        error: "",
      };
    case "search-success":
      return {
        ...state,
        results: action.result.items,
        page: action.result.page,
        total: action.result.total,
        pageSize: action.result.pageSize,
        searching: false,
      };
    case "search-error":
      return { ...state, searching: false, error: action.error };
    case "save-start":
      if (state.saving) return state;
      return {
        ...state,
        saving: true,
        pendingSaveIds: [...action.submittedIds],
        error: "",
      };
    case "save-success": {
      if (
        !state.pendingSaveIds ||
        !idsMatch(state.pendingSaveIds, action.submittedIds)
      ) {
        return state;
      }
      return {
        ...state,
        selected: action.items,
        savedIds: action.items.map(({ id }) => id),
        saving: false,
        pendingSaveIds: null,
        error: "",
        dirty: false,
      };
    }
    case "save-error":
      return {
        ...state,
        saving: false,
        pendingSaveIds: null,
        error: action.error,
      };
  }
}

export function buildPropertySearchUrl(query: string, page: number) {
  const params = new URLSearchParams({ q: query, page: String(page) });
  return `/api/admin/properties?${params.toString()}`;
}

type BeforeUnloadTarget = {
  addEventListener(type: string, listener: EventListener): void;
  removeEventListener(type: string, listener: EventListener): void;
};

export function registerDirtyWarning(
  target: BeforeUnloadTarget,
  dirty: boolean,
) {
  if (!dirty) return () => undefined;
  const listener: EventListener = (event) => {
    event.preventDefault();
    (event as BeforeUnloadEvent).returnValue = "";
  };
  target.addEventListener("beforeunload", listener);
  return () => target.removeEventListener("beforeunload", listener);
}

type ErrorPayload = { error?: unknown };

async function errorMessage(response: Response, fallback: string) {
  try {
    const payload = (await response.json()) as ErrorPayload;
    return typeof payload.error === "string" ? payload.error : fallback;
  } catch {
    return fallback;
  }
}

function PropertySummary({ item }: { item: PropertyCardData }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="h-16 w-20 shrink-0 overflow-hidden rounded-lg bg-stone-100">
        {item.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="h-full w-full object-cover" src={item.photo} alt="" />
        ) : (
          <span className="flex h-full items-center justify-center text-xs text-muted">
            нет фото
          </span>
        )}
      </div>
      <div className="min-w-0">
        <p className="truncate font-semibold text-text">{item.title}</p>
        <p className="text-sm text-muted">
          {item.shortId ? `ID ${item.shortId} · ` : ""}
          {formatPrice(item.price)}
        </p>
        <p className="truncate text-sm text-muted">
          {[item.city, item.address].filter(Boolean).join(", ") || item.id}
        </p>
      </div>
    </div>
  );
}

function propertyControlName(item: PropertyCardData) {
  return `объект ${item.title}, ID ${item.id}`;
}

type FeaturedEditorProps = {
  initialItems: AdminFeaturedPropertyCardData[];
  initialSearch?: PropertySearchResult;
};

export function FeaturedEditor({
  initialItems,
  initialSearch,
}: FeaturedEditorProps) {
  const [state, dispatch] = useReducer(
    featuredEditorReducer,
    createEditorState(initialItems, initialSearch),
  );

  useEffect(
    () =>
      registerDirtyWarning(
        window as unknown as BeforeUnloadTarget,
        state.dirty,
      ),
    [state.dirty],
  );

  async function search(page: number, query: string = state.activeQuery) {
    if (state.saving) return;
    dispatch({ type: "search-start", query });
    try {
      const response = await fetch(buildPropertySearchUrl(query, page), {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) {
        throw new Error(
          await errorMessage(response, "Не удалось выполнить поиск объектов"),
        );
      }
      const result = (await response.json()) as PropertySearchResult;
      dispatch({ type: "search-success", result });
    } catch (error) {
      dispatch({
        type: "search-error",
        error:
          error instanceof Error
            ? error.message
            : "Не удалось выполнить поиск объектов",
      });
    }
  }

  async function save() {
    if (state.saving) return;
    const submittedIds = state.selected.map(({ id }) => id);
    dispatch({ type: "save-start", submittedIds });
    try {
      const response = await fetch("/api/admin/featured", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ ids: submittedIds }),
      });
      if (!response.ok) {
        throw new Error(
          await errorMessage(
            response,
            "Не удалось сохранить избранные объекты",
          ),
        );
      }
      const payload = (await response.json()) as {
        items: AdminFeaturedPropertyCardData[];
      };
      dispatch({ type: "save-success", submittedIds, items: payload.items });
    } catch (error) {
      dispatch({
        type: "save-error",
        error:
          error instanceof Error
            ? error.message
            : "Не удалось сохранить избранные объекты",
      });
    }
  }

  return (
    <div className="space-y-8">
      <section aria-labelledby="selected-featured-heading">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2
              id="selected-featured-heading"
              className="font-display text-2xl font-bold text-brand"
            >
              Выбранные объекты
            </h2>
            <p className="mt-1 text-sm text-muted">От одного до трёх объектов.</p>
          </div>
          <button
            type="button"
            onClick={save}
            disabled={!state.dirty || state.saving || state.selected.length === 0}
            className="min-h-11 rounded-lg bg-brand px-5 py-3 font-semibold text-on-brand disabled:cursor-not-allowed disabled:opacity-50"
          >
            {state.saving ? "Сохраняем…" : "Сохранить"}
          </button>
        </div>

        {state.dirty && (
          <p className="mt-3 rounded-lg border border-accent/40 bg-accent/10 px-4 py-3 text-sm text-accent-text">
            Есть несохранённые изменения.
          </p>
        )}
        {state.error && (
          <p
            role="alert"
            className="mt-3 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            {state.error}
          </p>
        )}

        <ol className="mt-4 space-y-3">
          {state.selected.map((item, index) => (
            <li
              key={item.id}
              className="rounded-xl border border-stone-200 bg-surface p-4 shadow-sm"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand/10 font-semibold text-brand">
                    {index + 1}
                  </span>
                  <PropertySummary item={item} />
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={state.saving || index === 0}
                    aria-label={`Переместить ${propertyControlName(item)} выше`}
                    onClick={() => dispatch({ type: "move", id: item.id, direction: -1 })}
                    className="min-h-11 rounded-lg border border-stone-300 px-4 py-2 text-sm font-semibold disabled:opacity-40"
                  >
                    Выше
                  </button>
                  <button
                    type="button"
                    disabled={
                      state.saving || index === state.selected.length - 1
                    }
                    aria-label={`Переместить ${propertyControlName(item)} ниже`}
                    onClick={() => dispatch({ type: "move", id: item.id, direction: 1 })}
                    className="min-h-11 rounded-lg border border-stone-300 px-4 py-2 text-sm font-semibold disabled:opacity-40"
                  >
                    Ниже
                  </button>
                  <button
                    type="button"
                    disabled={state.saving}
                    aria-label={`Убрать ${propertyControlName(item)} из избранного`}
                    onClick={() => dispatch({ type: "remove", id: item.id })}
                    className="min-h-11 rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-800"
                  >
                    Убрать
                  </button>
                </div>
              </div>
              {!item.isFeed && (
                <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
                  Скрыт из каталога — уберите объект перед сохранением
                </p>
              )}
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="property-search-heading">
        <h2
          id="property-search-heading"
          className="font-display text-2xl font-bold text-brand"
        >
          Добавить объект
        </h2>
        <form
          className="mt-4 flex flex-col gap-3 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            void search(1, state.query);
          }}
        >
          <label className="flex-1">
            <span className="mb-1 block text-sm font-medium text-text">
              Поиск по ID, названию, адресу или городу
            </span>
            <input
              type="search"
              maxLength={120}
              disabled={state.saving}
              value={state.query}
              onChange={(event) =>
                dispatch({ type: "set-query", query: event.currentTarget.value })
              }
              className="min-h-11 w-full rounded-lg border border-stone-300 bg-surface px-4 py-3"
            />
          </label>
          <button
            type="submit"
            disabled={state.searching || state.saving}
            className="min-h-11 self-end rounded-lg bg-brand-dim px-5 py-3 font-semibold text-on-brand disabled:opacity-50"
          >
            {state.searching ? "Ищем…" : "Найти"}
          </button>
        </form>

        <ul className="mt-4 space-y-3">
          {state.results.map((item) => {
            const alreadySelected = state.selected.some(({ id }) => id === item.id);
            return (
              <li
                key={item.id}
                className="flex flex-col gap-3 rounded-xl border border-stone-200 bg-surface p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <PropertySummary item={item} />
                <button
                  type="button"
                  disabled={
                    state.saving || state.selected.length >= 3 || alreadySelected
                  }
                  aria-label={`Добавить ${propertyControlName(item)} в избранное`}
                  onClick={() => dispatch({ type: "add", item })}
                  className="min-h-11 shrink-0 rounded-lg border border-brand px-4 py-2 font-semibold text-brand disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Добавить
                </button>
              </li>
            );
          })}
        </ul>

        {state.results.length > 0 && (
          <nav
            aria-label="Страницы результатов поиска"
            className="mt-4 flex items-center justify-between gap-3"
          >
            <button
              type="button"
              disabled={state.searching || state.saving || state.page <= 1}
              onClick={() => void search(state.page - 1, state.activeQuery)}
              className="min-h-11 rounded-lg border border-stone-300 px-4 py-2 disabled:opacity-40"
            >
              Назад
            </button>
            <span className="text-sm text-muted">Страница {state.page}</span>
            <button
              type="button"
              disabled={
                state.searching ||
                state.saving ||
                state.page * state.pageSize >= state.total
              }
              onClick={() => void search(state.page + 1, state.activeQuery)}
              className="min-h-11 rounded-lg border border-stone-300 px-4 py-2 disabled:opacity-40"
            >
              Дальше
            </button>
          </nav>
        )}
      </section>
    </div>
  );
}
