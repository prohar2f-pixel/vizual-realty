"use client";

import Link from "next/link";
import { useEffect, useReducer, useRef, useState } from "react";
import { TeamMemberEditor } from "../../../../components/admin/TeamMemberEditor";
import { TextField } from "../../../../components/admin/TextField";
import type {
  ContentIssue,
  SiteContentV1,
  TeamMemberV1,
} from "../../../../lib/site-content/schema";
import { safeParseSiteContent } from "../../../../lib/site-content/schema";

type ContentTab = "home" | "about" | "team" | "contacts";

type ScalarPath =
  | `navigation.${keyof SiteContentV1["navigation"]}`
  | `footer.${keyof SiteContentV1["footer"]}`
  | `home.${Exclude<keyof SiteContentV1["home"], "benefits">}`
  | `about.${Exclude<
      keyof SiteContentV1["about"],
      "introduction" | "services"
    >}`
  | "team.title"
  | "team.introduction"
  | `contacts.${keyof SiteContentV1["contacts"]}`;

type MemberTextField = Exclude<keyof TeamMemberV1, "id" | "isVisible">;

type ContentEditorState = {
  draft: SiteContentV1;
  lastSavedDraft: SiteContentV1;
  dirty: boolean;
  saving: boolean;
  pendingSaveKey: string | null;
  issues: Record<string, string[]>;
  error: string;
};

type ContentEditorAction =
  | { type: "set-text"; path: ScalarPath; value: string }
  | { type: "set-introduction"; index: number; value: string }
  | { type: "add-introduction" }
  | { type: "remove-introduction"; index: number }
  | { type: "set-service"; index: number; value: string }
  | { type: "add-service" }
  | { type: "remove-service"; index: number }
  | {
      type: "set-benefit";
      index: number;
      field: "title" | "description";
      value: string;
    }
  | { type: "add-benefit" }
  | { type: "remove-benefit"; index: number }
  | { type: "add-member"; id: string }
  | { type: "move-member"; index: number; direction: -1 | 1 }
  | { type: "set-member-visible"; index: number; isVisible: boolean }
  | {
      type: "set-member-field";
      index: number;
      field: MemberTextField;
      value: string;
    }
  | { type: "reset" }
  | {
      type: "save-start";
      submittedDraft: SiteContentV1;
      submittedKey: string;
    }
  | {
      type: "save-success";
      submittedKey: string;
      content: SiteContentV1;
    }
  | {
      type: "save-error";
      submittedKey: string;
      error: string;
      issues?: ContentIssue[];
    };

function cloneContent(content: SiteContentV1) {
  return structuredClone(content);
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, stableValue(item)]),
    );
  }
  return value;
}

export function stableSerializeContent(content: SiteContentV1) {
  return JSON.stringify(stableValue(content));
}

function issueMap(issues: ContentIssue[] = []) {
  const mapped: Record<string, string[]> = {};
  for (const issue of issues) {
    mapped[issue.path] = [...(mapped[issue.path] ?? []), issue.message];
  }
  return mapped;
}

function withDraft(
  state: ContentEditorState,
  draft: SiteContentV1,
): ContentEditorState {
  return {
    ...state,
    draft,
    dirty:
      stableSerializeContent(draft) !==
      stableSerializeContent(state.lastSavedDraft),
    issues: {},
    error: "",
  };
}

function setScalarText(
  draft: SiteContentV1,
  path: ScalarPath,
  value: string,
) {
  const next = cloneContent(draft);
  const [section, field] = path.split(".") as [
    keyof SiteContentV1,
    string,
  ];
  if (section === "navigation") {
    next.navigation[field as keyof SiteContentV1["navigation"]] = value;
  } else if (section === "footer") {
    next.footer[field as keyof SiteContentV1["footer"]] = value;
  } else if (section === "home" && field !== "benefits") {
    next.home[
      field as Exclude<keyof SiteContentV1["home"], "benefits">
    ] = value;
  } else if (
    section === "about" &&
    field !== "introduction" &&
    field !== "services"
  ) {
    next.about[
      field as Exclude<
        keyof SiteContentV1["about"],
        "introduction" | "services"
      >
    ] = value;
  } else if (section === "team" && (field === "title" || field === "introduction")) {
    next.team[field] = value;
  } else if (section === "contacts") {
    next.contacts[field as keyof SiteContentV1["contacts"]] = value;
  }
  return next;
}

export function createContentEditorState(
  initialDraft: SiteContentV1,
): ContentEditorState {
  return {
    draft: cloneContent(initialDraft),
    lastSavedDraft: cloneContent(initialDraft),
    dirty: false,
    saving: false,
    pendingSaveKey: null,
    issues: {},
    error: "",
  };
}

