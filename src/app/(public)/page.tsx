import { db } from "@/lib/db";
import { HomePageView } from "../../components/site-content/HomePageView";
import { DEFAULT_SITE_CONTENT } from "../../lib/site-content/defaults";

export const dynamic = "force-dynamic";

export default async function Home() {
  const featured = await db.property.findMany({
    where: { isFeed: true },
    orderBy: { price: "desc" },
    take: 3,
  });
  return <HomePageView content={DEFAULT_SITE_CONTENT.home} featured={featured} />;
}
