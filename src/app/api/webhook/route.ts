import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getEntities } from "../../../lib/topnlab/client";
import { upsertProperty } from "../../../lib/topnlab/sync";
import { mapTopnlabEntity } from "../../../lib/topnlab/map";

function isAuthorized(request: Request): boolean {
  const expectedSecret = process.env.TOPNLAB_WEBHOOK_SECRET?.trim();
  if (!expectedSecret) return false;

  // Секрет передаётся параметром URL уведомления и никогда не логируется.
  const providedSecret = new URL(request.url).searchParams.get("secret") ?? "";
  const provided = Buffer.from(providedSecret, "utf8");
  const expected = Buffer.from(expectedSecret, "utf8");

  return (
    provided.length === expected.length &&
    timingSafeEqual(provided, expected)
  );
}

// Topnlab шлёт сюда POST при создании/изменении объекта или заявки.
export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401 });
  }

  const form = new URLSearchParams(await req.text());
  const id = form.get("id");
  const type = form.get("type");

  // type=order — это заявка (покупатель), нам в каталог не нужна.
  if (type !== "realty" || !id) {
    return NextResponse.json({ ok: true });
  }

  const [entity] = await getEntities([id]);
  if (entity) await upsertProperty(mapTopnlabEntity(entity));

  return NextResponse.json({ ok: true });
}
