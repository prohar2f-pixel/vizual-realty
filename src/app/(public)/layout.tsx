import type { Metadata } from "next";
import "../globals.css";
import { DocumentLayout } from "../../components/DocumentLayout";
import { Footer } from "../../components/Footer";
import { Header } from "../../components/Header";
import { getPublishedContent } from "../../lib/site-content/published";
import { siteMetadata } from "../site-metadata";

export const metadata: Metadata = siteMetadata;
export const dynamic = "force-dynamic";

export default async function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const content = await getPublishedContent();
  return (
    <DocumentLayout>
      <Header navigation={content.navigation} />
      <div className="flex-1">{children}</div>
      <Footer content={content.footer} navigation={content.navigation} />
    </DocumentLayout>
  );
}
