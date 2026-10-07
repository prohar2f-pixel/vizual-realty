import { redirect } from "next/navigation";
import { getSession } from "../../lib/security/request";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Вход — контроль Topnlab", robots: { index: false, follow: false } };
export default async function LoginPage() { if (await getSession()) redirect("/"); return <main style={{ maxWidth: 420, margin: "12vh auto", padding: 24, fontFamily: "Arial, sans-serif" }}><h1>Контроль Topnlab</h1><p>Вход для администратора.</p><LoginForm /></main>; }
