import { NextResponse } from "next/server";
import { getEntities } from "../../../lib/topnlab/client";
import { upsertProperty } from "../../../lib/topnlab/sync";
import { mapTopnlabEntity } from "../../../lib/topnlab/map";

// Topnlab шлёт сюда POST при создании/изменении объекта или заявки.
export async function POST(req: Request) {
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
