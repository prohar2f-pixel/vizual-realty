import type { MetadataRoute } from "next";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.SITE_URL ?? "http://localhost:3000";

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
