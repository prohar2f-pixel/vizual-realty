import { HomePageView } from "../../components/site-content/HomePageView";
import { getFeaturedProperties } from "../../lib/featured";
import { getPublishedContent } from "../../lib/site-content/published";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [content, featured] = await Promise.all([
    getPublishedContent(),
    getFeaturedProperties(),
  ]);
  return <HomePageView content={content.home} featured={featured} />;
}
