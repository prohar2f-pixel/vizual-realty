import type { Metadata } from "next";
import "../globals.css";
import { DocumentLayout } from "../../components/DocumentLayout";
import { siteMetadata } from "../site-metadata";

export const metadata: Metadata = siteMetadata;

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <DocumentLayout>{children}</DocumentLayout>;
}
