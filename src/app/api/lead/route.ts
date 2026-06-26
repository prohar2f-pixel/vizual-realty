import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const b = await req.json();

  if (!b.fullname || !b.phone) {
    return NextResponse.json({ error: "Имя и телефон обязательны" }, { status: 400 });
  }

  const key = process.env.TOPNLAB_KEY;

  // Пока нет реального ключа Topnlab (этап 7) — демо-режим: принимаем и логируем.
  if (!key) {
    console.log("[lead] демо-режим (нет TOPNLAB_KEY):", b);
    return NextResponse.json({ ok: true, demo: true });
  }

  const base = process.env.TOPNLAB_BASE_URL ?? "https://agencies-p.topnlab.ru";
  const res = await fetch(`${base}/call/main/importClient/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      appkey: key,
      fullname: b.fullname,
      phone: b.phone,
      comment: b.comment ?? "",
      action: b.action ?? 1,
      object_type: b.objectType ?? "flat",
      called_for_object_short_id: b.objectShortId,
    }),
  });

  if (!res.ok) return NextResponse.json({ error: "Topnlab error" }, { status: 502 });
  return NextResponse.json({ ok: true });
}
