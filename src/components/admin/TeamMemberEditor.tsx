"use client";

import Image from "next/image";
import { useState } from "react";
import type { TeamMemberV1 } from "../../lib/site-content/schema";
import { TextField } from "./TextField";

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const LEGACY_TEAM_IMAGES: Readonly<Record<string, string>> = {
  "ayanot-elena": "/managers/ayanot-elena-card.webp",
  "banityuk-yulia": "/managers/banityuk-yulia-card.webp",
  "khadzhinova-alina": "/managers/khadzhinova-alina-card.webp",
  "borokha-yuli": "/managers/borokha-yuli-card.webp",
  "melnik-sergey": "/managers/melnik-sergey-card.webp",
  "medvedeva-elena": "/managers/medvedeva-elena-card.webp",
  "olga-krivutsa": "/managers/olga-krivutsa-card.webp",
  "tsarenko-viktoria": "/managers/tsarenko-viktoria-card.webp",
};

type FetchTeamImage = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

type UploadErrorPayload = {
  error?: unknown;
  imageId?: unknown;
  url?: unknown;
};

export function teamImagePreviewUrl(imageId: string | undefined) {
  if (!imageId) return undefined;
  if (UUID_V4.test(imageId)) return `/api/team-images/${imageId}`;
  return LEGACY_TEAM_IMAGES[imageId];
}

export async function uploadTeamImage(
  file: File,
  request: FetchTeamImage = fetch,
) {
  const form = new FormData();
  form.set("file", file);
  const response = await request("/api/admin/team-images", {
    method: "POST",
    credentials: "same-origin",
    headers: { Accept: "application/json" },
    body: form,
  });

  let payload: UploadErrorPayload;
  try {
    payload = (await response.json()) as UploadErrorPayload;
  } catch {
    throw new Error("Некорректный ответ сервера");
  }
  if (!response.ok) {
    throw new Error(
      typeof payload.error === "string"
        ? payload.error
        : "Не удалось загрузить фотографию",
    );
  }
  if (
    typeof payload.imageId !== "string" ||
    !UUID_V4.test(payload.imageId) ||
    payload.url !== `/api/team-images/${payload.imageId}`
  ) {
    throw new Error("Некорректный ответ сервера");
  }
  return payload.imageId;
}

type MemberTextField = Exclude<keyof TeamMemberV1, "id" | "isVisible">;

type TeamMemberEditorProps = Readonly<{
  member: TeamMemberV1;
  index: number;
  total: number;
  issues: Readonly<Record<string, string[]>>;
  disabled: boolean;
  onChange: (field: MemberTextField, value: string) => void;
  onMove: (direction: -1 | 1) => void;
  onVisibilityChange: (isVisible: boolean) => void;
  onUploadingChange: (index: number, uploading: boolean) => void;
}>;

function firstIssue(
  issues: Readonly<Record<string, string[]>>,
  path: string,
) {
  return issues[path]?.[0];
}

function memberIssueMessages(
  issues: Readonly<Record<string, string[]>>,
  basePath: string,
) {
  return Array.from(
    new Set(
      Object.entries(issues).flatMap(([path, messages]) =>
        path === basePath ||
        path.startsWith(`${basePath}.`) ||
        path.startsWith(`${basePath}[`)
          ? messages
          : [],
      ),
    ),
  );
}

