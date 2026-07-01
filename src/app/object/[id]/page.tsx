import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { formatPrice } from "@/lib/format";
import { AgentCard } from "@/components/AgentCard";
import { LeadForm } from "@/components/LeadForm";

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
      <a href="/catalog" className="inline-flex items-center gap-1.5 text-sm text-accent-text hover:underline">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M19 12H5M11 18l-6-6 6-6" />
        </svg>
        к каталогу
      </a>
      <h1 className="mt-3 font-display text-3xl font-bold text-brand">{p.title}</h1>
      <div className="mt-1 font-display text-2xl font-bold text-brand">{formatPrice(p.price)}</div>

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
        <div className="space-y-4">
          {p.agent && (
            <AgentCard name={p.agent.name} phone={p.agent.phone} photoUrl={p.agent.photoUrl} />
          )}
          <LeadForm objectShortId={p.shortId} objectType={p.objectType} />
        </div>
      </div>
    </main>
  );
}
