import { getFeaturedProperties } from "../../lib/featured";
import type { SiteContentV1 } from "../../lib/site-content/schema";
import { AboutPageView } from "./AboutPageView";
import { ContactsPageView } from "./ContactsPageView";
import { HomePageView } from "./HomePageView";
import { TeamPageView } from "./TeamPageView";
import type { SitePage } from "./pages";

export type { SitePage } from "./pages";

export async function SitePageRenderer({ page, content, preview }: {
  page: SitePage;
  content: SiteContentV1;
  preview: boolean;
}) {
  void preview;
  if (page === "home") {
    const featured = await getFeaturedProperties();
    return <HomePageView content={content.home} featured={featured} />;
  }
  if (page === "about") return <AboutPageView content={content.about} />;
  if (page === "team") return <TeamPageView content={content.team} />;
  return (
    <ContactsPageView
      content={content.contacts}
      members={content.team.members}
    />
  );
}
