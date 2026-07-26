import {
  getAdminFeaturedProperties,
  type AdminFeaturedPropertyCardData,
} from "../../../../lib/featured";
import { FeaturedEditor } from "./FeaturedEditor";

export const dynamic = "force-dynamic";

export function FeaturedPageView({
  items,
}: {
  items: AdminFeaturedPropertyCardData[];
}) {
  return (
    <div>
      <header className="mb-8">
        <h1 className="font-display text-3xl font-bold text-brand">
          Избранные объекты
        </h1>
        <p className="mt-2 max-w-2xl text-muted">
          Выберите и расположите до трёх объектов для публичной главной страницы.
        </p>
      </header>
      <FeaturedEditor initialItems={items} />
    </div>
  );
}

export default async function FeaturedPage() {
  const items = await getAdminFeaturedProperties();
  return <FeaturedPageView items={items} />;
}
