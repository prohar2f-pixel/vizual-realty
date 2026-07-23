export const metadata = { title: "Контакты" };

const mapUrl =
  "https://yandex.ru/map-widget/v1/?mode=search&text=%D0%94%D0%BE%D0%BD%D0%B5%D1%86%D0%BA%2C%20%D1%83%D0%BB%D0%B8%D1%86%D0%B0%2050-%D0%BB%D0%B5%D1%82%D0%B8%D1%8F%20%D0%A1%D0%A1%D0%A1%D0%A0%2C%20142&z=16";

const routeUrl =
  "https://yandex.ru/maps/?mode=search&text=%D0%94%D0%BE%D0%BD%D0%B5%D1%86%D0%BA%2C%20%D1%83%D0%BB%D0%B8%D1%86%D0%B0%2050-%D0%BB%D0%B5%D1%82%D0%B8%D1%8F%20%D0%A1%D0%A1%D0%A1%D0%A0%2C%20142";

export default function ContactsPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="font-display text-3xl font-bold text-brand">Контакты</h1>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(280px,0.75fr)_minmax(0,1.25fr)]">
        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
          <dl className="space-y-5 text-text/80">
            <div>
              <dt className="text-sm text-stone-500">Телефон</dt>
              <dd className="mt-1 font-medium">
                <a
                  href="tel:+79898028432"
                  className="text-brand transition hover:text-accent-text"
                >
                  +7 (989) 802-84-32
                </a>
              </dd>
            </div>

            <div>
              <dt className="text-sm text-stone-500">E-mail</dt>
              <dd className="mt-1 font-medium">
                <a
                  href="mailto:milmildom@mail.ru"
                  className="text-brand transition hover:text-accent-text"
                >
                  milmildom@mail.ru
                </a>
              </dd>
            </div>

            <div>
              <dt className="text-sm text-stone-500">Адрес офиса</dt>
              <dd className="mt-1 font-medium">
                г. Донецк, ул. 50 лет СССР, 142
              </dd>
            </div>
          </dl>

          <a
            href={routeUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-8 inline-flex rounded-lg bg-brand px-5 py-3 text-sm font-semibold text-on-brand transition hover:bg-brand-dim"
          >
            Проложить маршрут
          </a>
        </div>

        <div className="min-h-[420px] overflow-hidden rounded-2xl border border-stone-200 bg-stone-100 shadow-sm">
          <iframe
            src={mapUrl}
            title="Карта проезда к офису агентства «Визуал»"
            className="h-full min-h-[420px] w-full border-0"
            loading="lazy"
            allowFullScreen
          />
        </div>
      </div>
    </main>
  );
}
