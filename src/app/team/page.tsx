import { TeamCarousel } from "@/components/TeamCarousel";
import { managers } from "./managers";

export const metadata = { title: "Наша команда" };

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
