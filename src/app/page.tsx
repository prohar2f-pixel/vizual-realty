import Link from "next/link";
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
      <section className="bg-brand text-cream">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:py-28">
          <p className="mb-3 text-sm uppercase tracking-[0.3em] text-gold">
            агентство недвижимости
          </p>
          <h1 className="font-display text-4xl font-bold leading-tight sm:text-5xl">
            Найдём дом, в который
            <br />
            хочется возвращаться
          </h1>
          <p className="mt-5 max-w-xl text-lg text-cream/80">
            Продажа квартир и домов. Большой каталог проверенных объектов и личный
            агент на каждом этапе сделки.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="/catalog"
              className="rounded-md bg-gold px-6 py-3 font-semibold text-brand-dark transition hover:bg-gold-soft"
            >
              Смотреть каталог
            </Link>
            <Link
              href="/contacts"
              className="rounded-md border border-cream/40 px-6 py-3 font-semibold text-cream transition hover:bg-brand-light"
            >
              Связаться с нами
            </Link>
          </div>
        </div>
      </section>

      {/* Избранные объекты */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="mb-8 flex items-end justify-between">
          <h2 className="font-display text-3xl font-bold text-brand">Избранные объекты</h2>
          <Link href="/catalog" className="text-sm font-medium text-gold-deep hover:underline">
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
      <section className="bg-cream">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 md:grid-cols-2">
          <div>
            <h2 className="font-display text-3xl font-bold text-brand">Почему «Визуал»</h2>
            <p className="mt-4 text-ink/80">
              Мы помогаем покупателям и продавцам недвижимости с заботой и вниманием к
              деталям. Каждый объект проверен, а сопровождает вас опытный агент.
            </p>
            <ul className="mt-6 space-y-3 text-ink/80">
              <li className="flex gap-3">
                <span className="text-gold-deep">●</span> Большой каталог квартир и домов
              </li>
              <li className="flex gap-3">
                <span className="text-gold-deep">●</span> Личный агент на каждом объекте
              </li>
              <li className="flex gap-3">
                <span className="text-gold-deep">●</span> Честное сопровождение сделки
              </li>
            </ul>
            <Link
              href="/about"
              className="mt-6 inline-block font-medium text-gold-deep hover:underline"
            >
              Подробнее о компании →
            </Link>
          </div>
          <div className="rounded-2xl bg-brand p-10 text-cream">
            <div className="font-display text-5xl font-bold text-gold">200+</div>
            <p className="mt-2 text-cream/80">активных объектов в продаже</p>
          </div>
        </div>
      </section>
    </main>
  );
}
