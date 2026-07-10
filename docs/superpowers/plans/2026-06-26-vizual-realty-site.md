# Сайт агентства недвижимости «Визуал» — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Построить корпоративный сайт-витрину агентства недвижимости с каталогом 200+ объектов, который автоматически синхронизируется с CRM Topnlab, и формой заявки, отправляющей лиды обратно в CRM.

**Architecture:** Next.js (App Router, TypeScript) рендерит страницы на сервере (SSR/SSG — ради SEO каталога). PostgreSQL (через Prisma) хранит кэш объектов и агентов. Фоновая синхронизация тянет объекты из Topnlab (`get-ids` → `get-entities`) с учётом лимита 1 запрос / 6 сек; webhook от Topnlab обновляет отдельные объекты в реальном времени. Форма «Написать» шлёт заявку напрямую в Topnlab (`importClient`). Деплой на Railway (приложение + Postgres).

**Tech Stack:** Next.js 15 (App Router, TS) · PostgreSQL + Prisma · Tailwind CSS · Vitest (юнит-тесты) · Railway (деплой).

---

## Открытые зависимости (нужно от агентства)

Эти пункты **не блокируют старт** — фазы 0–3 строятся на тестовых данных. Реальные данные подключаются на фазе 7.

- [ ] **API-ключ Topnlab** (`key`) — без него нельзя тянуть реальные объекты.
- [ ] На объектах в Topnlab выставлен `is_feed=true`.
- [ ] Зарегистрирован наш **webhook-URL** в настройках Topnlab (после деплоя).
- [ ] **Логотип** клиента (изумрудный/золотой/белый) — для точных цветов дизайна.
- [ ] Контент статических страниц: текст «О нас», фото и данные агентов, адрес офиса, телефоны.
- [ ] Город агентства подтверждён (в ТЗ — Донецк, в реквизитах ИП — Краснодарский край).
- [ ] Реальный пример ответа `get-entities` (для проверки названий полей в маппинге — Задача 1.3).

## Источники истины

- ТЗ: `vizual-realty/ТЗ_Виталий.txt`
- API Topnlab: `vizual-realty/realty-project/topnlab-api.md` (+ PDF)
- КП: `vizual-realty/КП/kp-realty.html`
- Дизайн-референс: ndv.ru; фирменные цвета — изумрудный / золотой / белый, стиль премиум.

## Структура файлов (приложение в `vizual-realty/site/`)

```
vizual-realty/site/
├─ prisma/
│   └─ schema.prisma            # модели Property, Agent
├─ src/
│   ├─ lib/
│   │   ├─ db.ts                # singleton PrismaClient
│   │   ├─ topnlab/
│   │   │   ├─ client.ts        # запросы к Topnlab API (get-ids, get-entities, importClient)
│   │   │   ├─ map.ts           # маппинг ответа Topnlab → наша модель (единственное место правки полей)
│   │   │   └─ sync.ts          # полная и инкрементальная синхронизация в БД
│   │   └─ rate-limit.ts        # утилита «не чаще 1 запроса в N мс»
│   ├─ app/
│   │   ├─ layout.tsx           # общий каркас, шрифты, шапка/футер
│   │   ├─ page.tsx             # Главная: лучшие объекты + о компании
│   │   ├─ catalog/page.tsx     # Каталог + фильтры (цена, комнаты, район)
│   │   ├─ object/[id]/page.tsx # Карточка объекта + агент
│   │   ├─ team/page.tsx        # Наша команда
│   │   ├─ about/page.tsx       # О нас
│   │   ├─ contacts/page.tsx    # Контакты
│   │   └─ api/
│   │       ├─ lead/route.ts    # POST формы «Написать» → Topnlab importClient
│   │       └─ webhook/route.ts # POST от Topnlab → обновить объект в БД
│   ├─ components/              # CatalogFilters, PropertyCard, AgentCard, LeadForm, …
│   └─ styles/tokens.css        # дизайн-токены: изумруд/золото/белый
├─ test/
│   ├─ fixtures/topnlab-entity.json
│   ├─ map.test.ts
│   ├─ rate-limit.test.ts
│   ├─ lead.test.ts
│   └─ webhook.test.ts
├─ scripts/sync.ts             # запуск полной синхронизации (npm run sync)
├─ .env.example
└─ package.json
```

