import type { Metadata } from "next";
import "../globals.css";
import { DocumentLayout } from "../../components/DocumentLayout";
import { Footer } from "../../components/Footer";
import { Header } from "../../components/Header";
import { siteMetadata } from "../site-metadata";

export const metadata: Metadata = siteMetadata;

export default function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <DocumentLayout>
      <Header />
      <div className="flex-1">{children}</div>
      <Footer />
    </DocumentLayout>
  );
}
