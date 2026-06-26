import { db } from "@/lib/db";
import { PropertyCard } from "@/components/PropertyCard";
import { CatalogFilters } from "@/components/CatalogFilters";

export const dynamic = "force-dynamic";

type SP = { rooms?: string; priceMax?: string; district?: string };

export default async function CatalogPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;

  const where: Record<string, unknown> = { isFeed: true };
  if (sp.rooms) where.rooms = sp.rooms === "4" ? { gte: 4 } : Number(sp.rooms);
  if (sp.priceMax) where.price = { lte: Number(sp.priceMax) };
  if (sp.district) where.district = sp.district;

  const [items, districtRows] = await Promise.all([
    db.property.findMany({ where, orderBy: { updatedAt: "desc" } }),
    db.property.findMany({
      where: { isFeed: true, district: { not: null } },
      select: { district: true },
      distinct: ["district"],
    }),
  ]);
  const districts = districtRows.map((r) => r.district!).sort();

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-6 font-display text-3xl font-bold text-brand">Каталог объектов</h1>
      <CatalogFilters districts={districts} current={sp} />
      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-stone-300 p-10 text-center text-stone-500">
          Объекты не найдены. Попробуйте изменить фильтры.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((p) => (
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
      )}
    </main>
  );
}