---

## Фаза 0. Каркас проекта

### Task 0.1: Инициализация Next.js + инструменты

**Files:**
- Create: `vizual-realty/site/` (весь скелет Next.js)
- Create: `vizual-realty/site/.env.example`

- [ ] **Step 1: Создать проект**

Run:
```bash
cd vizual-realty
npx create-next-app@latest site --ts --tailwind --app --src-dir --eslint --use-npm --no-import-alias
cd site
npm install prisma @prisma/client
npm install -D vitest
npx prisma init
```

- [ ] **Step 2: Настроить тестовый скрипт**

В `package.json` добавить в `"scripts"`:
```json
"test": "vitest run",
"test:watch": "vitest",
"sync": "tsx scripts/sync.ts"
```
Установить раннер TS-скриптов:
```bash
npm install -D tsx
```

- [ ] **Step 3: Заполнить `.env.example`**

```
DATABASE_URL="postgresql://user:pass@localhost:5432/vizual?schema=public"
TOPNLAB_KEY="заменить-на-реальный-ключ"
TOPNLAB_BASE_URL="https://agencies-p.topnlab.ru"
```

- [ ] **Step 4: Проверка сборки**

Run: `npm run build`
Expected: сборка проходит без ошибок.

- [ ] **Step 5: Commit**

```bash
git init
git add .
git commit -m "chore: scaffold Next.js + Prisma + Vitest"
```

---

## Фаза 1. Данные: модель, маппинг, синхронизация

### Task 1.1: Схема БД (Prisma)

**Files:**
- Modify: `vizual-realty/site/prisma/schema.prisma`

- [ ] **Step 1: Описать модели**

```prisma
model Agent {
  id        String     @id            // внешний id из Topnlab
  name      String
  phone     String?
  photoUrl  String?
  properties Property[]
}

model Property {
  id          String   @id           // внешний id из Topnlab
  shortId     Int?                    // called_for_object_short_id для формы
  deal        String                  // "sale" | "rent"
  objectType  String                  // flat | room | commerce | house | land | garage
  title       String
  price       Int
  rooms       Int?
  area        Float?
  district    String?
  address     String?
  description String?
  photos      String[]                // массив URL
  isFeed      Boolean  @default(true)
  agent       Agent?   @relation(fields: [agentId], references: [id])
  agentId     String?
  updatedAt   DateTime @updatedAt
}
```

- [ ] **Step 2: Применить миграцию (на локальной БД)**

Run: `npx prisma migrate dev --name init`
Expected: создаются таблицы `Agent`, `Property`.

- [ ] **Step 3: Commit**

```bash
git add prisma/
git commit -m "feat(db): Property and Agent models"
```

### Task 1.2: Утилита рейт-лимита (TDD)

**Files:**
- Create: `vizual-realty/site/src/lib/rate-limit.ts`
- Test: `vizual-realty/site/test/rate-limit.test.ts`

- [ ] **Step 1: Написать падающий тест**

