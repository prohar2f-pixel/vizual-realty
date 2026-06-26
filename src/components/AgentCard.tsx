type Props = { name: string; phone: string | null; photoUrl: string | null };

export function AgentCard({ name, phone, photoUrl }: Props) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-5 text-center">
      {photoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photoUrl} alt={name} className="mx-auto h-24 w-24 rounded-full object-cover" />
      )}
      <div className="mt-3 font-semibold text-ink">{name}</div>
      <div className="mt-1 text-sm text-stone-500">Ваш агент</div>
      {phone && (
        <a
          href={`tel:${phone}`}
          className="mt-4 block rounded-md bg-brand px-4 py-2 font-medium text-cream transition hover:bg-brand-dark"
        >
          Позвонить
        </a>
      )}
      {/* Кнопка «Написать» станет рабочей на этапе 4 (форма заявки → Topnlab) */}
      <button className="mt-2 block w-full rounded-md border border-brand px-4 py-2 font-medium text-brand transition hover:bg-cream">
        Написать
      </button>
    </div>
  );
}
