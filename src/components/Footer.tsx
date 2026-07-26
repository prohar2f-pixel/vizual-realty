import Image from "next/image";
import type { SiteContentV1 } from "../lib/site-content/schema";

function phoneHref(phone: string) {
  return `tel:+${phone.replace(/\D/g, "")}`;
}

export function Footer({ content, navigation }: {
  content: SiteContentV1["footer"];
  navigation: SiteContentV1["navigation"];
}) {
  return (
    <footer className="bg-brand-dim text-on-brand/80">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-3">
        <div>
          <Image
            src="/brand/logo-lockup-light.svg"
            alt="Визуал — агентство недвижимости"
            width={516}
            height={294}
            unoptimized
            className="h-14 w-auto aspect-[516/294]"
          />
          <p className="mt-3 text-sm">{content.tagline}</p>
        </div>
        <div>
          <div className="mb-3 font-semibold text-on-brand">{content.sectionsTitle}</div>
          <ul className="space-y-2 text-sm">
            <li><a href="/catalog" className="transition hover:text-accent">{content.catalogLabel}</a></li>
            <li><a href="/about" className="transition hover:text-accent">{navigation.about}</a></li>
            <li><a href="/team" className="transition hover:text-accent">{navigation.team}</a></li>
            <li><a href="/contacts" className="transition hover:text-accent">{navigation.contacts}</a></li>
          </ul>
        </div>
        <div>
          <div className="mb-3 font-semibold text-on-brand">{content.contactsTitle}</div>
          <p className="text-sm leading-relaxed">
            Телефон:{" "}
            <a href={phoneHref(content.phone)} className="transition hover:text-accent">
              {content.phone}
            </a>
            <br />
            E-mail:{" "}
            <a href={`mailto:${content.email}`} className="transition hover:text-accent">
              {content.email}
            </a>
            <br />
            Адрес: {content.address}
          </p>
        </div>
      </div>
      <div className="border-t border-on-brand/10 py-4 text-center text-xs text-on-brand/50">
        © {new Date().getFullYear()} {content.copyright}
      </div>
    </footer>
  );
}