```ts
import { test, expect } from "vitest";
import { RateLimiter } from "../src/lib/rate-limit";

test("ждёт минимум интервал между разрешениями", async () => {
  const rl = new RateLimiter(50); // 50 мс
  const t0 = Date.now();
  await rl.wait();
  await rl.wait();
  expect(Date.now() - t0).toBeGreaterThanOrEqual(50);
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `npx vitest run test/rate-limit.test.ts`
Expected: FAIL (модуль не найден).

- [ ] **Step 3: Реализовать**

```ts
export class RateLimiter {
  private last = 0;
  constructor(private intervalMs: number) {}
  async wait(): Promise<void> {
    const now = Date.now();
    const waitMs = this.last + this.intervalMs - now;
    if (waitMs > 0) await new Promise((r) => setTimeout(r, waitMs));
    this.last = Date.now();
  }
}
```

- [ ] **Step 4: Запустить — зелёный**

Run: `npx vitest run test/rate-limit.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/rate-limit.ts test/rate-limit.test.ts
git commit -m "feat: rate limiter for Topnlab API"
```

### Task 1.3: Маппинг ответа Topnlab → модель (TDD)

> ⚠️ Названия полей в фикстуре — лучшее предположение по документации. Когда придёт реальный ответ `get-entities` (см. открытые зависимости), обновить фикстуру и `map.ts` одной правкой; тесты подскажут регрессии.

**Files:**
- Create: `vizual-realty/site/test/fixtures/topnlab-entity.json`
- Create: `vizual-realty/site/src/lib/topnlab/map.ts`
- Test: `vizual-realty/site/test/map.test.ts`

- [ ] **Step 1: Фикстура ответа**

`test/fixtures/topnlab-entity.json`:
```json
{
  "id": "1233",
  "short_id": 53020,
  "deal": "sale",
  "object_type": "flat",
  "title": "2-комн. квартира, ул. Артёма 15",
  "price": 4500000,
  "rooms": 2,
  "area": 54.3,
  "district": "Центр",
  "address": "ул. Артёма, 15",
  "description": "Светлая квартира с ремонтом",
  "photos": ["https://cdn.topnlab.ru/1.jpg", "https://cdn.topnlab.ru/2.jpg"],
  "is_feed": true,
  "agent": { "id": "77", "name": "Ольга Петрова", "phone": "79991112233", "photo": "https://cdn.topnlab.ru/agent77.jpg" }
}
```

- [ ] **Step 2: Падающий тест**

```ts
import { test, expect } from "vitest";
import entity from "./fixtures/topnlab-entity.json";
import { mapTopnlabEntity } from "../src/lib/topnlab/map";

test("маппит объект Topnlab в нашу модель", () => {
  const p = mapTopnlabEntity(entity);
  expect(p.id).toBe("1233");
  expect(p.shortId).toBe(53020);
  expect(p.price).toBe(4500000);
  expect(p.photos).toHaveLength(2);
  expect(p.agent?.name).toBe("Ольга Петрова");
});
```

- [ ] **Step 3: Запустить — падает**

Run: `npx vitest run test/map.test.ts`
Expected: FAIL.

- [ ] **Step 4: Реализовать маппинг**

```ts
export type MappedAgent = { id: string; name: string; phone?: string; photoUrl?: string };
export type MappedProperty = {
  id: string; shortId?: number; deal: string; objectType: string; title: string;
  price: number; rooms?: number; area?: number; district?: string; address?: string;
  description?: string; photos: string[]; isFeed: boolean; agent?: MappedAgent;
};

export function mapTopnlabEntity(e: any): MappedProperty {
  return {
    id: String(e.id),
    shortId: e.short_id ?? undefined,
    deal: e.deal,
    objectType: e.object_type,
    title: e.title,
    price: Number(e.price),
    rooms: e.rooms ?? undefined,
    area: e.area ?? undefined,
    district: e.district ?? undefined,
    address: e.address ?? undefined,
    description: e.description ?? undefined,
    photos: Array.isArray(e.photos) ? e.photos : [],
    isFeed: e.is_feed !== false,
    agent: e.agent
      ? { id: String(e.agent.id), name: e.agent.name, phone: e.agent.phone, photoUrl: e.agent.photo }
      : undefined,
  };
}
```

- [ ] **Step 5: Запустить — зелёный**

Run: `npx vitest run test/map.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/topnlab/map.ts test/map.test.ts test/fixtures/
git commit -m "feat(topnlab): entity mapping with fixture test"
```

### Task 1.4: Клиент Topnlab (get-ids, get-entities)

**Files:**
- Create: `vizual-realty/site/src/lib/topnlab/client.ts`

- [ ] **Step 1: Реализовать клиент**

```ts
import { RateLimiter } from "../rate-limit";

