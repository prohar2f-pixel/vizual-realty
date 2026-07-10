import { test, expect, vi, beforeEach } from "vitest";
import { POST } from "../src/app/api/lead/route";

beforeEach(() => {
  process.env.TOPNLAB_KEY = "testkey";
  vi.restoreAllMocks();
});

test("без имени или телефона — 400", async () => {
  const req = new Request("http://x/api/lead", {
    method: "POST",
    body: JSON.stringify({ fullname: "", phone: "" }),
  });
  const res = await POST(req);
  expect(res.status).toBe(400);
});

test("отправляет заявку в Topnlab и возвращает ok", async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
  vi.stubGlobal("fetch", fetchMock);
  const req = new Request("http://x/api/lead", {
    method: "POST",
    body: JSON.stringify({
      fullname: "Иван",
      phone: "79990001122",
      comment: "Интересует объект",
      objectShortId: 53020,
      action: 1,
      objectType: "flat",
    }),
  });
  const res = await POST(req);
  expect(res.status).toBe(200);
  expect(fetchMock).toHaveBeenCalledWith(
    expect.stringContaining("/call/main/importClient/"),
    expect.objectContaining({ method: "POST" }),
  );
});
