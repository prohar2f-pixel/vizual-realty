import Link from "next/link";

type AdminShellProps = Readonly<{
  children: React.ReactNode;
}>;

export function AdminShell({ children }: AdminShellProps) {
  return (
    <div className="min-h-[70vh] bg-bg text-text">
      <nav
        aria-label="Навигация администратора"
        className="border-b border-brand-dim/15 bg-surface shadow-sm"
      >
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-1 px-4 py-3 sm:px-6">
          <Link
            className="min-h-11 rounded-lg px-4 py-3 text-sm font-semibold text-brand-dim transition-colors hover:bg-brand/10"
            href="/admin/featured"
          >
            Избранные
          </Link>
          <Link
            className="min-h-11 rounded-lg px-4 py-3 text-sm font-semibold text-brand-dim transition-colors hover:bg-brand/10"
            href="/admin/content"
          >
            Тексты
          </Link>
          <Link
            className="min-h-11 rounded-lg px-4 py-3 text-sm font-semibold text-brand-dim transition-colors hover:bg-brand/10"
            href="/"
          >
            Предпросмотр
          </Link>
          <form action="/api/admin/logout" method="post">
            <button
              className="min-h-11 rounded-lg px-4 py-3 text-sm font-semibold text-brand-dim transition-colors hover:bg-brand/10"
              type="submit"
            >
              Выйти
            </button>
          </form>
        </div>
      </nav>
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
