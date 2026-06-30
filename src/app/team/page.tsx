import { db } from "@/lib/db";

export const metadata = { title: "Наша команда" };
export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const agents = await db.agent.findMany({ orderBy: { name: "asc" } });

  return (
    <main className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="font-display text-3xl font-bold text-brand">Наша команда</h1>
      <p className="mt-2 text-text/70">Агенты, которые помогут с подбором и сделкой.</p>

      {agents.length > 0 ? (
        <div className="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
          {agents.map((a) => (
            <div
              key={a.id}
              className="rounded-xl border border-stone-200 bg-white p-5 text-center"
            >
              {a.photoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={a.photoUrl}
                  alt={a.name}
                  className="mx-auto h-28 w-28 rounded-full object-cover"
                />
              )}
              <div className="mt-3 font-semibold text-text">{a.name}</div>
              {a.phone && (
                <a
                  href={`tel:${a.phone}`}
                  className="mt-1 block text-sm text-accent-text hover:underline"
                >
                  {a.phone}
                </a>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-8 text-stone-500">Агенты появятся после подключения CRM.</p>
      )}
    </main>
  );
}