const BASE = process.env.TOPNLAB_BASE_URL ?? "https://agencies-p.topnlab.ru";
const KEY = process.env.TOPNLAB_KEY ?? "";
const limiter = new RateLimiter(6000); // 1 запрос / 6 сек

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
```

- [ ] **Step 2: Проверка типов/сборки**

Run: `npx tsc --noEmit`
Expected: без ошибок.

- [ ] **Step 3: Commit**

```bash
git add src/lib/topnlab/client.ts
git commit -m "feat(topnlab): API client get-ids/get-entities with rate limit"
```

### Task 1.5: Синхронизация в БД + скрипт запуска

**Files:**
- Create: `vizual-realty/site/src/lib/db.ts`
- Create: `vizual-realty/site/src/lib/topnlab/sync.ts`
- Create: `vizual-realty/site/scripts/sync.ts`

- [ ] **Step 1: PrismaClient singleton**

`src/lib/db.ts`:
```ts
import { PrismaClient } from "@prisma/client";
export const db = new PrismaClient();
```

- [ ] **Step 2: Upsert одного объекта + полная синхронизация**

`src/lib/topnlab/sync.ts`:
```ts
import { db } from "../db";
import { getIds, getEntities } from "./client";
import { mapTopnlabEntity, MappedProperty } from "./map";

export async function upsertProperty(p: MappedProperty) {
  if (p.agent) {
    await db.agent.upsert({
      where: { id: p.agent.id },
      update: { name: p.agent.name, phone: p.agent.phone, photoUrl: p.agent.photoUrl },
      create: { id: p.agent.id, name: p.agent.name, phone: p.agent.phone, photoUrl: p.agent.photoUrl },
    });
  }
  const { agent, ...data } = p;
  await db.property.upsert({
    where: { id: p.id },
    update: { ...data, agentId: agent?.id ?? null },
    create: { ...data, agentId: agent?.id ?? null },
  });
}

export async function fullSync() {
  const ids = [...(await getIds("sale")), ...(await getIds("rent"))];
  const entities = await getEntities(ids);
  for (const e of entities) await upsertProperty(mapTopnlabEntity(e));
  return entities.length;
}
```

- [ ] **Step 3: Скрипт**

`scripts/sync.ts`:
```ts
import { fullSync } from "../src/lib/topnlab/sync";
fullSync().then((n) => { console.log(`synced ${n}`); process.exit(0); })
  .catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/db.ts src/lib/topnlab/sync.ts scripts/sync.ts
git commit -m "feat(topnlab): full sync into PostgreSQL"
```

---

## Фаза 2. Каталог и карточки объектов (UI)

> UI-фазы итерируем визуально (см. навык `frontend-design`/`impeccable`), а не чистым TDD. Каждая задача = один экран/компонент с чёткой ответственностью. Данные читаем из БД на сервере (Server Components).

### Task 2.1: Список объектов в каталоге
**Files:** Create `src/app/catalog/page.tsx`, `src/components/PropertyCard.tsx`
- [ ] Серверный компонент читает `db.property.findMany({ where: { isFeed: true } })`, рендерит сетку `PropertyCard` (фото, цена, комнаты, район, адрес).
- [ ] Пустое состояние («Объекты скоро появятся») когда БД пуста.
- [ ] Commit: `feat(catalog): property list page`

### Task 2.2: Фильтры (цена, комнаты, район)
**Files:** Create `src/components/CatalogFilters.tsx`; Modify `src/app/catalog/page.tsx`
- [ ] Фильтры через query-параметры URL (`?rooms=2&priceMax=…&district=…`), фильтрация в запросе Prisma. Районы — `distinct` из БД.
- [ ] Commit: `feat(catalog): filters by price/rooms/district`

### Task 2.3: Карточка объекта
**Files:** Create `src/app/object/[id]/page.tsx`, `src/components/AgentCard.tsx`
- [ ] Галерея фото, характеристики, описание; блок агента (фото, имя, кнопки «Позвонить»/«Написать»).
- [ ] `generateMetadata` (title/description/OG) для SEO; 404 если объекта нет.
- [ ] Commit: `feat(object): detail page with agent`

---

## Фаза 3. Статические страницы и дизайн-система

### Task 3.1: Дизайн-токены и каркас
**Files:** Create `src/styles/tokens.css`; Modify `src/app/layout.tsx`, `tailwind.config.ts`
- [ ] Палитра и типографика — точные значения из `vizual-realty/docs/brand.md` (изумруд `#0E5A43`, золото `#D4A437`, кремовый `#F4F1E9`; заголовки — Playfair Display, текст — Inter).
- [ ] Шапка с навигацией (Главная, Каталог, О нас, Команда, Контакты) и футер.
- [ ] Commit: `feat(ui): design tokens, header, footer`

