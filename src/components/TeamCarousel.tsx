"use client";

import { useState } from "react";

export type TeamManager = {
  name: string;
  phone: string;
  phoneHref: string;
  telegramUrl: string;
  photoUrl: string;
};

function ManagerCard({ manager }: { manager: TeamManager }) {
  return (
    <article className="overflow-hidden rounded-2xl border-2 border-brand bg-white shadow-sm">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={manager.photoUrl}
        alt={manager.name}
        className="h-80 w-full object-cover object-top"
      />

      <div className="p-5">
        <h2 className="font-display text-2xl font-bold text-brand">{manager.name}</h2>
        <a
          href={manager.phoneHref}
          className="mt-2 block font-semibold text-text transition hover:text-brand"
        >
          {manager.phone}
        </a>

        <div className="mt-5 rounded-xl bg-brand/5 p-4 text-sm leading-6 text-text/75">
          Подробная информация об опыте и достижениях менеджера будет добавлена
          после согласования.
        </div>

        <a
          href={manager.telegramUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-5 inline-flex w-full justify-center rounded-lg bg-brand px-4 py-3 text-sm font-semibold text-on-brand transition hover:bg-brand-dim"
        >
          Написать в Telegram
        </a>
      </div>
    </article>
  );
}

function ArrowButton({
  direction,
  onClick,
  className = "",
}: {
  direction: "previous" | "next";
  onClick: () => void;
  className?: string;
}) {
  const previous = direction === "previous";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-brand text-brand transition hover:bg-brand hover:text-on-brand ${className}`}
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

  const move = (step: number) => {
    setActiveIndex((current) => (current + step + managers.length) % managers.length);
  };

  const desktopManagers = [0, 1, 2].map(
    (offset) => managers[(activeIndex + offset) % managers.length],
  );

  return (
    <section className="mt-8" aria-label="Менеджеры агентства">
      <div className="flex items-center justify-center gap-3 sm:gap-6 lg:hidden">
        <ArrowButton direction="previous" onClick={() => move(-1)} />
        <div className="min-w-0 max-w-md flex-1">
          <ManagerCard manager={managers[activeIndex]} />
        </div>
        <ArrowButton direction="next" onClick={() => move(1)} />
      </div>

      <div className="hidden items-center gap-5 lg:flex">
        <ArrowButton direction="previous" onClick={() => move(-1)} />
        <div className="grid min-w-0 flex-1 grid-cols-3 gap-5">
          {desktopManagers.map((manager) => (
            <ManagerCard key={manager.name} manager={manager} />
          ))}
        </div>
        <ArrowButton direction="next" onClick={() => move(1)} />
      </div>

      <p className="mt-4 text-center text-sm font-medium text-text/60 lg:hidden">
        {activeIndex + 1} из {managers.length}
      </p>
      <p className="mt-4 hidden text-center text-sm font-medium text-text/60 lg:block">
        Начинаем с менеджера {activeIndex + 1} из {managers.length}
      </p>
    </section>
  );
}
