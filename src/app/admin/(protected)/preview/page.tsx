import type { Metadata } from "next";
import { PreviewBar } from "../../../../components/admin/PreviewBar";
import { SitePageRenderer } from "../../../../components/site-content/SitePageRenderer";
import {
  SITE_PAGES,
  type SitePage,
} from "../../../../components/site-content/pages";
import {
  getDraftContent,
  getSiteContentStatus,
} from "../../../../lib/site-content/store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Предпросмотр черновика",
  robots: { index: false, follow: false },
};

export function parsePreviewPage(value: string | string[] | undefined): SitePage {
  return typeof value === "string" && SITE_PAGES.includes(value as SitePage)
    ? (value as SitePage)
    : "home";
}

export default async function PreviewPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const page = parsePreviewPage((await searchParams).page);
  const [content, status] = await Promise.all([
    getDraftContent(),
    getSiteContentStatus(),
  ]);
  const pageView = await SitePageRenderer({ page, content, preview: true });

  return (
    <div>
      <PreviewBar
        page={page}
        status={{
          draftUpdatedAt: status.draftUpdatedAt.toISOString(),
          publishedAt: status.publishedAt?.toISOString() ?? null,
          canRollback: status.canRollback,
        }}
      />
      {pageView}
    </div>
  );
}