### Task 3.2: Главная
**Files:** Create `src/app/page.tsx`
- [ ] Геро-блок, подборка лучших объектов (из БД), краткий блок о компании, призыв к действию.
- [ ] Commit: `feat(home): landing page`

### Task 3.3: О нас / Команда / Контакты
**Files:** Create `src/app/about/page.tsx`, `src/app/team/page.tsx`, `src/app/contacts/page.tsx`
- [ ] «Команда» — агенты из `db.agent.findMany()`. «Контакты» — адрес, телефоны, email, карта (embed). Тексты — заглушки до получения контента от клиента.
- [ ] Commit: `feat(pages): about, team, contacts`

---

## Фаза 4. Форма «Написать» → Topnlab (TDD)

### Task 4.1: API-роут отправки заявки

**Files:**
- Create: `vizual-realty/site/src/app/api/lead/route.ts`
- Test: `vizual-realty/site/test/lead.test.ts`

- [ ] **Step 1: Падающий тест (мокаем fetch к Topnlab)**

```ts
import { test, expect, vi } from "vitest";
import { POST } from "../src/app/api/lead/route";

test("отправляет заявку в Topnlab и возвращает ok", async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
  vi.stubGlobal("fetch", fetchMock);
  const req = new Request("http://x/api/lead", {
    method: "POST",
    body: JSON.stringify({ fullname: "Иван", phone: "79990001122", comment: "Интересует объект", objectShortId: 53020, action: 1, objectType: "flat" }),
  });
  const res = await POST(req);
  expect(res.status).toBe(200);
  expect(fetchMock).toHaveBeenCalledWith(
    expect.stringContaining("/call/main/importClient/"),
    expect.objectContaining({ method: "POST" })
  );
});
```

- [ ] **Step 2: Запустить — падает**

Run: `npx vitest run test/lead.test.ts`
Expected: FAIL.

- [ ] **Step 3: Реализовать роут**

```ts
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const b = await req.json();
  if (!b.fullname || !b.phone) {
    return NextResponse.json({ error: "Имя и телефон обязательны" }, { status: 400 });
  }
  const base = process.env.TOPNLAB_BASE_URL ?? "https://agencies-p.topnlab.ru";
  const res = await fetch(`${base}/call/main/importClient/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      appkey: process.env.TOPNLAB_KEY,
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
```

- [ ] **Step 4: Запустить — зелёный**

Run: `npx vitest run test/lead.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/lead/route.ts test/lead.test.ts
git commit -m "feat(lead): submit form to Topnlab importClient"
```

### Task 4.2: Компонент формы + кнопки
**Files:** Create `src/components/LeadForm.tsx`; Modify карточку объекта
- [ ] Форма (имя, телефон/email, сообщение, скрытый id объекта) → `POST /api/lead`; состояния успех/ошибка. Кнопка «Позвонить» = `tel:` ссылка на телефон агента.
- [ ] Commit: `feat(lead): form UI + call button`

---

## Фаза 5. Webhook реального времени (TDD)

### Task 5.1: Приём обновлений от Topnlab

**Files:**
- Create: `vizual-realty/site/src/app/api/webhook/route.ts`
- Test: `vizual-realty/site/test/webhook.test.ts`

- [ ] **Step 1: Падающий тест**

```ts
import { test, expect, vi } from "vitest";
import * as sync from "../src/lib/topnlab/sync";
import * as client from "../src/lib/topnlab/client";
import { POST } from "../src/app/api/webhook/route";

