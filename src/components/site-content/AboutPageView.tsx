import Image from "next/image";
import Link from "next/link";
import type { SiteContentV1 } from "../../lib/site-content/schema";

export function AboutPageView({ content }: { content: SiteContentV1["about"] }) {
  return (
    <main className="mx-auto grid max-w-6xl gap-8 px-4 py-12 lg:grid-cols-[minmax(320px,0.9fr)_minmax(0,1.1fr)] lg:items-start lg:gap-12">
      <div className="overflow-hidden rounded-2xl bg-stone-100 shadow-sm lg:sticky lg:top-24">
        <Image
          src="/about-team.jpg"
          alt="Команда агентства недвижимости «Визуал»"
          width={1365}
          height={2048}
          className="h-auto w-full object-cover"
          priority
        />
      </div>

      <div>
        <h1 className="font-display text-3xl font-bold text-brand">{content.title}</h1>
        <div className="mt-6 space-y-6 text-text/80">
          {content.introduction.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
          <section>
            <h2 className="font-display text-2xl font-bold text-brand">
              {content.servicesTitle}
            </h2>
            <ol className="mt-4 list-decimal space-y-3 pl-6 marker:font-semibold marker:text-brand">
              {content.services.map((service) => (
                <li key={service} className="pl-1">{service};</li>
              ))}
            </ol>
          </section>
          <p>{content.closingText}</p>
          {content.statistics.length > 0 ? (
            <section
              aria-label="Показатели компании"
              className="grid gap-3 sm:grid-cols-2"
            >
              {content.statistics.map((statistic, index) => (
                <div
                  key={`${statistic.value}-${statistic.label}-${index}`}
                  className="rounded-xl border border-brand/15 bg-brand/5 p-4"
                >
                  <div className="font-display text-3xl font-bold text-brand">
                    {statistic.value}
                  </div>
                  <p className="mt-1 text-sm text-text/70">{statistic.label}</p>
                </div>
              ))}
            </section>
          ) : null}
          <div>
            <p className="text-sm text-text/60">В разделе</p>
            <Link
              href="/team"
              className="mt-1 inline-flex font-semibold text-brand underline decoration-accent decoration-2 underline-offset-4 transition hover:text-accent-text"
            >
              {content.teamCta}
            </Link>
            <p className="mt-2 text-text/80">{content.teamCtaText}</p>
          </div>
        </div>
      </div>
    </main>
  );
}
