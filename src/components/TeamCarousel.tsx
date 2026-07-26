"use client";

import { useState } from "react";

export type TeamManager = {
  id: string;
  name: string;
  phone?: string;
  phoneHref?: string;
  contactUrl?: string;
  contactLabel?: string;
  contactExternal: boolean;
  photoUrl?: string;
  description?: string;
};

export function ManagerCard({ manager }: { manager: TeamManager }) {
  const externalProps = manager.contactExternal
    ? { target: "_blank" as const, rel: "noreferrer" }
    : {};

  return (
    <article
      data-manager-id={manager.id}
      className="overflow-hidden rounded-2xl border-2 border-brand bg-white shadow-sm"
    >
      {manager.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={manager.photoUrl} alt={manager.name} className="h-80 w-full object-cover object-top" />
      ) : (
        <div className="flex h-80 items-center justify-center bg-brand/5 text-brand" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" className="h-20 w-20" stroke="currentColor" strokeWidth="1.2">
            <circle cx="12" cy="8" r="3.25" />
            <path d="M5.75 19c.55-3.35 2.75-5.25 6.25-5.25s5.7 1.9 6.25 5.25" />
          </svg>
        </div>
      )}

      <div className="p-5">
        <h2 className="font-display text-2xl font-bold text-brand">{manager.name}</h2>
        {manager.phone && manager.phoneHref ? (
          <a href={manager.phoneHref} className="mt-2 block font-semibold text-text transition hover:text-brand">{manager.phone}</a>
        ) : null}

        <div className="mt-5 rounded-xl bg-brand/5 p-4 text-sm leading-6 text-text/75">
          {manager.description ?? "Подробная информация об опыте и достижениях менеджера будет добавлена после согласования."}
        </div>

        {manager.contactUrl && manager.contactLabel ? (
          <a href={manager.contactUrl} {...externalProps} className="mt-5 inline-flex w-full justify-center rounded-lg bg-brand px-4 py-3 text-sm font-semibold text-on-brand transition hover:bg-brand-dim">{manager.contactLabel}</a>
        ) : null}
      </div>
    </article>
  );
}

function ArrowButton({
  direction,
  onClick,
  disabled = false,
  className = "",
}: {
  direction: "previous" | "next";
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  const previous = direction === "previous";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-brand text-brand transition hover:bg-brand hover:text-on-brand disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
      aria-label={previous ? "Предыдущие менеджеры" : "Следующие менеджеры"}
    >
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="2">
        <path d={previous ? "m14.5 5-7 7 7 7" : "m9.5 5 7 7-7 7"} />
      </svg>
    </button>
  );
}

export function TeamCarousel({ managers }: { managers: TeamManager[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const managerCount = managers.length;
  const safeActiveIndex = managerCount === 0 ? 0 : activeIndex % managerCount;
  const canMove = managerCount > 1;

  const move = (step: number) => {
    if (!canMove) return;
    setActiveIndex(
      (current) => (current + step + managerCount) % managerCount,
    );
  };

  const desktopManagers = Array.from(
    { length: Math.min(3, managerCount) },
    (_, offset) => managers[(safeActiveIndex + offset) % managerCount],
  );
  const desktopColumns = managerCount === 1
    ? "grid-cols-1"
    : managerCount === 2
      ? "grid-cols-2"
      : "grid-cols-3";

  if (managerCount === 0) {
    return (
      <section className="mt-8" aria-label="Менеджеры агентства">
        <p className="rounded-2xl border border-stone-200 bg-white p-6 text-text/70">
          Нет сотрудников для показа.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-8" aria-label="Менеджеры агентства">
      <div className="flex items-center justify-center gap-3 sm:gap-6 lg:hidden">
        <ArrowButton direction="previous" onClick={() => move(-1)} disabled={!canMove} />
        <div className="min-w-0 max-w-md flex-1">
          <ManagerCard manager={managers[safeActiveIndex]} />
        </div>
        <ArrowButton direction="next" onClick={() => move(1)} disabled={!canMove} />
      </div>

      <div className="hidden items-center gap-5 lg:flex">
        <ArrowButton direction="previous" onClick={() => move(-1)} disabled={!canMove} />
        <div className={`grid min-w-0 flex-1 ${desktopColumns} gap-5`}>
          {desktopManagers.map((manager) => (
            <ManagerCard key={manager.id} manager={manager} />
          ))}
        </div>
        <ArrowButton direction="next" onClick={() => move(1)} disabled={!canMove} />
      </div>

      <p className="mt-4 text-center text-sm font-medium text-text/60 lg:hidden">
        {safeActiveIndex + 1} из {managerCount}
      </p>
      <p className="mt-4 hidden text-center text-sm font-medium text-text/60 lg:block">
        Начинаем с менеджера {safeActiveIndex + 1} из {managerCount}
      </p>
    </section>
  );
}
