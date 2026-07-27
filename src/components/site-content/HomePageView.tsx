import Link from "next/link";
import { preload } from "react-dom";
import { PropertyCard } from "../PropertyCard";
import type { SiteContentV1 } from "../../lib/site-content/schema";

export type FeaturedPropertyView = {
  id: string;
  title: string;
  price: number;
  rooms: number | null;
  area: number | null;
  district: string | null;
  photo: string | null;
};

export function HomePageView({
  content,
  featured,
}: {
  content: SiteContentV1["home"];
  featured: FeaturedPropertyView[];
}) {
  preload("/team-hero-mobile.avif", {
    as: "image",
    type: "image/avif",
    media: "(max-width: 767px)",
    fetchPriority: "high",
  });
  preload("/team-hero.avif", {
    as: "image",
    type: "image/avif",
    media: "(min-width: 768px)",
    fetchPriority: "high",
  });

  return (
    <main>
      <section className="relative min-h-[calc(100svh-73px)] overflow-hidden bg-brand text-on-brand">
        <picture className="absolute inset-0 block">
          <source
            media="(max-width: 767px)"
            srcSet="/team-hero-mobile.avif"
            type="image/avif"
          />
          <source srcSet="/team-hero.avif" type="image/avif" />
          <img
            src="/team-hero.jpeg"
            alt="Команда агентства недвижимости «Визуал»"
            fetchPriority="high"
            className="h-full w-full object-cover object-center"
          />
        </picture>
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-brand/55 via-brand/15 to-transparent sm:h-28" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-brand/90 via-brand/45 to-transparent sm:h-44" />

        <div className="relative z-10 mx-auto flex min-h-[calc(100svh-73px)] w-full max-w-[1600px] flex-col justify-between px-4 py-8 sm:px-8 sm:py-10">
          <h1 className="hero-heading-outline -translate-y-3 text-center font-display text-4xl font-semibold leading-none tracking-[-0.025em] drop-shadow-lg sm:absolute sm:inset-x-0 sm:top-[28%] sm:translate-y-[10px] sm:text-6xl lg:text-7xl">
            {content.heroHeading}
          </h1>

          <div className="mt-auto text-center drop-shadow-md">
            <p className="mx-auto text-base font-bold text-on-brand sm:whitespace-nowrap sm:text-sm xl:text-base 2xl:text-lg">
              {content.heroTitle}
              <br />
              {content.heroSubtitle}
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-3 sm:gap-4">
              <Link
                href="/catalog"
                className="rounded-md bg-gradient-to-r from-accent to-[#e8b84d] px-8 py-4 text-base font-semibold text-text transition hover:brightness-95"
              >
                {content.catalogCta}
              </Link>
              <Link
                href="/contacts"
                className="rounded-md border border-on-brand/40 px-5 py-3 text-sm font-medium text-on-brand transition hover:bg-brand-dim"
              >
                {content.contactsCta}
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-2">
          <h2 className="font-display text-3xl font-bold tracking-[-0.02em] text-brand">
            {content.featuredTitle}
          </h2>
          <Link href="/catalog" className="inline-flex items-center gap-1.5 text-sm font-medium text-accent-text hover:underline">
            {content.featuredCatalogLabel}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </Link>
        </div>
        {featured.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((property) => (
              <PropertyCard
                key={property.id}
                id={property.id}
                title={property.title}
                price={property.price}
                rooms={property.rooms}
                area={property.area}
                district={property.district}
                photo={property.photo}
              />
            ))}
          </div>
        ) : (
          <p className="text-stone-500">{content.featuredEmptyText}</p>
        )}
      </section>

      <section className="bg-surface">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 py-16 md:grid-cols-2 md:py-20">
          <div>
            <h2 className="font-display text-3xl font-bold tracking-[-0.02em] text-brand sm:text-4xl">
              {content.whyTitle}
            </h2>
            <p className="mt-4 leading-relaxed text-text/70">
              {content.whyIntroduction}
            </p>
            <ul className="mt-8 space-y-6">
              {content.benefits.map((benefit) => (
                <li key={benefit.title} className="flex items-start gap-4">
                  <span className="mt-2 h-px w-8 flex-none bg-accent" />
                  <div>
                    <div className="font-semibold text-text">{benefit.title}</div>
                    {benefit.description ? (
                      <div className="mt-0.5 text-sm text-text/60">
                        {benefit.description}
                      </div>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
            <Link
              href="/about"
              className="mt-8 inline-flex items-center gap-1.5 text-sm font-medium text-accent-text hover:underline"
            >
              {content.aboutCta}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </Link>
          </div>
          <div className="flex flex-col justify-between rounded-2xl bg-brand p-8 text-on-brand sm:p-10">
            <p className="text-[10px] uppercase tracking-[0.3em] text-on-brand-soft">
              {content.statisticLabel}
            </p>
            <div>
              <div className="font-display text-[6rem] font-bold leading-none text-accent-bright sm:text-[7rem]">
                {content.statisticValue}
              </div>
              <p className="mt-3 text-sm tracking-wide text-on-brand-soft">
                {content.statisticDescription}
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
