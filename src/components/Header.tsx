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
        <Link href="/" className="flex items-baseline gap-2">
          <span className="font-display text-2xl font-bold tracking-wide">
            ВИ<span className="text-accent">З</span>УАЛ
          </span>
          <span className="hidden text-[10px] uppercase tracking-[0.25em] text-on-brand/70 sm:inline">
            агентство недвижимости
          </span>
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
