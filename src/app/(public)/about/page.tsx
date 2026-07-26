import { AboutPageView } from "../../../components/site-content/AboutPageView";
import { DEFAULT_SITE_CONTENT } from "../../../lib/site-content/defaults";

export const metadata = { title: "О нас" };

export default function AboutPage() {
  return <AboutPageView content={DEFAULT_SITE_CONTENT.about} />;
}
