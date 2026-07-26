import { TeamPageView } from "../../../components/site-content/TeamPageView";
import { getPublishedContent } from "../../../lib/site-content/published";

export const metadata = { title: "Наша команда" };

export default async function TeamPage() {
  const content = await getPublishedContent();
  return <TeamPageView content={content.team} />;
}