export function TeamMemberEditor({
  member,
  index,
  total,
  issues,
  disabled,
  onChange,
  onMove,
  onVisibilityChange,
  onUploadingChange,
}: TeamMemberEditorProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const basePath = `team.members[${index}]`;
  const displayName = member.name.trim() || `Сотрудник ${index + 1}`;
  const controlName = `сотрудника ${index + 1}: ${displayName}`;
  const previewUrl = teamImagePreviewUrl(member.imageId);
  const locked = disabled || uploading;
  const cardIssues = memberIssueMessages(issues, basePath);

  async function handleFile(file: File | undefined) {
    if (!file || locked) return;
    setUploading(true);
    setUploadError("");
    onUploadingChange(index, true);
    try {
      const imageId = await uploadTeamImage(file);
      onChange("imageId", imageId);
    } catch (error) {
      setUploadError(
        error instanceof Error
          ? error.message
          : "Не удалось загрузить фотографию",
      );
    } finally {
      setUploading(false);
      onUploadingChange(index, false);
    }
  }

  return (
    <article
      aria-labelledby={`${member.id}-heading`}
      className={`rounded-xl border bg-surface p-4 shadow-sm sm:p-5 ${
        member.isVisible ? "border-stone-200" : "border-stone-300 opacity-80"
      }`}
    >
      <header className="flex flex-col gap-3 border-b border-stone-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            Сотрудник {index + 1}
          </p>
          <h3
            id={`${member.id}-heading`}
            className="font-display text-2xl font-bold text-brand"
          >
            Сотрудник {index + 1}: {displayName}
          </h3>
          {!member.isVisible && (
            <p className="mt-1 text-sm font-semibold text-muted">
              Скрыт с сайта
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={locked || index === 0}
            aria-label={`Переместить ${controlName} выше`}
            onClick={() => onMove(-1)}
            className="min-h-11 rounded-lg border border-stone-300 px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40"
          >
            Выше
          </button>
          <button
            type="button"
            disabled={locked || index === total - 1}
            aria-label={`Переместить ${controlName} ниже`}
            onClick={() => onMove(1)}
            className="min-h-11 rounded-lg border border-stone-300 px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40"
          >
            Ниже
          </button>
          <button
            type="button"
            disabled={locked}
            aria-label={`${
              member.isVisible ? "Скрыть" : "Восстановить"
            } ${controlName}`}
            onClick={() => onVisibilityChange(!member.isVisible)}
            className="min-h-11 rounded-lg border border-brand px-4 py-2 text-sm font-semibold text-brand disabled:cursor-not-allowed disabled:opacity-40"
          >
            {member.isVisible
              ? "Скрыть сотрудника"
              : "Восстановить сотрудника"}
          </button>
        </div>
      </header>

      {cardIssues.length > 0 && (
        <div
          role="alert"
          data-issue-scope={basePath}
          className="mt-4 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-800"
        >
          <p>Проверьте карточку сотрудника:</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {cardIssues.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-5 grid gap-5 lg:grid-cols-[9rem_1fr]">
        <div>
          <p className="text-sm font-semibold text-text">Фотография</p>
          <div className="mt-1 flex h-36 w-36 items-center justify-center overflow-hidden rounded-xl border border-stone-200 bg-stone-100">
            {previewUrl ? (
              <Image
                src={previewUrl}
                alt={displayName}
                width={144}
                height={144}
                unoptimized
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="px-3 text-center text-xs text-muted">
                Фотография не выбрана
              </span>
            )}
          </div>
          <label className="mt-3 block">
            <span className="sr-only">Фотография {displayName}</span>
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
              disabled={locked}
              onChange={(event) => {
                void handleFile(event.currentTarget.files?.[0]);
                event.currentTarget.value = "";
              }}
              className="block min-h-11 w-full cursor-pointer text-xs file:mr-2 file:min-h-11 file:rounded-lg file:border file:border-brand file:bg-surface file:px-3 file:py-2 file:font-semibold file:text-brand disabled:cursor-not-allowed"
            />
          </label>
          <p className="mt-1 text-xs text-muted">
            JPG, PNG или WebP, до 10 МБ.
          </p>
          {uploading && (
            <p role="status" className="mt-2 text-sm font-medium text-brand">
              Загружаем фотографию…
            </p>
          )}
          {uploadError && (
            <p role="alert" className="mt-2 text-sm font-medium text-red-700">
              {uploadError}
            </p>
          )}
          {firstIssue(issues, `${basePath}.imageId`) && (
            <p className="mt-2 text-sm font-medium text-red-700">
              {firstIssue(issues, `${basePath}.imageId`)}
            </p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Имя"
            path={`${basePath}.name`}
            value={member.name}
            maxLength={120}
            disabled={locked}
            issue={firstIssue(issues, `${basePath}.name`)}
            help="Обязательное поле, до 120 символов."
            onChange={(value) => onChange("name", value)}
          />
          <TextField
            label="Должность"
            path={`${basePath}.role`}
            value={member.role ?? ""}
            maxLength={120}
            disabled={locked}
            issue={firstIssue(issues, `${basePath}.role`)}
            help="Необязательно, до 120 символов."
            onChange={(value) => onChange("role", value)}
          />
          <TextField
            label="Телефон"
            path={`${basePath}.phone`}
            value={member.phone ?? ""}
            maxLength={32}
            type="tel"
            autoComplete="tel"
            disabled={locked}
            issue={firstIssue(issues, `${basePath}.phone`)}
            help="Номер телефона, а не готовая ссылка."
            onChange={(value) => onChange("phone", value)}
          />
          <TextField
            label="E-mail"
            path={`${basePath}.email`}
            value={member.email ?? ""}
            maxLength={120}
            type="email"
            autoComplete="email"
            disabled={locked}
            issue={firstIssue(issues, `${basePath}.email`)}
            help="Адрес без mailto:."
            onChange={(value) => onChange("email", value)}
          />
          <TextField
            label="Telegram"
            path={`${basePath}.telegram`}
            value={member.telegram ?? ""}
            maxLength={32}
            disabled={locked}
            issue={firstIssue(issues, `${basePath}.telegram`)}
            help="Имя пользователя без @ и ссылки."
            onChange={(value) => onChange("telegram", value)}
          />
          <TextField
            label="ID сотрудника в Topnlab"
            path={`${basePath}.topnlabAgentId`}
            value={member.topnlabAgentId ?? ""}
            maxLength={32}
            disabled={locked}
            issue={firstIssue(issues, `${basePath}.topnlabAgentId`)}
            help="Необязательно, только цифры."
            onChange={(value) => onChange("topnlabAgentId", value)}
          />
        </div>
      </div>
      <p className="mt-4 text-xs text-muted">
        Для видимого сотрудника укажите хотя бы телефон, E-mail или Telegram.
      </p>
    </article>
  );
}