export function contentEditorReducer(
  state: ContentEditorState,
  action: ContentEditorAction,
): ContentEditorState {
  if (
    state.saving &&
    action.type !== "save-success" &&
    action.type !== "save-error"
  ) {
    return state;
  }

  switch (action.type) {
    case "set-text":
      return withDraft(
        state,
        setScalarText(state.draft, action.path, action.value),
      );
    case "set-introduction": {
      const draft = cloneContent(state.draft);
      if (action.index < 0 || action.index >= draft.about.introduction.length) {
        return state;
      }
      draft.about.introduction[action.index] = action.value;
      return withDraft(state, draft);
    }
    case "add-introduction": {
      if (state.draft.about.introduction.length >= 12) return state;
      const draft = cloneContent(state.draft);
      draft.about.introduction.push("");
      return withDraft(state, draft);
    }
    case "remove-introduction": {
      const draft = cloneContent(state.draft);
      if (action.index < 0 || action.index >= draft.about.introduction.length) {
        return state;
      }
      draft.about.introduction.splice(action.index, 1);
      return withDraft(state, draft);
    }
    case "set-service": {
      const draft = cloneContent(state.draft);
      if (action.index < 0 || action.index >= draft.about.services.length) {
        return state;
      }
      draft.about.services[action.index] = action.value;
      return withDraft(state, draft);
    }
    case "add-service": {
      if (state.draft.about.services.length >= 12) return state;
      const draft = cloneContent(state.draft);
      draft.about.services.push("");
      return withDraft(state, draft);
    }
    case "remove-service": {
      const draft = cloneContent(state.draft);
      if (action.index < 0 || action.index >= draft.about.services.length) {
        return state;
      }
      draft.about.services.splice(action.index, 1);
      return withDraft(state, draft);
    }
    case "set-benefit": {
      const draft = cloneContent(state.draft);
      const benefit = draft.home.benefits[action.index];
      if (!benefit) return state;
      if (action.field === "title") {
        benefit.title = action.value;
      } else if (action.value) {
        benefit.description = action.value;
      } else {
        delete benefit.description;
      }
      return withDraft(state, draft);
    }
    case "add-benefit": {
      if (state.draft.home.benefits.length >= 6) return state;
      const draft = cloneContent(state.draft);
      draft.home.benefits.push({ title: "" });
      return withDraft(state, draft);
    }
    case "remove-benefit": {
      const draft = cloneContent(state.draft);
      if (action.index < 0 || action.index >= draft.home.benefits.length) {
        return state;
      }
      draft.home.benefits.splice(action.index, 1);
      return withDraft(state, draft);
    }
    case "add-member": {
      if (
        state.draft.team.members.length >= 30 ||
        state.draft.team.members.some(({ id }) => id === action.id)
      ) {
        return state;
      }
      const draft = cloneContent(state.draft);
      draft.team.members.push({
        id: action.id,
        name: "Новый сотрудник",
        isVisible: false,
      });
      return withDraft(state, draft);
    }
    case "move-member": {
      const nextIndex = action.index + action.direction;
      if (
        action.index < 0 ||
        action.index >= state.draft.team.members.length ||
        nextIndex < 0 ||
        nextIndex >= state.draft.team.members.length
      ) {
        return state;
      }
      const draft = cloneContent(state.draft);
      [draft.team.members[action.index], draft.team.members[nextIndex]] = [
        draft.team.members[nextIndex],
        draft.team.members[action.index],
      ];
      return withDraft(state, draft);
    }
    case "set-member-visible": {
      const draft = cloneContent(state.draft);
      const member = draft.team.members[action.index];
      if (!member) return state;
      member.isVisible = action.isVisible;
      return withDraft(state, draft);
    }
    case "set-member-field": {
      const draft = cloneContent(state.draft);
      const member = draft.team.members[action.index];
      if (!member) return state;
      if (action.field === "name") {
        member.name = action.value;
      } else if (action.value) {
        member[action.field] = action.value;
      } else {
        delete member[action.field];
      }
      return withDraft(state, draft);
    }
    case "reset":
      return {
        ...state,
        draft: cloneContent(state.lastSavedDraft),
        dirty: false,
        issues: {},
        error: "",
      };
    case "save-start":
      return {
        ...state,
        saving: true,
        pendingSaveKey: action.submittedKey,
        issues: {},
        error: "",
      };
    case "save-success": {
      if (state.pendingSaveKey !== action.submittedKey) return state;
      const saved = cloneContent(action.content);
      return {
        ...state,
        draft: saved,
        lastSavedDraft: cloneContent(saved),
        dirty: false,
        saving: false,
        pendingSaveKey: null,
        issues: {},
        error: "",
      };
    }
    case "save-error":
      if (state.pendingSaveKey !== action.submittedKey) return state;
      return {
        ...state,
        saving: false,
        pendingSaveKey: null,
        issues: issueMap(action.issues),
        error: action.error,
      };
  }
}

