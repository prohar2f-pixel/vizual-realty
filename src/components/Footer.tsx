export function Footer() {
  return (
    <footer className="bg-brand-dark text-cream/80">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-3">
        <div>
          <div className="font-display text-xl font-bold text-cream">
            ВИ<span className="text-gold">З</span>УАЛ
          </div>
          <p className="mt-2 text-sm">
            Агентство недвижимости. Продажа квартир и домов.
          </p>
        </div>
        <div>
          <div className="mb-3 font-semibold text-cream">Разделы</div>
          <ul className="space-y-2 text-sm">
            <li><a href="/catalog" className="transition hover:text-gold">Каталог</a></li>
            <li><a href="/about" className="transition hover:text-gold">О нас</a></li>
            <li><a href="/team" className="transition hover:text-gold">Команда</a></li>
            <li><a href="/contacts" className="transition hover:text-gold">Контакты</a></li>
          </ul>
        </div>
        <div>
          <div className="mb-3 font-semibold text-cream">Контакты</div>
          <p className="text-sm leading-relaxed">
            Телефон: ______________
            <br />
            E-mail: ______________
            <br />
            Адрес: ______________
          </p>
        </div>
      </div>
      <div className="border-t border-cream/10 py-4 text-center text-xs text-cream/50">
        © {new Date().getFullYear()} Агентство недвижимости «Визуал»
      </div>
    </footer>
  );
}
