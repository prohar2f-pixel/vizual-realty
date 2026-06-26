import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { formatPrice } from "@/lib/format";
import { AgentCard } from "@/components/AgentCard";

async function getProperty(id: string) {
  return db.property.findUnique({ where: { id }, include: { agent: true } });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const p = await getProperty(id);
  if (!p) return { title: "Объект не найден" };
  return {
    title: `${p.title} — ${formatPrice(p.price)}`,
    description: p.description ?? undefined,
  };
}

export default async function ObjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await getProperty(id);
  if (!p) notFound();

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <a href="/catalog" className="text-sm text-emerald-700 hover:underline">
        ← к каталогу
      </a>
      <h1 className="mt-3 text-2xl font-bold text-stone-800">{p.title}</h1>
      <div className="mt-1 text-2xl font-semibold text-emerald-800">{formatPrice(p.price)}</div>

      {p.photos.length > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
          {p.photos.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={src}
              alt={`${p.title} — фото ${i + 1}`}
              className="aspect-[4/3] w-full rounded-lg object-cover"
            />
          ))}
        </div>
      )}

      <div className="mt-6 grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            {p.rooms != null && (
              <div>
                <dt className="text-stone-500">Комнат</dt>
                <dd className="font-medium">{p.rooms}</dd>
              </div>
            )}
            {p.area != null && (
              <div>
                <dt className="text-stone-500">Площадь</dt>
                <dd className="font-medium">{p.area} м²</dd>
              </div>
            )}
            {p.district && (
              <div>
                <dt className="text-stone-500">Район</dt>
                <dd className="font-medium">{p.district}</dd>
              </div>
            )}
            {p.address && (
              <div>
                <dt className="text-stone-500">Адрес</dt>
                <dd className="font-medium">{p.address}</dd>
              </div>
            )}
          </dl>
          {p.description && (
            <p className="mt-4 whitespace-pre-line text-stone-700">{p.description}</p>
          )}
        </div>
        <div>
          {p.agent && (
            <AgentCard name={p.agent.name} phone={p.agent.phone} photoUrl={p.agent.photoUrl} />
          )}
        </div>
      </div>
    </main>
  );
}