type BeforeUnloadTarget = {
  addEventListener(
    type: string,
    listener: EventListener,
    options?: boolean,
  ): void;
  removeEventListener(
    type: string,
    listener: EventListener,
    options?: boolean,
  ): void;
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

type NavigationWarningTarget = BeforeUnloadTarget;

type ClosestAnchorTarget = {
  closest(selector: string): { href?: string } | null;
};

export function registerDirtyNavigationWarning(
  target: NavigationWarningTarget,
  dirty: boolean,
  confirmLeave: () => boolean,
) {
  if (!dirty) return () => undefined;
  const listener: EventListener = (event) => {
    if (event.defaultPrevented) return;
    const mouseEvent = event as MouseEvent;
    if (
      (typeof mouseEvent.button === "number" && mouseEvent.button !== 0) ||
      mouseEvent.metaKey ||
      mouseEvent.ctrlKey ||
      mouseEvent.shiftKey ||
      mouseEvent.altKey
    ) {
      return;
    }
    const eventTarget = event.target as Partial<ClosestAnchorTarget> | null;
    const anchor = eventTarget?.closest?.("a[href]");
    if (!anchor?.href) return;
    if (!confirmLeave()) event.preventDefault();
  };
  target.addEventListener("click", listener, true);
  return () => target.removeEventListener("click", listener, true);
}

function firstIssue(
  issues: Readonly<Record<string, string[]>>,
  path: string,
) {
  return issues[path]?.[0];
}

function pathIsWithinScope(path: string, scope: string) {
  return (
    path === scope ||
    path.startsWith(`${scope}.`) ||
    path.startsWith(`${scope}[`)
  );
}

export function issueMessagesWithin(
  issues: Readonly<Record<string, string[]>>,
  scope: string,
) {
  return Array.from(
    new Set(
      Object.entries(issues).flatMap(([path, messages]) =>
        pathIsWithinScope(path, scope) ? messages : [],
      ),
    ),
  );
}

function issueMessagesForTab(
  issues: Readonly<Record<string, string[]>>,
  tab: ContentTab,
  draft: SiteContentV1,
) {
  const scopes =
    tab === "home" ? ["navigation", "footer", "home"] : [tab];
  return Array.from(
    new Set(
      Object.entries(issues).flatMap(([path, messages]) => {
        if (!scopes.some((scope) => pathIsWithinScope(path, scope))) return [];
        if (
          [
            "home.benefits",
            "about.introduction",
            "about.services",
            "team.members",
          ].some((scope) => pathIsWithinScope(path, scope))
        ) {
          return [];
        }
        const directField =
          /^(navigation|footer|home|about|team|contacts)\.([^.\[]+)$/.exec(
            path,
          );
        if (directField) {
          const section = draft[
            directField[1] as Exclude<keyof SiteContentV1, "schemaVersion">
          ] as unknown as Record<string, unknown>;
          if (typeof section[directField[2]] === "string") return [];
        }
        return messages;
      }),
    ),
  );
}

function tabForIssue(path: string): ContentTab {
  if (path.startsWith("about.")) return "about";
  if (path.startsWith("team.")) return "team";
  if (path.startsWith("contacts.")) return "contacts";
  return "home";
}

function localizedIssue(message: string) {
  const exact: Record<string, string> = {
    "must be an object": "Данные должны быть объектом.",
    "is not allowed": "Это поле не разрешено.",
    "is required": "Обязательное поле.",
    "must be a string": "Значение должно быть текстом.",
    "must not be empty": "Поле не должно быть пустым.",
    "must not contain markup or a URL scheme":
      "HTML, Markdown и ссылки с протоколом запрещены.",
    "must contain only phone characters":
      "Используйте только цифры и допустимые символы телефона.",
    "must be a valid email address": "Укажите корректный E-mail.",
    "must be a valid phone number": "Укажите корректный номер телефона.",
    "must be a Telegram username or https://t.me URL":
      "Укажите имя пользователя Telegram или ссылку t.me.",
    "must contain digits only": "Допустимы только цифры.",
    "must be a lowercase hyphenated identifier":
      "ID должен содержать строчные латинские буквы, цифры и дефисы.",
    "must be an array": "Значение должно быть списком.",
    "must be a boolean": "Выберите допустимое состояние.",
    "must equal 1": "Неподдерживаемая версия данных.",
    "must be unique": "Значение должно быть уникальным.",
    "must be unique when present": "Значение должно быть уникальным.",
    "visible members must provide a phone, email, or Telegram contact":
      "Для видимого сотрудника укажите телефон, E-mail или Telegram.",
  };
  if (exact[message]) return exact[message];
  const length = /^must be at most (\d+) characters$/.exec(message);
  if (length) return `Не более ${length[1]} символов.`;
  const items = /^must contain at most (\d+) items$/.exec(message);
  if (items) return `Не более ${items[1]} элементов.`;
  return message;
}

type SavePayload = {
  content?: unknown;
  error?: unknown;
  issues?: unknown;
};

function parseIssues(value: unknown): ContentIssue[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((issue) => {
    if (
      !issue ||
      typeof issue !== "object" ||
      Array.isArray(issue) ||
      typeof (issue as Record<string, unknown>).path !== "string" ||
      typeof (issue as Record<string, unknown>).message !== "string"
    ) {
      return [];
    }
    const record = issue as { path: string; message: string };
    return [{ path: record.path, message: localizedIssue(record.message) }];
  });
}

function Section({
  title,
  description,
  children,
}: Readonly<{
  title: string;
  description?: string;
  children: React.ReactNode;
}>) {
  return (
    <section className="rounded-xl border border-stone-200 bg-surface p-4 shadow-sm sm:p-6">
      <h2 className="font-display text-2xl font-bold text-brand">{title}</h2>
      {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      <div className="mt-5 grid gap-5 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function IssueSummary({
  scope,
  messages,
}: Readonly<{ scope: string; messages: string[] }>) {
  if (!messages.length) return null;
  return (
    <div
      role="alert"
      data-issue-scope={scope}
      className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800"
    >
      <p className="font-semibold">Проверьте этот раздел:</p>
      <ul className="mt-1 list-disc space-y-1 pl-5">
        {messages.map((message) => (
          <li key={message}>{message}</li>
        ))}
      </ul>
    </div>
  );
}

type ContentEditorProps = Readonly<{
  initialDraft: SiteContentV1;
}>;

export function ContentEditor({ initialDraft }: ContentEditorProps) {
  const [state, dispatch] = useReducer(
    contentEditorReducer,
    initialDraft,
    createContentEditorState,
  );
  const [activeTab, setActiveTab] = useState<ContentTab>("home");
  const [uploadingMembers, setUploadingMembers] = useState<Set<string>>(
    () => new Set(),
  );
  const uploadingCount = useRef(0);
  const hasUploads = uploadingMembers.size > 0;

  useEffect(
    () => registerDirtyWarning(window, state.dirty),
    [state.dirty],
  );
  useEffect(
    () =>
      registerDirtyNavigationWarning(document, state.dirty, () =>
        window.confirm("Есть несохранённые изменения. Покинуть страницу?"),
      ),
    [state.dirty],
  );

  function setText(path: ScalarPath, value: string) {
    dispatch({ type: "set-text", path, value });
  }

  function handleUploading(memberId: string, uploading: boolean) {
    uploadingCount.current = Math.max(
      0,
      uploadingCount.current + (uploading ? 1 : -1),
    );
    setUploadingMembers((current) => {
      const next = new Set(current);
      if (uploading) next.add(memberId);
      else next.delete(memberId);
      return next;
    });
  }

  async function save() {
    if (state.saving || uploadingCount.current > 0 || !state.dirty) return;
    const submittedDraft = cloneContent(state.draft);
    const submittedKey = stableSerializeContent(submittedDraft);
    dispatch({ type: "save-start", submittedDraft, submittedKey });
    try {
      const response = await fetch("/api/admin/content", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(submittedDraft),
      });
      let payload: SavePayload;
      try {
        payload = (await response.json()) as SavePayload;
      } catch {
        throw new Error("Некорректный ответ сервера");
      }
      if (!response.ok) {
        const issues = parseIssues(payload.issues);
        if (issues[0]) setActiveTab(tabForIssue(issues[0].path));
        dispatch({
          type: "save-error",
          submittedKey,
          error:
            typeof payload.error === "string"
              ? payload.error
              : issues.length
                ? "Проверьте отмеченные поля."
                : "Не удалось сохранить изменения.",
          issues,
        });
        return;
      }
      const parsedContent = safeParseSiteContent(payload.content);
      if (!parsedContent.success) {
        throw new Error("Сервер вернул некорректный черновик.");
      }
      dispatch({
        type: "save-success",
        submittedKey,
        content: parsedContent.data,
      });
    } catch (error) {
      dispatch({
        type: "save-error",
        submittedKey,
        error:
          error instanceof Error
            ? error.message
            : "Не удалось сохранить изменения.",
      });
    }
  }

  const locked = state.saving;
  const fieldIssue = (path: string) => firstIssue(state.issues, path);
  const tabs: Array<{ id: ContentTab; label: string }> = [
    { id: "home", label: "Главная" },
    { id: "about", label: "О нас" },
    { id: "team", label: "Команда" },
    { id: "contacts", label: "Контакты" },
  ];

  return (
    <div className="pb-24">
      <div
        role="tablist"
        aria-label="Разделы текстов сайта"
        className="mb-6 flex gap-1 overflow-x-auto border-b border-stone-200"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            id={`content-tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`content-panel-${tab.id}`}
            disabled={locked}
            onClick={() => setActiveTab(tab.id)}
            className={`min-h-11 shrink-0 border-b-2 px-4 py-3 text-sm font-semibold transition-colors motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-50 ${
              activeTab === tab.id
                ? "border-brand text-brand"
                : "border-transparent text-muted hover:text-brand"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div
        id={`content-panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`content-tab-${activeTab}`}
        className="space-y-6"
      >
        <IssueSummary
          scope={`tab:${activeTab}`}
          messages={issueMessagesForTab(state.issues, activeTab, state.draft)}
        />
        {activeTab === "home" && (
          <>
            <Section
              title="Навигация"
              description="Подписи основных разделов сайта, до 120 символов каждая."
            >
              <TextField label="Главная" path="navigation.home" value={state.draft.navigation.home} maxLength={120} disabled={locked} issue={fieldIssue("navigation.home")} onChange={(value) => setText("navigation.home", value)} />
              <TextField label="Каталог" path="navigation.catalog" value={state.draft.navigation.catalog} maxLength={120} disabled={locked} issue={fieldIssue("navigation.catalog")} onChange={(value) => setText("navigation.catalog", value)} />
              <TextField label="О нас" path="navigation.about" value={state.draft.navigation.about} maxLength={120} disabled={locked} issue={fieldIssue("navigation.about")} onChange={(value) => setText("navigation.about", value)} />
              <TextField label="Команда" path="navigation.team" value={state.draft.navigation.team} maxLength={120} disabled={locked} issue={fieldIssue("navigation.team")} onChange={(value) => setText("navigation.team", value)} />
              <TextField label="Контакты" path="navigation.contacts" value={state.draft.navigation.contacts} maxLength={120} disabled={locked} issue={fieldIssue("navigation.contacts")} onChange={(value) => setText("navigation.contacts", value)} />
            </Section>

            <Section title="Первый экран">
              <TextField label="Надзаголовок" path="home.heroHeading" value={state.draft.home.heroHeading} maxLength={120} disabled={locked} issue={fieldIssue("home.heroHeading")} onChange={(value) => setText("home.heroHeading", value)} />
              <TextField label="Заголовок первого экрана" path="home.heroTitle" value={state.draft.home.heroTitle} maxLength={120} disabled={locked} issue={fieldIssue("home.heroTitle")} onChange={(value) => setText("home.heroTitle", value)} />
              <div className="sm:col-span-2">
                <TextField label="Описание" path="home.heroSubtitle" value={state.draft.home.heroSubtitle} maxLength={1200} multiline rows={5} disabled={locked} issue={fieldIssue("home.heroSubtitle")} onChange={(value) => setText("home.heroSubtitle", value)} />
              </div>
              <TextField label="Кнопка каталога" path="home.catalogCta" value={state.draft.home.catalogCta} maxLength={120} disabled={locked} issue={fieldIssue("home.catalogCta")} onChange={(value) => setText("home.catalogCta", value)} />
              <TextField label="Кнопка контактов" path="home.contactsCta" value={state.draft.home.contactsCta} maxLength={120} disabled={locked} issue={fieldIssue("home.contactsCta")} onChange={(value) => setText("home.contactsCta", value)} />
            </Section>

            <Section title="Избранные объекты">
              <TextField label="Заголовок блока" path="home.featuredTitle" value={state.draft.home.featuredTitle} maxLength={120} disabled={locked} issue={fieldIssue("home.featuredTitle")} onChange={(value) => setText("home.featuredTitle", value)} />
              <TextField label="Ссылка на каталог" path="home.featuredCatalogLabel" value={state.draft.home.featuredCatalogLabel} maxLength={120} disabled={locked} issue={fieldIssue("home.featuredCatalogLabel")} onChange={(value) => setText("home.featuredCatalogLabel", value)} />
              <div className="sm:col-span-2">
                <TextField label="Текст пустого блока" path="home.featuredEmptyText" value={state.draft.home.featuredEmptyText} maxLength={120} disabled={locked} issue={fieldIssue("home.featuredEmptyText")} onChange={(value) => setText("home.featuredEmptyText", value)} />
              </div>
            </Section>

            <Section
              title="Почему «Визуал»"
              description="До 6 преимуществ. Заголовки и описания — до 120 символов."
            >
              <TextField label="Заголовок блока" path="home.whyTitle" value={state.draft.home.whyTitle} maxLength={120} disabled={locked} issue={fieldIssue("home.whyTitle")} onChange={(value) => setText("home.whyTitle", value)} />
              <TextField label="Кнопка «О компании»" path="home.aboutCta" value={state.draft.home.aboutCta} maxLength={120} disabled={locked} issue={fieldIssue("home.aboutCta")} onChange={(value) => setText("home.aboutCta", value)} />
              <div className="sm:col-span-2">
                <TextField label="Вступление" path="home.whyIntroduction" value={state.draft.home.whyIntroduction} maxLength={1200} multiline rows={5} disabled={locked} issue={fieldIssue("home.whyIntroduction")} onChange={(value) => setText("home.whyIntroduction", value)} />
              </div>
              <div className="space-y-4 sm:col-span-2">
                <IssueSummary
                  scope="home.benefits"
                  messages={issueMessagesWithin(
                    state.issues,
                    "home.benefits",
                  )}
                />
                {state.draft.home.benefits.map((benefit, index) => (
                  <div key={index} className="rounded-lg border border-stone-200 p-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <TextField label={`Преимущество ${index + 1}`} path={`home.benefits[${index}].title`} value={benefit.title} maxLength={120} disabled={locked} issue={fieldIssue(`home.benefits[${index}].title`)} onChange={(value) => dispatch({ type: "set-benefit", index, field: "title", value })} />
                      <TextField label="Описание" path={`home.benefits[${index}].description`} value={benefit.description ?? ""} maxLength={120} disabled={locked} issue={fieldIssue(`home.benefits[${index}].description`)} onChange={(value) => dispatch({ type: "set-benefit", index, field: "description", value })} />
                    </div>
                    <button type="button" disabled={locked} onClick={() => dispatch({ type: "remove-benefit", index })} className="mt-3 min-h-11 rounded-lg border border-stone-300 px-4 py-2 text-sm font-semibold disabled:opacity-40">
                      Убрать преимущество {index + 1}
                    </button>
                  </div>
                ))}
                <button type="button" disabled={locked || state.draft.home.benefits.length >= 6} onClick={() => dispatch({ type: "add-benefit" })} className="min-h-11 rounded-lg border border-brand px-4 py-2 font-semibold text-brand disabled:cursor-not-allowed disabled:opacity-40">
                  Добавить преимущество
                </button>
              </div>
            </Section>

            <Section title="Статистика">
              <TextField label="Подпись" path="home.statisticLabel" value={state.draft.home.statisticLabel} maxLength={120} disabled={locked} issue={fieldIssue("home.statisticLabel")} onChange={(value) => setText("home.statisticLabel", value)} />
              <TextField label="Значение" path="home.statisticValue" value={state.draft.home.statisticValue} maxLength={120} disabled={locked} issue={fieldIssue("home.statisticValue")} onChange={(value) => setText("home.statisticValue", value)} />
              <div className="sm:col-span-2">
                <TextField label="Описание статистики" path="home.statisticDescription" value={state.draft.home.statisticDescription} maxLength={120} disabled={locked} issue={fieldIssue("home.statisticDescription")} onChange={(value) => setText("home.statisticDescription", value)} />
              </div>
            </Section>

            <Section title="Подвал" description="Контактные данные сохраняются как значения, без готовых ссылок.">
              <TextField label="Текст в подвале" path="footer.tagline" value={state.draft.footer.tagline} maxLength={120} disabled={locked} issue={fieldIssue("footer.tagline")} onChange={(value) => setText("footer.tagline", value)} />
              <TextField label="Заголовок разделов" path="footer.sectionsTitle" value={state.draft.footer.sectionsTitle} maxLength={120} disabled={locked} issue={fieldIssue("footer.sectionsTitle")} onChange={(value) => setText("footer.sectionsTitle", value)} />
              <TextField label="Подпись каталога" path="footer.catalogLabel" value={state.draft.footer.catalogLabel} maxLength={120} disabled={locked} issue={fieldIssue("footer.catalogLabel")} onChange={(value) => setText("footer.catalogLabel", value)} />
              <TextField label="Заголовок контактов" path="footer.contactsTitle" value={state.draft.footer.contactsTitle} maxLength={120} disabled={locked} issue={fieldIssue("footer.contactsTitle")} onChange={(value) => setText("footer.contactsTitle", value)} />
              <TextField label="Адрес" path="footer.address" value={state.draft.footer.address} maxLength={120} disabled={locked} issue={fieldIssue("footer.address")} onChange={(value) => setText("footer.address", value)} />
              <TextField label="Телефон" path="footer.phone" value={state.draft.footer.phone} maxLength={32} type="tel" disabled={locked} issue={fieldIssue("footer.phone")} help="Номер телефона, без tel:." onChange={(value) => setText("footer.phone", value)} />
              <TextField label="E-mail" path="footer.email" value={state.draft.footer.email} maxLength={120} type="email" disabled={locked} issue={fieldIssue("footer.email")} help="Адрес, без mailto:." onChange={(value) => setText("footer.email", value)} />
              <TextField label="Копирайт" path="footer.copyright" value={state.draft.footer.copyright} maxLength={120} disabled={locked} issue={fieldIssue("footer.copyright")} onChange={(value) => setText("footer.copyright", value)} />
            </Section>
          </>
        )}

        {activeTab === "about" && (
          <>
            <Section title="О нас">
              <TextField label="Заголовок страницы" path="about.title" value={state.draft.about.title} maxLength={120} disabled={locked} issue={fieldIssue("about.title")} onChange={(value) => setText("about.title", value)} />
              <TextField label="Заголовок услуг" path="about.servicesTitle" value={state.draft.about.servicesTitle} maxLength={120} disabled={locked} issue={fieldIssue("about.servicesTitle")} onChange={(value) => setText("about.servicesTitle", value)} />
              <div className="sm:col-span-2">
                <TextField label="Заключительный текст" path="about.closingText" value={state.draft.about.closingText} maxLength={1200} multiline rows={5} disabled={locked} issue={fieldIssue("about.closingText")} onChange={(value) => setText("about.closingText", value)} />
              </div>
              <TextField label="Кнопка команды" path="about.teamCta" value={state.draft.about.teamCta} maxLength={120} disabled={locked} issue={fieldIssue("about.teamCta")} onChange={(value) => setText("about.teamCta", value)} />
              <TextField label="Текст о команде" path="about.teamCtaText" value={state.draft.about.teamCtaText} maxLength={1200} multiline rows={4} disabled={locked} issue={fieldIssue("about.teamCtaText")} onChange={(value) => setText("about.teamCtaText", value)} />
            </Section>

            <Section title="Вступление" description="До 12 абзацев, каждый до 1200 символов.">
              <div className="space-y-4 sm:col-span-2">
                <IssueSummary
                  scope="about.introduction"
                  messages={issueMessagesWithin(
                    state.issues,
                    "about.introduction",
                  )}
                />
                {state.draft.about.introduction.map((paragraph, index) => (
                  <div key={index} className="rounded-lg border border-stone-200 p-4">
                    <TextField label={`Абзац ${index + 1}`} path={`about.introduction[${index}]`} value={paragraph} maxLength={1200} multiline rows={4} disabled={locked} issue={fieldIssue(`about.introduction[${index}]`)} onChange={(value) => dispatch({ type: "set-introduction", index, value })} />
                    <button type="button" disabled={locked} onClick={() => dispatch({ type: "remove-introduction", index })} className="mt-3 min-h-11 rounded-lg border border-stone-300 px-4 py-2 text-sm font-semibold disabled:opacity-40">
                      Убрать абзац {index + 1}
                    </button>
                  </div>
                ))}
                <button type="button" disabled={locked || state.draft.about.introduction.length >= 12} onClick={() => dispatch({ type: "add-introduction" })} className="min-h-11 rounded-lg border border-brand px-4 py-2 font-semibold text-brand disabled:opacity-40">
                  Добавить абзац
                </button>
              </div>
            </Section>

            <Section title="Услуги" description="До 12 пунктов, каждый до 1200 символов.">
              <div className="space-y-4 sm:col-span-2">
                <IssueSummary
                  scope="about.services"
                  messages={issueMessagesWithin(
                    state.issues,
                    "about.services",
                  )}
                />
                {state.draft.about.services.map((service, index) => (
                  <div key={index} className="rounded-lg border border-stone-200 p-4">
                    <TextField label={`Услуга ${index + 1}`} path={`about.services[${index}]`} value={service} maxLength={1200} multiline rows={3} disabled={locked} issue={fieldIssue(`about.services[${index}]`)} onChange={(value) => dispatch({ type: "set-service", index, value })} />
                    <button type="button" disabled={locked} onClick={() => dispatch({ type: "remove-service", index })} className="mt-3 min-h-11 rounded-lg border border-stone-300 px-4 py-2 text-sm font-semibold disabled:opacity-40">
                      Убрать услугу {index + 1}
                    </button>
                  </div>
                ))}
                <button type="button" disabled={locked || state.draft.about.services.length >= 12} onClick={() => dispatch({ type: "add-service" })} className="min-h-11 rounded-lg border border-brand px-4 py-2 font-semibold text-brand disabled:opacity-40">
                  Добавить услугу
                </button>
              </div>
            </Section>
          </>
        )}

        {activeTab === "team" && (
          <>
            <Section title="Страница команды">
              <TextField label="Заголовок страницы" path="team.title" value={state.draft.team.title} maxLength={120} disabled={locked} issue={fieldIssue("team.title")} onChange={(value) => setText("team.title", value)} />
              <TextField label="Вступление" path="team.introduction" value={state.draft.team.introduction} maxLength={1200} multiline rows={4} disabled={locked} issue={fieldIssue("team.introduction")} onChange={(value) => setText("team.introduction", value)} />
            </Section>
            <section aria-labelledby="team-members-heading">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 id="team-members-heading" className="font-display text-2xl font-bold text-brand">
                    Сотрудники
                  </h2>
                  <p className="mt-1 text-sm text-muted">
                    До 30 карточек. Сотрудников можно скрывать и восстанавливать, но не удалять.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={locked || hasUploads || state.draft.team.members.length >= 30}
                  onClick={() => dispatch({ type: "add-member", id: crypto.randomUUID() })}
                  className="min-h-11 rounded-lg bg-brand px-5 py-3 font-semibold text-on-brand disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Добавить сотрудника
                </button>
              </div>
              {fieldIssue("team.members") && (
                <p role="alert" className="mt-3 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
                  {fieldIssue("team.members")}
                </p>
              )}
              <div className="mt-4 space-y-4">
                {state.draft.team.members.map((member, index) => (
                  <TeamMemberEditor
                    key={member.id}
                    member={member}
                    index={index}
                    total={state.draft.team.members.length}
                    issues={state.issues}
                    disabled={locked || hasUploads}
                    onChange={(field, value) => dispatch({ type: "set-member-field", index, field, value })}
                    onMove={(direction) => dispatch({ type: "move-member", index, direction })}
                    onVisibilityChange={(isVisible) => dispatch({ type: "set-member-visible", index, isVisible })}
                    onUploadingChange={(_memberIndex, uploading) => handleUploading(member.id, uploading)}
                  />
                ))}
              </div>
            </section>
          </>
        )}

        {activeTab === "contacts" && (
          <Section title="Контакты" description="Телефон и E-mail сохраняются как значения, без tel: и mailto:.">
            <TextField label="Заголовок страницы" path="contacts.title" value={state.draft.contacts.title} maxLength={120} disabled={locked} issue={fieldIssue("contacts.title")} onChange={(value) => setText("contacts.title", value)} />
            <TextField label="Заголовок менеджеров" path="contacts.managersTitle" value={state.draft.contacts.managersTitle} maxLength={120} disabled={locked} issue={fieldIssue("contacts.managersTitle")} onChange={(value) => setText("contacts.managersTitle", value)} />
            <TextField label="Подпись телефона" path="contacts.phoneLabel" value={state.draft.contacts.phoneLabel} maxLength={120} disabled={locked} issue={fieldIssue("contacts.phoneLabel")} onChange={(value) => setText("contacts.phoneLabel", value)} />
            <TextField label="Подпись E-mail" path="contacts.emailLabel" value={state.draft.contacts.emailLabel} maxLength={120} disabled={locked} issue={fieldIssue("contacts.emailLabel")} onChange={(value) => setText("contacts.emailLabel", value)} />
            <TextField label="Подпись адреса" path="contacts.addressLabel" value={state.draft.contacts.addressLabel} maxLength={120} disabled={locked} issue={fieldIssue("contacts.addressLabel")} onChange={(value) => setText("contacts.addressLabel", value)} />
            <TextField label="Адрес" path="contacts.address" value={state.draft.contacts.address} maxLength={120} disabled={locked} issue={fieldIssue("contacts.address")} onChange={(value) => setText("contacts.address", value)} />
            <TextField label="Телефон" path="contacts.phone" value={state.draft.contacts.phone} maxLength={32} type="tel" autoComplete="tel" disabled={locked} issue={fieldIssue("contacts.phone")} onChange={(value) => setText("contacts.phone", value)} />
            <TextField label="E-mail" path="contacts.email" value={state.draft.contacts.email} maxLength={120} type="email" autoComplete="email" disabled={locked} issue={fieldIssue("contacts.email")} onChange={(value) => setText("contacts.email", value)} />
            <TextField label="Кнопка маршрута" path="contacts.routeCta" value={state.draft.contacts.routeCta} maxLength={120} disabled={locked} issue={fieldIssue("contacts.routeCta")} onChange={(value) => setText("contacts.routeCta", value)} />
          </Section>
        )}
      </div>

      <aside
        aria-label="Состояние черновика"
        className="sticky bottom-4 z-10 mt-8 rounded-xl border border-brand/20 bg-surface/95 p-3 shadow-lg backdrop-blur-sm sm:p-4"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div aria-live="polite">
            <p className="font-semibold text-brand">
              {state.saving
                ? "Сохраняем черновик…"
                : hasUploads
                  ? "Загружаем фотографию…"
                  : state.dirty
                    ? "Есть изменения"
                    : "Черновик сохранён"}
            </p>
            {state.error && (
              <p role="alert" className="mt-1 text-sm font-medium text-red-700">
                {state.error}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/preview"
              className="inline-flex min-h-11 items-center rounded-lg border border-stone-300 px-4 py-2 text-sm font-semibold text-brand"
            >
              Предпросмотр
            </Link>
            <button
              type="button"
              disabled={!state.dirty || locked || hasUploads}
              onClick={() => dispatch({ type: "reset" })}
              className="min-h-11 rounded-lg border border-stone-300 px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40"
            >
              Отменить изменения
            </button>
            <button
              type="button"
              disabled={!state.dirty || locked || hasUploads}
              onClick={() => void save()}
              className="min-h-11 rounded-lg bg-brand px-5 py-2 font-semibold text-on-brand disabled:cursor-not-allowed disabled:opacity-50"
            >
              {state.saving ? "Сохраняем…" : "Сохранить изменения"}
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
