import { RateLimiter } from "../rate-limit";

const BASE = process.env.TOPNLAB_BASE_URL ?? "https://agencies-p.topnlab.ru";
const KEY = process.env.TOPNLAB_KEY ?? "";
const limiter = new RateLimiter(6000); // лимит Topnlab: 1 запрос / 6 сек

export async function getIds(action: "sale" | "rent"): Promise<string[]> {
  await limiter.wait();
  const url = `${BASE}/public/get-ids?key=${KEY}&type=realty&action=${action}&is_feed=true&deal_state=ad`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`get-ids ${res.status}`);
  return (await res.json()).map(String);
}

export async function getEntities(ids: string[]): Promise<any[]> {
  const out: any[] = [];
  for (let i = 0; i < ids.length; i += 300) {
    await limiter.wait();
    const chunk = ids.slice(i, i + 300).join(",");
    const url = `${BASE}/public/get-entities?id=${chunk}&key=${KEY}&type=realty`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`get-entities ${res.status}`);
    out.push(...(await res.json()));
  }
  return out;
}
