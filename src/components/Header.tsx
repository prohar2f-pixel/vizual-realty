import Link from "next/link";

const nav = [
  { href: "/", label: "Главная" },
  { href: "/catalog", label: "Каталог" },
  { href: "/about", label: "О нас" },
  { href: "/team", label: "Команда" },
  { href: "/contacts", label: "Контакты" },
];

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-black/10 bg-brand text-cream">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-4">
        <Link href="/" className="flex items-baseline gap-2">
          {/* Текстовый логотип-заглушка. Заменим на файл логотипа, когда пришлёте. */}
          <span className="font-display text-2xl font-bold tracking-wide">
            ВИ<span className="text-gold">З</span>УАЛ
          </span>
          <span className="hidden text-[10px] uppercase tracking-[0.25em] text-cream/70 sm:inline">
            агентство недвижимости
          </span>
        </Link>
        <nav className="flex flex-wrap items-center gap-1">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-cream/90 transition hover:bg-brand-light hover:text-white"
            >
              {n.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
