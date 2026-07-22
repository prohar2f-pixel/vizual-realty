import Image from "next/image";
import Link from "next/link";

export const metadata = { title: "О нас" };

const services = [
  "Покупка и продажа объектов на вторичном рынке Донецка, Мариуполя, Краснодара и Ростова-на-Дону",
  "Строительство домов в ипотеку под 2% в Донецке, Мариуполе",
  "Покупка квартир в ипотеку 2% в Мариуполе, Донецке",
  "Покупка квартир в Семейную ипотеку в Краснодаре, Ростове-на-Дону, в Крыму и других городах юга России",
  "Открытие ипотеки для наших клиентов бесплатно",
  "Межевание земельных участков в Донецке и Мариуполе",
  "Снос ветхих зданий в Донецке и Мариуполе",
];

export default function AboutPage() {
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
        <h1 className="font-display text-3xl font-bold text-brand">О нас</h1>

        <div className="mt-6 space-y-6 text-text/80">
        <p>
          Мы — федеральное агентство недвижимости «Визуал», являемся первыми в
          рейтинге Домклик на Юге России.
        </p>

        <p>
          Наши представительства есть в Донецке, Мариуполе, Краснодаре и
          Ростове-на-Дону.
        </p>

        <section>
          <h2 className="font-display text-2xl font-bold text-brand">
            Чем мы можем быть полезны для вас
          </h2>
          <ol className="mt-4 list-decimal space-y-3 pl-6 marker:font-semibold marker:text-brand">
            {services.map((service) => (
              <li key={service} className="pl-1">
                {service};
              </li>
            ))}
          </ol>
        </section>

        <p>
          В нашем каталоге более 200 объектов, за каждым закреплён личный агент,
          звоните.
        </p>

          <p>
            В разделе{" "}
            <Link
              href="/team"
              className="font-semibold text-brand underline decoration-accent decoration-2 underline-offset-4 transition hover:text-accent-text"
            >
              КОМАНДА
            </Link>{" "}
            Вы можете выбрать для работы любого менеджера нашей компании и позвонить
            ему напрямую 🤝
          </p>
        </div>
      </div>
    </main>
  );
}
