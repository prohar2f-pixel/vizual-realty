import Link from "next/link";
import Image from "next/image";
import { db } from "@/lib/db";
import { PropertyCard } from "@/components/PropertyCard";
import { AnimatedLines } from "@/components/AnimatedLines";

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
      <section className="relative flex min-h-[70vh] flex-col justify-start overflow-hidden bg-brand text-on-brand">
        <Image
          src="/hero-bg.png"
          alt=""
          fill
          priority
          quality={90}
          className="object-cover object-right"
        />
        {/* mobile: сплошной оверлей; desktop: градиент, здание видно справа */}
        <div className="absolute inset-0 bg-brand/85 sm:hidden" />
        <div className="absolute inset-0 hidden sm:block bg-gradient-to-r from-brand/90 via-brand/70 to-brand/40" />
        {/* снизу заглушаем оранжевый закат */}
        <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-brand to-transparent" />
        <AnimatedLines />
        <div className="relative z-10 mx-auto w-full max-w-6xl px-4 pt-16 pb-14 sm:pt-36 sm:pb-28">
          <div className="max-w-lg">
            <p className="mb-4 flex items-center gap-2.5 text-sm uppercase tracking-[0.3em] text-accent">
              <span className="h-1.5 w-1.5 flex-none rounded-full bg-accent" />
              агентство недвижимости
            </p>
            <h1 className="font-display text-4xl font-semibold leading-[1.05] tracking-[-0.025em] sm:text-5xl">
              Найдём дом, в который хочется возвращаться
            </h1>
            <p className="mt-5 text-lg text-on-brand/75">
              Продажа квартир и домов. Большой каталог проверенных объектов и личный агент на каждом этапе сделки.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
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
          <Link href="/catalog" className="text-sm font-medium text-accent-text hover:underline">
            весь каталог →
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
              className="mt-8 inline-block text-sm font-medium text-accent-text hover:underline"
            >
              Подробнее о компании →
            </Link>
          </div>
          <div className="flex flex-col justify-between rounded-2xl bg-brand p-8 text-on-brand sm:p-10">
            <p className="text-[10px] uppercase tracking-[0.3em] text-on-brand/40">
              агентство недвижимости
            </p>
            <div>
              <div className="font-display text-[6rem] font-bold leading-none text-accent sm:text-[7rem]">
                200+
              </div>
              <p className="mt-3 text-sm tracking-wide text-on-brand/60">
                активных объектов в продаже
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
