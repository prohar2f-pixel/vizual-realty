import { db } from "@/lib/db";
import { PropertyCard } from "@/components/PropertyCard";
import { CatalogFilters } from "@/components/CatalogFilters";
import { resolveManager } from "@/lib/manager-profiles";
import { normalizeStoredPropertyDistrict } from "@/lib/property-content";
import {
  buildCatalogWhere,
  type CatalogSearchParams,
} from "@/lib/catalog-filters";

export const dynamic = "force-dynamic";

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<CatalogSearchParams>;
}) {
  const sp = await searchParams;

  const where = buildCatalogWhere(sp);

  const [items, cityRows, districtRows, totalItems] = await Promise.all([
    db.property.findMany({ where, orderBy: { updatedAt: "desc" }, include: { agent: true } }),
    db.property.findMany({
      where: { isFeed: true, city: { not: null } },
      select: { city: true },
      distinct: ["city"],
    }),
    sp.city
      ? db.property.findMany({
          where: { isFeed: true, city: sp.city, district: { not: null } },
          select: { district: true },
          distinct: ["district"],
        })
      : Promise.resolve([]),
    db.property.count({ where: { isFeed: true } }),
  ]);
  const cities = [...new Set(cityRows.map((row) => row.city?.trim()).filter(Boolean))]
    .filter((city): city is string => Boolean(city))
    .sort((left, right) => left.localeCompare(right, "ru"));
  const districts = [
    ...new Set(
      districtRows
        .map((row) => normalizeStoredPropertyDistrict(row.district))
        .filter((district): district is string => Boolean(district)),
    ),
  ].sort((left, right) => left.localeCompare(right, "ru"));

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-3xl font-bold text-brand">Каталог объектов</h1>
        <p className="rounded-full bg-brand/10 px-4 py-2 text-sm font-semibold text-brand">
          В каталоге: {totalItems} объектов
        </p>
      </div>
      <CatalogFilters cities={cities} districts={districts} current={sp} />
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
              manager={resolveManager(p.agent)}
            />
          ))}
        </div>
      )}
    </main>
  );
}
