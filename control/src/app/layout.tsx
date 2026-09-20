import type { Metadata } from "next";

export const metadata: Metadata = { title: "Контроль Topnlab — Визуал", robots: { index: false, follow: false } };

export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ru"><body>{children}</body></html>;
}
