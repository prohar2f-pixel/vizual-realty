type Props = { name: string; phone: string | null; photoUrl: string | null };

export function AgentCard({ name, phone, photoUrl }: Props) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-5 text-center">
      {photoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photoUrl} alt={name} className="mx-auto h-24 w-24 rounded-full object-cover" />
      )}
      <div className="mt-3 font-semibold text-text">{name}</div>
      <div className="mt-1 text-sm text-stone-500">Ваш агент</div>
      {phone && (
        <a
          href={`tel:${phone}`}
          className="mt-4 flex items-center justify-center gap-2 rounded-md bg-brand px-4 py-2 font-medium text-on-brand transition hover:bg-brand-dim"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0 1 22 16.92Z" />
          </svg>
          Позвонить
        </a>
      )}
    </div>
  );
}
