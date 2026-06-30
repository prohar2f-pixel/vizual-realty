export const metadata = { title: "Контакты" };

export default function ContactsPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="font-display text-3xl font-bold text-brand">Контакты</h1>
      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <div className="rounded-xl border border-stone-200 bg-white p-6">
          <dl className="space-y-3 text-text/80">
            <div>
              <dt className="text-sm text-stone-500">Телефон</dt>
              <dd className="font-medium">______________</dd>
            </div>
            <div>
              <dt className="text-sm text-stone-500">E-mail</dt>
              <dd className="font-medium">______________</dd>
            </div>
            <div>
              <dt className="text-sm text-stone-500">Адрес офиса</dt>
              <dd className="font-medium">______________</dd>
            </div>
            <div>
              <dt className="text-sm text-stone-500">Режим работы</dt>
              <dd className="font-medium">______________</dd>
            </div>
          </dl>
          <p className="mt-4 text-sm text-stone-400">
            (Контакты — заглушки. Пришлите телефон, e-mail и адрес офиса — поставлю.)
          </p>
        </div>
        <div className="flex items-center justify-center rounded-xl border border-dashed border-stone-300 bg-bg p-6 text-center text-stone-400">
          Здесь будет карта проезда
        </div>
      </div>
    </main>
  );
}
