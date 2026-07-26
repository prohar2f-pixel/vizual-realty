import { TeamPageView } from "../../../components/site-content/TeamPageView";
import { DEFAULT_SITE_CONTENT } from "../../../lib/site-content/defaults";

export const metadata = { title: "Наша команда" };

export default function TeamPage() {
  return <TeamPageView content={DEFAULT_SITE_CONTENT.team} />;
}
