"use client";

import { useState } from "react";
import Link from "next/link";
import type { SiteContentV1 } from "../lib/site-content/schema";

export function MobileNav({ navigation }: {
  navigation: SiteContentV1["navigation"];
}) {
  const [open, setOpen] = useState(false);
  const nav = [
    { href: "/", label: navigation.home },
    { href: "/catalog", label: navigation.catalog },
    { href: "/about", label: navigation.about },
    { href: "/team", label: navigation.team },
    { href: "/contacts", label: navigation.contacts },
  ];

  return (
    <div className="sm:hidden">
      <button
        onClick={() => setOpen(!open)}
        aria-label={open ? "Закрыть меню" : "Открыть меню"}
        className="flex h-11 w-11 items-center justify-center rounded-md text-on-brand/90 transition hover:bg-brand-dim"
      >
        {open ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        )}
      </button>

      {open && (
        <div className="absolute inset-x-0 top-full z-40 border-t border-on-brand/10 bg-brand shadow-lg">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              onClick={() => setOpen(false)}
              className="block px-4 py-4 text-base font-medium text-on-brand/90 transition hover:bg-brand-dim"
            >
              {n.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