test("на realty-объект обновляет запись в БД", async () => {
  vi.spyOn(client, "getEntities").mockResolvedValue([{ id: "1233", title: "x", price: 1, photos: [], object_type: "flat", deal: "sale" }]);
  const up = vi.spyOn(sync, "upsertProperty").mockResolvedValue(undefined as any);
  const req = new Request("http://x/api/webhook", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "id=1233&type=realty",
  });
  const res = await POST(req);
  expect(res.status).toBe(200);
  expect(up).toHaveBeenCalled();
});
```

- [ ] **Step 2: Запустить — падает**

Run: `npx vitest run test/webhook.test.ts`
Expected: FAIL.

- [ ] **Step 3: Реализовать**

```ts
import { NextResponse } from "next/server";
import { getEntities } from "../../../lib/topnlab/client";
import { upsertProperty } from "../../../lib/topnlab/sync";
import { mapTopnlabEntity } from "../../../lib/topnlab/map";

export async function POST(req: Request) {
  const form = new URLSearchParams(await req.text());
  const id = form.get("id");
  const type = form.get("type");
  if (type !== "realty" || !id) return NextResponse.json({ ok: true }); // заявки (order) игнорируем
  const [entity] = await getEntities([id]);
  if (entity) await upsertProperty(mapTopnlabEntity(entity));
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Запустить — зелёный**

Run: `npx vitest run test/webhook.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/webhook/route.ts test/webhook.test.ts
git commit -m "feat(webhook): realtime property updates from Topnlab"
```

---

## Фаза 6. Деплой и SEO

### Task 6.1: Railway
- [ ] Создать проект на Railway, добавить плагин PostgreSQL, прописать `DATABASE_URL`, `TOPNLAB_KEY`, `TOPNLAB_BASE_URL` в переменные окружения; задеплоить из репозитория; прогнать `prisma migrate deploy`.
- [ ] Зарегистрировать публичный webhook-URL (`https://<домен>/api/webhook`) в Topnlab.

### Task 6.2: SEO-базис
- [ ] `sitemap.ts` (объекты + статические страницы), `robots.ts`, метатеги/OG на карточках и каталоге, человекочитаемые URL.
- [ ] Commit: `feat(seo): sitemap, robots, meta`

---

## Фаза 7. Подключение реальных данных (после получения ключа)
- [ ] Вставить реальный `TOPNLAB_KEY`, выполнить `npm run sync`, сверить названия полей с реальным ответом и при необходимости поправить `src/lib/topnlab/map.ts` + фикстуру (тесты покажут расхождения).
- [ ] Проверить webhook на реальном объекте; заявку с формы — что долетает в CRM.

---

## Self-review (покрытие ТЗ)

- Главная — Фаза 3.2 · Каталог с фильтрами — 2.1/2.2 · Карточка объекта — 2.3 · О нас/Команда/Контакты — 3.3 · Форма «Написать» + «Позвонить» — 4.1/4.2 · Привязка объекта к агенту — 1.1/2.3 · Премиум-стиль (изумруд/золото/белый) — 3.1 · Живой каталог из Topnlab (КП) — Фаза 1 + 5 · PostgreSQL/Railway (КП) — 1.1/6.1 · Сбор контактов посетителей — 4.1.
