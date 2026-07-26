"use client";

import { useState } from "react";
import type { LeadFormContentV1 } from "../lib/site-content/schema";

type Props = {
  objectShortId?: number | null;
  objectType?: string;
  copy: LeadFormContentV1;
};

export function LeadForm({ objectShortId, objectType, copy }: Props) {
  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "error">("idle");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    setStatus("sending");
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullname: data.get("fullname"),
          phone: data.get("phone"),
          comment: data.get("comment"),
          objectShortId,
          objectType,
          action: 1,
        }),
      });
      if (!res.ok) throw new Error();
      form.reset();
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }

  if (status === "ok") {
    return (
      <div className="rounded-xl border border-brand/30 bg-bg p-5 text-center">
        <p className="font-semibold text-brand">{copy.successTitle}</p>
        <p className="mt-1 text-sm text-text/70">{copy.successHelper}</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="rounded-xl border border-stone-200 bg-white p-5">
      <div className="font-semibold text-text">{copy.title}</div>
      <label htmlFor="lead-fullname" className="mt-3 block text-sm text-stone-600">
        {copy.nameLabel}
        <input
          id="lead-fullname"
          name="fullname"
          required
          placeholder={copy.namePlaceholder}
          className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-text"
        />
      </label>
      <label htmlFor="lead-phone" className="mt-2 block text-sm text-stone-600">
        {copy.contactLabel}
        <input
          id="lead-phone"
          name="phone"
          required
          placeholder={copy.contactPlaceholder}
          className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-text"
        />
      </label>
      <label htmlFor="lead-comment" className="mt-2 block text-sm text-stone-600">
        {copy.messageLabel}
        <textarea
          id="lead-comment"
          name="comment"
          rows={3}
          className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-text"
        />
      </label>
      <button
        type="submit"
        disabled={status === "sending"}
        className="mt-3 w-full rounded-md bg-brand px-4 py-2 font-medium text-on-brand transition hover:bg-brand-dim disabled:opacity-60"
      >
        {status === "sending" ? copy.submittingLabel : copy.submitLabel}
      </button>
      {status === "error" && (
        <p className="mt-2 text-sm text-red-600">
          {copy.errorText}
        </p>
      )}
    </form>
  );
}
