import Link from "next/link";
import Image from "next/image";
import { db } from "@/lib/db";
import { PropertyCard } from "@/components/PropertyCard";

export const dynamic = "force-dynamic";

export default async function Home() {
  const featured = await db.property.findMany({
    where: { isFeed: true },
    orderBy: { price: "desc" },
    take: 3,
  });

  return (
    <main>
      {/* Геро */}
      <section className="relative min-h-[calc(100svh-73px)] overflow-hidden bg-brand text-on-brand">
        <Image
          src="/team-hero.jpeg"
          alt="Команда агентства недвижимости «Визуал»"
          fill
          priority
          unoptimized
          sizes="100vw"
          className="object-cover object-center"
        />
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-brand/75 via-brand/30 to-transparent sm:h-52" />
        <div className="absolute inset-x-0 bottom-0 h-72 bg-gradient-to-t from-brand/95 via-brand/55 to-transparent sm:h-64" />

        <div className="relative z-10 mx-auto flex min-h-[calc(100svh-73px)] w-full max-w-[1600px] flex-col justify-between px-4 py-8 sm:px-8 sm:py-10">
          <h1 className="-translate-y-3 text-center font-display text-4xl font-semibold leading-none tracking-[-0.025em] drop-shadow-lg sm:-translate-y-5 sm:text-6xl lg:text-7xl">
            Недвижимость в Донецке
          </h1>

          <div className="text-center drop-shadow-md">
            <p className="mx-auto text-base font-bold text-on-brand sm:whitespace-nowrap sm:text-sm xl:text-base 2xl:text-lg">
              Продажа квартир, домов, и земельных участков.
              <br />
              Большой каталог проверенных объектов и личный агент сопровождающий всю сделку.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-3 sm:gap-4">
              <Link
                href="/catalog"
                className="rounded-md bg-gradient-to-r from-accent to-[#e8b84d] px-8 py-4 text-base font-semibold text-text transition hover:brightness-95"
              >
                Смотреть каталог
              </Link>
              <Link
                href="/contacts"
                className="rounded-md border border-on-brand/40 px-5 py-3 text-sm font-medium text-on-brand transition hover:bg-brand-dim"
              >
                Связаться с нами
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Избранные объекты */}
      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-2">
          <h2 className="font-display text-3xl font-bold tracking-[-0.02em] text-brand">Избранные объекты</h2>
          <Link href="/catalog" className="inline-flex items-center gap-1.5 text-sm font-medium text-accent-text hover:underline">
            весь каталог
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </Link>
        </div>
        {featured.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((p) => (
              <PropertyCard
                key={p.id}
                id={p.id}
                title={p.title}
                price={p.price}
                rooms={p.rooms}
                area={p.area}
                district={p.district}
                photo={p.photos[0] ?? null}
              />
            ))}
          </div>
        ) : (
          <p className="text-stone-500">Объекты скоро появятся.</p>
        )}
      </section>

      {/* О компании */}
      <section className="bg-surface">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 py-16 md:grid-cols-2 md:py-20">
          <div>
            <h2 className="font-display text-3xl font-bold tracking-[-0.02em] text-brand sm:text-4xl">
              Почему «Визуал»
            </h2>
            <p className="mt-4 leading-relaxed text-text/70">
              Мы помогаем покупателям и продавцам недвижимости с заботой и вниманием к
              деталям. Каждый объект проверен, а сопровождает вас опытный агент.
            </p>
            <ul className="mt-8 space-y-6">
              <li className="flex items-start gap-4">
                <span className="mt-2 h-px w-8 flex-none bg-accent" />
                <div>
                  <div className="font-semibold text-text">Большой каталог</div>
                  <div className="mt-0.5 text-sm text-text/60">Более 200 проверенных квартир и домов</div>
                </div>
              </li>
              <li className="flex items-start gap-4">
                <span className="mt-2 h-px w-8 flex-none bg-accent" />
                <div>
                  <div className="font-semibold text-text">Личный агент</div>
                  <div className="mt-0.5 text-sm text-text/60">На каждом объекте — опытный специалист</div>
                </div>
              </li>
              <li className="flex items-start gap-4">
                <span className="mt-2 h-px w-8 flex-none bg-accent" />
                <div>
                  <div className="font-semibold text-text">Честная сделка</div>
                  <div className="mt-0.5 text-sm text-text/60">Сопровождаем от первого звонка до ключей</div>
                </div>
              </li>
            </ul>
            <Link
              href="/about"
              className="mt-8 inline-flex items-center gap-1.5 text-sm font-medium text-accent-text hover:underline"
            >
              Подробнее о компании
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </Link>
          </div>
          <div className="flex flex-col justify-between rounded-2xl bg-brand p-8 text-on-brand sm:p-10">
            <p className="text-[10px] uppercase tracking-[0.3em] text-on-brand-soft">
              агентство недвижимости
            </p>
            <div>
              <div className="font-display text-[6rem] font-bold leading-none text-accent-bright sm:text-[7rem]">
                200+
              </div>
              <p className="mt-3 text-sm tracking-wide text-on-brand-soft">
                активных объектов в продаже
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
