import { test, expect, vi, beforeEach } from "vitest";
import * as client from "../src/lib/topnlab/client";
import * as sync from "../src/lib/topnlab/sync";
import { POST } from "../src/app/api/webhook/route";

beforeEach(() => vi.restoreAllMocks());

test("realty-объект: тянет данные и обновляет запись в БД", async () => {
  vi.spyOn(client, "getEntities").mockResolvedValue([
    { id: "1233", title: "x", price: 1, photos: [], object_type: "flat", deal: "sale", is_feed: true },
  ]);
  const up = vi.spyOn(sync, "upsertProperty").mockImplementation(async () => {});
  const req = new Request("http://x/api/webhook", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "id=1233&type=realty",
  });
  const res = await POST(req);
  expect(res.status).toBe(200);
  expect(up).toHaveBeenCalledOnce();
});

test("type=order (заявка): БД не трогаем", async () => {
  const get = vi.spyOn(client, "getEntities").mockResolvedValue([]);
  const up = vi.spyOn(sync, "upsertProperty").mockImplementation(async () => {});
  const req = new Request("http://x/api/webhook", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "id=5&type=order",
  });
  const res = await POST(req);
  expect(res.status).toBe(200);
  expect(get).not.toHaveBeenCalled();
  expect(up).not.toHaveBeenCalled();
});
