import { getDraftContent } from "../../../../lib/site-content/store";
import type { SiteContentV1 } from "../../../../lib/site-content/schema";
import { ContentEditor } from "./ContentEditor";

export const dynamic = "force-dynamic";

export function ContentPageView({
  initialDraft,
}: {
  initialDraft: SiteContentV1;
}) {
  return (
    <div>
      <header className="mb-8">
        <h1 className="font-display text-3xl font-bold text-brand">
          Тексты и команда
        </h1>
        <p className="mt-2 max-w-2xl text-muted">
          Редактируйте тексты страниц и карточки сотрудников. Изменения
          сохраняются в черновик и не публикуются автоматически.
        </p>
      </header>
      <ContentEditor initialDraft={initialDraft} />
    </div>
  );
}

export default async function ContentPage() {
  const initialDraft = await getDraftContent();
  return <ContentPageView initialDraft={initialDraft} />;
}
