import type { SiteContentV1, TeamMemberV1 } from "../../lib/site-content/schema";
import { memberContact, memberImageUrl, phoneHref } from "./member-view";

function ManagerAvatar({ member }: { member: TeamMemberV1 }) {
  const imageUrl = memberImageUrl(member.imageId, "avatar");
  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt={member.name}
        className="h-9 w-9 shrink-0 rounded-full border-2 border-brand object-cover"
      />
    );
  }
  return (
    <div aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-brand bg-brand/10 text-brand">
      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.7">
        <circle cx="12" cy="8" r="3.25" />
        <path d="M5.75 19c.55-3.35 2.75-5.25 6.25-5.25s5.7 1.9 6.25 5.25" />
      </svg>
    </div>
  );
}

export function ContactsPageView({ content, members, mapSearchAddress }: {
  content: SiteContentV1["contacts"];
  members: TeamMemberV1[];
  mapSearchAddress?: string;
}) {
  const visibleMembers = members.filter((member) => member.isVisible);
  const encodedAddress = encodeURIComponent(mapSearchAddress ?? content.address);
  const mapUrl = `https://yandex.ru/map-widget/v1/?mode=search&text=${encodedAddress}&z=16`;
  const routeUrl = `https://yandex.ru/maps/?mode=search&text=${encodedAddress}`;

  return (
    <main className="mx-auto max-w-[1440px] px-4 py-12">
      <h1 className="font-display text-3xl font-bold text-brand">{content.title}</h1>
      {content.introduction ? (
        <p className="mt-3 max-w-3xl text-text/70">{content.introduction}</p>
      ) : null}
      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(330px,1fr)_360px_430px]">
        <section className="h-[420px] rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <h2 className="font-display text-xl font-bold text-brand">{content.managersTitle}</h2>
          <div
            aria-label="Список сотрудников"
            className="mt-3 grid max-h-[344px] gap-0.5 overflow-y-auto overscroll-contain pr-1"
          >
            {visibleMembers.length > 0 ? visibleMembers.map((member) => {
              const contact = memberContact(member);
              const memberPhoneHref = phoneHref(member.phone);
              const contactLabel = contact?.label === "Написать в Telegram"
                ? "Написать менеджеру"
                : contact?.label;
              return (
                <div key={member.id} className="flex min-h-10 items-center gap-3 rounded-xl bg-stone-50 px-3">
                  <ManagerAvatar member={member} />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-text">{member.name}</div>
                    {memberPhoneHref ? (
                      <a href={memberPhoneHref} className="mt-0.5 block text-xs text-brand hover:underline">{member.phone}</a>
                    ) : null}
                  </div>
                  {contact ? (
                    <a
                      href={contact.url}
                      {...(contact.external ? { target: "_blank" as const, rel: "noreferrer" } : {})}
                      className="ml-auto shrink-0 rounded-lg border border-brand px-2.5 py-1.5 text-[11px] font-semibold leading-none text-brand transition hover:bg-brand hover:text-on-brand"
                      aria-label={`${contactLabel}: ${member.name}`}
                    >
                      {contactLabel}
                    </a>
                  ) : null}
                </div>
              );
            }) : <p className="py-4 text-sm text-text/60">Нет сотрудников для показа.</p>}
          </div>
        </section>

        <section className="h-[420px] rounded-2xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
          <dl className="space-y-5 text-text/80">
            <div>
              <dt className="text-sm text-stone-500">{content.phoneLabel}</dt>
              <dd className="mt-1 font-medium"><a href={phoneHref(content.phone)} className="text-brand transition hover:text-accent-text">{content.phone}</a></dd>
            </div>
            <div>
              <dt className="text-sm text-stone-500">{content.emailLabel}</dt>
              <dd className="mt-1 font-medium"><a href={`mailto:${content.email}`} className="text-brand transition hover:text-accent-text">{content.email}</a></dd>
            </div>
            <div>
              <dt className="text-sm text-stone-500">{content.addressLabel}</dt>
              <dd className="mt-1 font-medium">{content.address}</dd>
            </div>
            {content.businessHours ? (
              <div>
                <dt className="text-sm text-stone-500">
                  {content.businessHoursLabel}
                </dt>
                <dd className="mt-1 font-medium">{content.businessHours}</dd>
              </div>
            ) : null}
          </dl>
          <a href={routeUrl} target="_blank" rel="noreferrer" className="mt-8 inline-flex rounded-lg bg-brand px-5 py-3 text-sm font-semibold text-on-brand transition hover:bg-brand-dim">
            {content.routeCta}
          </a>
        </section>

        <section className="h-[420px] overflow-hidden rounded-2xl border border-stone-200 bg-stone-100 shadow-sm">
          <iframe src={mapUrl} title="Карта проезда к офису агентства «Визуал»" className="h-full w-full border-0" loading="lazy" allowFullScreen />
        </section>
      </div>
    </main>
  );
}
