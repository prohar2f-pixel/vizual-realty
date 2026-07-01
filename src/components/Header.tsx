import Image from "next/image";
import Link from "next/link";
import { MobileNav } from "./MobileNav";

const nav = [
  { href: "/", label: "Главная" },
  { href: "/catalog", label: "Каталог" },
  { href: "/about", label: "О нас" },
  { href: "/team", label: "Команда" },
  { href: "/contacts", label: "Контакты" },
];

export function Header() {
  return (
    <header className="relative sticky top-0 z-50 border-b border-black/10 bg-brand text-on-brand">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link
          href="/"
          aria-label="Визуал — агентство недвижимости, на главную"
          className="flex items-center rounded focus:outline-2 focus:outline-offset-2 focus:outline-on-brand"
        >
          <Image
            src="/brand/logo-wordmark-light.svg"
            alt="Визуал — агентство недвижимости"
            width={516}
            height={274}
            priority
            unoptimized
            sizes="(max-width: 640px) 36px, 40px"
            className="h-9 w-auto sm:h-10 aspect-[516/274]"
          />
        </Link>

        <nav className="hidden sm:flex items-center gap-1">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-on-brand/90 transition hover:bg-brand-dim hover:text-on-brand"
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <MobileNav />
      </div>
    </header>
  );
}
