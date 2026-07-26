export const SITE_PAGES = ["home", "about", "team", "contacts"] as const;
export type SitePage = (typeof SITE_PAGES)[number];
