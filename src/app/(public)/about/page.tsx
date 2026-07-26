import { AboutPageView } from "../../../components/site-content/AboutPageView";
import { getPublishedContent } from "../../../lib/site-content/published";

export const metadata = { title: "О нас" };

export default async function AboutPage() {
  const content = await getPublishedContent();
  return <AboutPageView content={content.about} />;
}
