import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdminSessionState } from "../../../lib/admin/request";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Вход в админ-панель",
  robots: { index: false, follow: false },
};

export function LoginPageView() {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-md items-center px-5 py-16">
      <section className="w-full rounded-2xl border border-black/10 bg-surface p-7 shadow-sm">
        <h1 className="font-display text-4xl font-semibold text-brand-dim">
          Админ-панель
        </h1>
        <p className="mb-7 mt-2 text-sm text-muted">
          Введите данные администратора.
        </p>
        <LoginForm />
      </section>
    </main>
  );
}

export default async function AdminLoginPage() {
  const state = await getAdminSessionState();
  if (state.invalidCookie) redirect("/api/admin/session/clear");
  if (state.session) redirect("/admin/featured");
  return <LoginPageView />;
}
