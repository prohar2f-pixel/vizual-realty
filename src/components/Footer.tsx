import Image from "next/image";

export function Footer() {
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
          <p className="mt-3 text-sm">
            Продажа квартир и домов.
          </p>
        </div>
        <div>
          <div className="mb-3 font-semibold text-on-brand">Разделы</div>
          <ul className="space-y-2 text-sm">
            <li><a href="/catalog" className="transition hover:text-accent">Каталог</a></li>
            <li><a href="/about" className="transition hover:text-accent">О нас</a></li>
            <li><a href="/team" className="transition hover:text-accent">Команда</a></li>
            <li><a href="/contacts" className="transition hover:text-accent">Контакты</a></li>
          </ul>
        </div>
        <div>
          <div className="mb-3 font-semibold text-on-brand">Контакты</div>
          <p className="text-sm leading-relaxed">
            Телефон: ______________
            <br />
            E-mail: ______________
            <br />
            Адрес: г. Донецк, ул. 50 лет СССР, 142
          </p>
        </div>
      </div>
      <div className="border-t border-on-brand/10 py-4 text-center text-xs text-on-brand/50">
        © {new Date().getFullYear()} Агентство недвижимости «Визуал»
      </div>
    </footer>
  );
}
