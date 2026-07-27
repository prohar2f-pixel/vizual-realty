const productionSiteUrl = "https://nedvizhimostdoneck.ru";

export function getSiteUrl(): string {
  return (process.env.SITE_URL ?? productionSiteUrl).replace(/\/$/, "");
}
