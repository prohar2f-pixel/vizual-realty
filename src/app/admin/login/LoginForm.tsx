"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        body: new FormData(event.currentTarget),
        credentials: "same-origin",
      });
      const result: unknown = await response.json();
      if (
        !response.ok ||
        !result ||
        typeof result !== "object" ||
        !("ok" in result) ||
        result.ok !== true
      ) {
        const message =
          result &&
          typeof result === "object" &&
          "error" in result &&
          typeof result.error === "string"
            ? result.error
            : "Не удалось выполнить вход";
        setError(message);
        return;
      }
      router.replace("/admin/featured");
      router.refresh();
    } catch {
      setError("Не удалось выполнить вход");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={submit}>
      <div>
        <label className="mb-2 block text-sm font-medium" htmlFor="username">
          Логин
        </label>
        <input
          autoComplete="username"
          className="w-full rounded-lg border border-black/20 bg-white px-4 py-3"
          id="username"
          name="username"
          required
          type="text"
        />
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium" htmlFor="password">
          Пароль
        </label>
        <input
          autoComplete="current-password"
          className="w-full rounded-lg border border-black/20 bg-white px-4 py-3"
          id="password"
          name="password"
          required
          type="password"
        />
      </div>
      <p aria-live="polite" className="min-h-6 text-sm text-red-700">
        {error}
      </p>
      <button
        className="w-full rounded-lg bg-brand px-5 py-3 font-semibold text-on-brand disabled:cursor-wait disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        {pending ? "Вход…" : "Войти"}
      </button>
    </form>
  );
}
