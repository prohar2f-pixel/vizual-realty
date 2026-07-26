import type { Metadata } from "next";
import { AdminShell } from "../../../components/admin/AdminShell";
import { requireAdminSession } from "../../../lib/admin/request";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AdminProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireAdminSession();
  return <AdminShell>{children}</AdminShell>;
}
