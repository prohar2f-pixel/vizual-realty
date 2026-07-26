"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { SITE_PAGES, type SitePage } from "../site-content/pages";

export type PreviewStatus = {
  draftUpdatedAt: string;
  publishedAt: string | null;
  canRollback: boolean;
};

const PAGE_LABELS: Record<SitePage, string> = {
  home: "Главная",
  about: "О нас",
  team: "Команда",
  contacts: "Контакты",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readStatus(value: unknown): PreviewStatus | undefined {
  if (!isRecord(value)) return undefined;
  const status = value.status;
  if (!isRecord(status)) return undefined;
  if (
    typeof status.draftUpdatedAt !== "string" ||
    !(typeof status.publishedAt === "string" || status.publishedAt === null) ||
    typeof status.canRollback !== "boolean"
  ) {
    return undefined;
  }
  return {
    draftUpdatedAt: status.draftUpdatedAt,
    publishedAt: status.publishedAt,
    canRollback: status.canRollback,
  };
}

function formatDate(value: string | null) {
  if (!value) return "ещё не публиковался";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "дата недоступна";
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Moscow",
  }).format(date);
}

export function PreviewBar({ page, status: initialStatus }: {
  page: SitePage;
  status: PreviewStatus;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [pending, setPending] = useState<"publish" | "rollback" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function mutate(action: "publish" | "rollback") {
    const confirmation = action === "publish"
      ? "Опубликовать текущий черновик на сайте?"
      : "Вернуть предыдущую опубликованную версию? Текущая версия останется доступна для обратного отката.";
    if (!window.confirm(confirmation)) return;

    setPending(action);
    setNotice(null);
    setError(null);
    try {
      const response = await fetch(`/api/admin/${action}`, { method: "POST" });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok || !isRecord(payload) || payload.ok !== true) {
        throw new Error("request-failed");
      }
      const nextStatus = readStatus(payload);
      if (nextStatus) setStatus(nextStatus);
      const publishedDate = nextStatus?.publishedAt;
      setNotice(
        action === "publish"
          ? `Черновик опубликован${publishedDate ? `: ${formatDate(publishedDate)}` : "."}`
          : `Предыдущая версия опубликована${publishedDate ? `: ${formatDate(publishedDate)}` : "."}`,
      );
      router.refresh();
    } catch {
      setError("Не удалось выполнить действие. Попробуйте ещё раз.");
    } finally {
      setPending(null);
    }
  }

  return (
    <aside aria-label="Управление предпросмотром" className="sticky top-0 z-40 mb-6 rounded-2xl border border-accent/40 bg-brand p-4 text-on-brand shadow-xl">
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <strong className="block font-display text-xl">Предпросмотр черновика</strong>
          <span className="text-xs text-on-brand-soft">Опубликовано: {formatDate(status.publishedAt)}</span>
        </div>
        <Link href="/admin/content" className="inline-flex min-h-11 items-center rounded-lg border border-on-brand/40 px-4 py-2 text-sm font-semibold hover:bg-on-brand/10">
          Вернуться к правкам
        </Link>
        <button type="button" disabled={pending !== null} onClick={() => mutate("publish")} className="min-h-11 rounded-lg bg-accent px-4 py-2 text-sm font-bold text-text disabled:cursor-wait disabled:opacity-60">
          {pending === "publish" ? "Публикуем…" : "Опубликовать"}
        </button>
        <button type="button" disabled={pending !== null || !status.canRollback} onClick={() => mutate("rollback")} className="min-h-11 rounded-lg border border-on-brand/40 px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50">
          {pending === "rollback" ? "Откатываем…" : "Откатить"}
        </button>
      </div>
      <nav aria-label="Страница предпросмотра" className="mt-3 flex flex-wrap gap-1">
        {SITE_PAGES.map((candidate) => (
          <Link
            key={candidate}
            href={`/admin/preview?page=${candidate}`}
            aria-current={candidate === page ? "page" : undefined}
            className="inline-flex min-h-11 items-center rounded-lg px-3 py-2 text-sm font-medium hover:bg-on-brand/10 aria-[current=page]:bg-on-brand/15"
          >
            {PAGE_LABELS[candidate]}
          </Link>
        ))}
      </nav>
      {notice ? <p role="status" className="mt-2 text-sm text-on-brand">{notice}</p> : null}
      {error ? <p role="alert" className="mt-2 text-sm text-red-200">{error}</p> : null}
    </aside>
  );
}
