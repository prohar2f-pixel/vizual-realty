import { TeamCarousel, type TeamManager } from "@/components/TeamCarousel";

export const metadata = { title: "Наша команда" };

const managers: TeamManager[] = [
  {
    name: "Аянот Елена",
    phone: "+7 (949) 537-55-65",
    phoneHref: "tel:+79495375565",
    telegramUrl: "https://t.me/Lena_Katana",
    photoUrl: "/managers/ayanot-elena-card.webp",
  },
  {
    name: "Банитюк Юлия",
    phone: "+7 (949) 578-09-33",
    phoneHref: "tel:+79495780933",
    telegramUrl: "https://t.me/Lia_banituk",
    photoUrl: "/managers/banityuk-yulia-card.webp",
  },
  {
    name: "Хаджинова Алина",
    phone: "+7 (949) 400-92-74",
    phoneHref: "tel:+79494009274",
    telegramUrl: "https://t.me/alin_ka160",
    photoUrl: "/managers/khadzhinova-alina-card.webp",
  },
  {
    name: "Бороха Юли",
    phone: "+7 (918) 295-60-93",
    phoneHref: "tel:+79182956093",
    telegramUrl: "https://t.me/juliaborokha24",
    photoUrl: "/managers/borokha-yuli-card.webp",
  },
  {
    name: "Мельник Сергей",
    phone: "+7 (949) 647-72-56",
    phoneHref: "tel:+79496477256",
    telegramUrl: "https://t.me/sergeymcv",
    photoUrl: "/managers/melnik-sergey-card.webp",
  },
  {
    name: "Медведева Елена",
    phone: "+7 (949) 715-80-77",
    phoneHref: "tel:+79497158077",
    telegramUrl: "https://t.me/Elen_md",
    photoUrl: "/managers/medvedeva-elena-card.webp",
  },
];

export default function TeamPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="font-display text-3xl font-bold text-brand">Наша команда</h1>
      <p className="mt-2 max-w-2xl text-text/70">
        Выберите менеджера, который поможет с подбором объекта и сопровождением сделки.
      </p>

      <TeamCarousel managers={managers} />
    </main>
  );
}
