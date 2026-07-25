export const metadata = { title: "Контакты" };

const mapUrl =
  "https://yandex.ru/map-widget/v1/?mode=search&text=%D0%94%D0%BE%D0%BD%D0%B5%D1%86%D0%BA%2C%20%D1%83%D0%BB%D0%B8%D1%86%D0%B0%2050-%D0%BB%D0%B5%D1%82%D0%B8%D1%8F%20%D0%A1%D0%A1%D0%A1%D0%A0%2C%20142&z=16";

const routeUrl =
  "https://yandex.ru/maps/?mode=search&text=%D0%94%D0%BE%D0%BD%D0%B5%D1%86%D0%BA%2C%20%D1%83%D0%BB%D0%B8%D1%86%D0%B0%2050-%D0%BB%D0%B5%D1%82%D0%B8%D1%8F%20%D0%A1%D0%A1%D0%A1%D0%A0%2C%20142";

type Manager = {
  id: number;
  name: string;
  phone: string;
  phoneHref?: string;
  photoUrl?: string;
  contactUrl: string;
  contactLabel: string;
  contactExternal: boolean;
};

const managers: Manager[] = [
  {
    id: 1,
    name: "Аянот Елена",
    phone: "+7 (949) 537-55-65",
    phoneHref: "tel:+79495375565",
    photoUrl: "/managers/ayanot-elena.webp",
    contactUrl: "https://t.me/Lena_Katana",
    contactLabel: "Написать менеджеру",
    contactExternal: true,
  },
  {
    id: 2,
    name: "Банитюк Юлия",
    phone: "+7 (949) 578-09-33",
    phoneHref: "tel:+79495780933",
    photoUrl: "/managers/banityuk-yulia.webp",
    contactUrl: "https://t.me/Lia_banituk",
    contactLabel: "Написать менеджеру",
    contactExternal: true,
  },
  {
    id: 3,
    name: "Хаджинова Алина",
    phone: "+7 (949) 400-92-74",
    phoneHref: "tel:+79494009274",
    photoUrl: "/managers/khadzhinova-alina.webp",
    contactUrl: "https://t.me/alin_ka160",
    contactLabel: "Написать менеджеру",
    contactExternal: true,
  },
  {
    id: 4,
    name: "Бороха Юли",
    phone: "+7 (918) 295-60-93",
    phoneHref: "tel:+79182956093",
    photoUrl: "/managers/borokha-yuli.webp",
    contactUrl: "https://t.me/juliaborokha24",
    contactLabel: "Написать менеджеру",
    contactExternal: true,
  },
  {
    id: 5,
    name: "Мельник Сергей",
    phone: "+7 (949) 647-72-56",
    phoneHref: "tel:+79496477256",
    photoUrl: "/managers/melnik-sergey.webp",
    contactUrl: "https://t.me/sergeymcv",
    contactLabel: "Написать менеджеру",
    contactExternal: true,
  },
  {
    id: 6,
    name: "Медведева Елена",
    phone: "+7 (949) 715-80-77",
    phoneHref: "tel:+79497158077",
    photoUrl: "/managers/medvedeva-elena.webp",
    contactUrl: "https://t.me/Elen_md",
    contactLabel: "Написать менеджеру",
    contactExternal: true,
  },
  {
    id: 7,
    name: "Ольга Кривуца",
    phone: "+7 (978) 059-26-69",
    phoneHref: "tel:+79780592669",
    photoUrl: "/managers/olga-krivutsa.webp",
    contactUrl: "mailto:olya_malina22@mail.ru",
    contactLabel: "Написать на e-mail",
    contactExternal: false,
  },
  {
    id: 8,
    name: "Тсаренко Виктория",
    phone: "+7 (963) 532-80-09",
    phoneHref: "tel:+79635328009",
    photoUrl: "/managers/tsarenko-viktoria.webp",
    contactUrl: "mailto:tsarenko.viktoria2000@mail.ru",
    contactLabel: "Написать на e-mail",
    contactExternal: false,
  },
];

function ManagerAvatar({
  name,
  photoUrl,
}: {
  name: string;
  photoUrl?: string;
}) {
  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl}
        alt={name}
        className="h-9 w-9 shrink-0 rounded-full border-2 border-brand object-cover"
      />
    );
  }

  return (
    <div
      aria-hidden="true"
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-brand bg-brand/10 text-brand"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className="h-4 w-4"
        stroke="currentColor"
        strokeWidth="1.7"
      >
        <circle cx="12" cy="8" r="3.25" />
        <path d="M5.75 19c.55-3.35 2.75-5.25 6.25-5.25s5.7 1.9 6.25 5.25" />
      </svg>
    </div>
  );
}

export default function ContactsPage() {
  return (
    <main className="mx-auto max-w-[1440px] px-4 py-12">
      <h1 className="font-display text-3xl font-bold text-brand">Контакты</h1>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(330px,1fr)_360px_430px]">
        <section className="h-[420px] rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <h2 className="font-display text-xl font-bold text-brand">
            Контакты менеджеров
          </h2>

          <div className="mt-3 grid gap-0.5">
            {managers.map((manager) => (
              <div
                key={manager.id}
                className="flex min-h-10 items-center gap-3 rounded-xl bg-stone-50 px-3"
              >
                <ManagerAvatar
                  name={manager.name}
                  photoUrl={manager.photoUrl}
                />
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-text">
                    {manager.name}
                  </div>
                  {manager.phoneHref ? (
                    <a
                      href={manager.phoneHref}
                      className="mt-0.5 block text-xs text-brand hover:underline"
                    >
                      {manager.phone}
                    </a>
                  ) : (
                    <div className="mt-0.5 text-xs text-stone-400">
                      {manager.phone}
                    </div>
                  )}
                </div>
                <a
                  href={manager.contactUrl}
                  {...(manager.contactExternal
                    ? { target: "_blank" as const, rel: "noreferrer" }
                    : {})}
                  className="ml-auto shrink-0 rounded-lg border border-brand px-2.5 py-1.5 text-[11px] font-semibold leading-none text-brand transition hover:bg-brand hover:text-on-brand"
                  aria-label={`${manager.contactLabel}: ${manager.name}`}
                >
                  {manager.contactLabel}
                </a>
              </div>
            ))}
          </div>
        </section>

        <section className="h-[420px] rounded-2xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
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
        </section>

        <section className="h-[420px] overflow-hidden rounded-2xl border border-stone-200 bg-stone-100 shadow-sm">
          <iframe
            src={mapUrl}
            title="Карта проезда к офису агентства «Визуал»"
            className="h-full w-full border-0"
            loading="lazy"
            allowFullScreen
          />
        </section>
      </div>
    </main>
  );
}
