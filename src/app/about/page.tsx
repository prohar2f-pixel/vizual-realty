export const metadata = { title: "О нас" };

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="font-display text-3xl font-bold text-brand">О компании</h1>
      <div className="mt-6 space-y-4 text-text/80">
        <p>
          Агентство недвижимости «Визуал» помогает людям покупать и продавать жильё —
          квартиры и частные дома. Мы ценим доверие и сопровождаем каждую сделку от
          первого звонка до получения ключей.
        </p>
        <p>
          В нашем каталоге более 200 проверенных объектов. За каждым закреплён личный
          агент, который ответит на вопросы и поможет с выбором.
        </p>
        <p className="text-sm text-stone-400">
          (Это текст-заглушка. Пришлите финальное описание компании — мы его поставим.)
        </p>
      </div>
    </main>
  );
}
