import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { getSiteUrl } from "../lib/site-url";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getSiteUrl();

  const staticRoutes = ["", "/catalog", "/about", "/team", "/contacts"].map((p) => ({
    url: `${base}${p}`,
    lastModified: new Date(),
  }));

  const objects = await db.property.findMany({
    where: { isFeed: true },
    select: { id: true, updatedAt: true },
  });
  const objectRoutes = objects.map((o) => ({
    url: `${base}/object/${o.id}`,
    lastModified: o.updatedAt,
  }));

  return [...staticRoutes, ...objectRoutes];
}
