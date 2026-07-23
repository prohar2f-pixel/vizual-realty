# Property Content Normalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Исправить рамку аватара и привести адреса и описания всех объектов к аккуратному виду, соответствующему данным Topnlab.

**Architecture:** Чистые функции в `src/lib/property-content.ts` нормализуют описание и собирают полный адрес из составных полей Topnlab. Отдельный безопасный скрипт обновляет только `address` и `description` существующих объектов, не затрагивая цены, фотографии и привязки менеджеров. Страница объекта использует те же функции как защиту для старых записей.

**Tech Stack:** Next.js 16, React 19, TypeScript, Prisma/PostgreSQL, Vitest, Tailwind CSS, Topnlab API.

## Global Constraints

- Форма заявки и маршрут `/api/lead` не изменяются.
- HTML из CRM не исполняется через `dangerouslySetInnerHTML`.
- Структура базы данных не изменяется.
- Синхронизация контента обновляет только `address` и `description`.
- Неполная карточка Topnlab не должна останавливать обработку остальных объектов.
- На рабочий сайт изменения попадают только после локального просмотра заказчиком.

---

### Task 1: Нормализация описания и полного адреса

**Files:**
- Create: `src/lib/property-content.ts`
- Create: `test/property-content.test.ts`

**Interfaces:**
- Produces: `normalizePropertyDescription(value: string | null | undefined): string | undefined`
- Produces: `formatTopnlabAddress(entity: Record<string, unknown>): string | undefined`

- [ ] **Step 1: Write failing description tests**

```ts
import { describe, expect, test } from "vitest";
import {
  formatTopnlabAddress,
  normalizePropertyDescription,
} from "../src/lib/property-content";

describe("normalizePropertyDescription", () => {
  test("converts CRM line breaks to clean text paragraphs", () => {
    expect(
      normalizePropertyDescription(
        "Первая строка<br />Вторая строка<br><br/>Телефон&nbsp;агента",
      ),
    ).toBe("Первая строка\nВторая строка\n\nТелефон агента");
  });

  test("removes remaining markup without executing it", () => {
    expect(
      normalizePropertyDescription(
        "<p>Описание &amp; детали</p><script>alert(1)</script>",
      ),
    ).toBe("Описание & детали");
  });

  test("returns undefined for empty markup", () => {
    expect(normalizePropertyDescription("<br><p> </p>")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run description tests and verify RED**

Run: `npm.cmd test -- test/property-content.test.ts`

Expected: FAIL because `src/lib/property-content.ts` does not exist.

- [ ] **Step 3: Implement description normalization**

```ts
const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  nbsp: " ",
  quot: '"',
};

function decodeEntities(value: string): string {
  return value
    .replace(/&([a-z]+);/gi, (match, name: string) =>
      Object.prototype.hasOwnProperty.call(NAMED_ENTITIES, name.toLowerCase())
        ? NAMED_ENTITIES[name.toLowerCase()]
        : match,
    )
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCodePoint(Number(code)),
    );
}

export function normalizePropertyDescription(
  value: string | null | undefined,
): string | undefined {
  if (!value) return undefined;

  const normalized = decodeEntities(
    value
      .replace(/<(?:script|style)\b[^>]*>[\s\S]*?<\/(?:script|style)>/gi, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(?:div|h[1-6]|li|p)\s*>/gi, "\n")
      .replace(/<[^>]*>/g, ""),
  )
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return normalized || undefined;
}
```

- [ ] **Step 4: Run description tests and verify GREEN**

Run: `npm.cmd test -- test/property-content.test.ts`

Expected: description tests PASS.

- [ ] **Step 5: Write failing address tests**

Add to `test/property-content.test.ts`:

```ts
describe("formatTopnlabAddress", () => {
  test("builds the CRM address from structured components", () => {
    expect(
      formatTopnlabAddress({
        region: "Донецкая Народная Респ.",
        city: "г. Донецк",
        city_district: "Пролетарский р-н",
        street: "ул. Раздольная",
        house: "д. 26",
        address: "Раздольная ул., 26",
      }),
    ).toBe(
      "Донецкая Народная Респ., г. Донецк, Пролетарский р-н, ул. Раздольная, д. 26",
    );
  });

  test("supports nested Topnlab values and removes duplicates", () => {
    expect(
      formatTopnlabAddress({
        region: { name: "ДНР" },
        city: { name: "Донецк" },
        district: { name: "Донецк" },
        street: { name: "Артёма ул." },
        house_number: "15",
      }),
    ).toBe("ДНР, Донецк, Артёма ул., 15");
  });

  test("falls back to the ready or legacy address", () => {
    expect(formatTopnlabAddress({ full_address: "г. Донецк, ул. Мира, д. 7" }))
      .toBe("г. Донецк, ул. Мира, д. 7");
    expect(formatTopnlabAddress({ address: "Мира ул., 7" }))
      .toBe("Мира ул., 7");
  });
});
```

- [ ] **Step 6: Run address tests and verify RED**

Run: `npm.cmd test -- test/property-content.test.ts`

Expected: FAIL because `formatTopnlabAddress` is not exported.

- [ ] **Step 7: Implement robust address formatting**

Add to `src/lib/property-content.ts`:

```ts
function textValue(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" || typeof value === "number") {
      const text = String(value).trim();
      if (text) return text;
    }
    if (value && typeof value === "object" && "name" in value) {
      const text = String((value as { name?: unknown }).name ?? "").trim();
      if (text) return text;
    }
  }
  return undefined;
}

export function formatTopnlabAddress(
  entity: Record<string, unknown>,
): string | undefined {
  const structured = [
    textValue(entity.region_name, entity.region),
    textValue(entity.city_name, entity.locality, entity.city),
    textValue(
      entity.city_district_name,
      entity.city_district,
      entity.district_name,
      entity.district,
    ),
    textValue(entity.street_name, entity.street),
    textValue(entity.house, entity.house_number, entity.building),
  ].filter((part): part is string => Boolean(part));

  const unique = structured.filter(
    (part, index) =>
      structured.findIndex(
        (candidate) => candidate.toLocaleLowerCase("ru") === part.toLocaleLowerCase("ru"),
      ) === index,
  );

  if (unique.length >= 2) return unique.join(", ");

  return textValue(
    entity.full_address,
    entity.address_full,
    entity.formatted_address,
    entity.address,
  );
}
```

- [ ] **Step 8: Run tests and commit**

Run: `npm.cmd test -- test/property-content.test.ts`

Expected: all tests in the file PASS.

```bash
git add src/lib/property-content.ts test/property-content.test.ts
git commit -m "feat: normalize property descriptions and addresses"
```

---

### Task 2: Карточка менеджера и безопасное отображение описания

**Files:**
- Modify: `src/components/AgentCard.tsx`
- Modify: `src/app/object/[id]/page.tsx`
- Create: `test/agent-card.test.tsx`

**Interfaces:**
- Consumes: `normalizePropertyDescription`
- Produces: avatar with a 3 px brand ring and white offset

- [ ] **Step 1: Write the failing avatar test**

```tsx
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { AgentCard } from "../src/components/AgentCard";

test("manager avatar has the brand ring and white offset", () => {
  const html = renderToStaticMarkup(
    <AgentCard
      name="Аянот Елена"
      phone="+7 949 537 55 65"
      photo="/managers/ayanot-elena-card.webp"
    />,
  );

  expect(html).toContain("ring-[3px]");
  expect(html).toContain("ring-brand");
  expect(html).toContain("ring-offset-2");
  expect(html).toContain("ring-offset-white");
});
```

- [ ] **Step 2: Run avatar test and verify RED**

Run: `npm.cmd test -- test/agent-card.test.tsx`

Expected: FAIL because the current image has no ring classes.

- [ ] **Step 3: Add the green avatar ring**

Change the avatar class in `AgentCard.tsx` to:

```tsx
className="mx-auto h-24 w-24 rounded-full object-cover ring-[3px] ring-brand ring-offset-2 ring-offset-white"
```

- [ ] **Step 4: Use the description fallback on the object page**

In `src/app/object/[id]/page.tsx`, import:

```ts
import { normalizePropertyDescription } from "@/lib/property-content";
```

After resolving the manager, calculate:

```ts
const description = normalizePropertyDescription(p.description);
```

Render:

```tsx
{description && (
  <div className="mt-5 whitespace-pre-line text-[15px] leading-7 text-stone-700">
    {description}
  </div>
)}
```

Use the normalized description in metadata:

```ts
description: normalizePropertyDescription(p.description),
```

- [ ] **Step 5: Run focused and full tests**

Run: `npm.cmd test -- test/agent-card.test.tsx test/property-content.test.ts`

Expected: PASS.

Run: `npm.cmd test`

Expected: all test files PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/AgentCard.tsx src/app/object/[id]/page.tsx test/agent-card.test.tsx
git commit -m "fix: polish manager and property content"
```

---

### Task 3: Безопасное обновление адресов и описаний

**Files:**
- Modify: `src/lib/topnlab/map.ts`
- Create: `src/lib/topnlab/content.ts`
- Create: `scripts/sync-property-content.ts`
- Modify: `package.json`
- Modify: `test/topnlab.test.ts`
- Create: `test/property-content-sync.test.ts`

**Interfaces:**
- Consumes: `formatTopnlabAddress`, `normalizePropertyDescription`, `getIds`, `getEntities`, Prisma `db`
- Produces: `mapTopnlabEntity` with normalized `address` and `description`
- Produces: `syncPropertyContent(): Promise<{ updated: number; skipped: number }>`
- Produces: npm command `sync:content`

- [ ] **Step 1: Write failing mapper assertions**

Extend the Topnlab fixture with structured address fields and an HTML description, then add:

```ts
expect(mapped.address).toBe(
  "Донецкая Народная Респ., г. Донецк, Пролетарский р-н, ул. Раздольная, д. 26",
);
expect(mapped.description).toBe("Первая строка\nВторая строка");
```

- [ ] **Step 2: Run mapper test and verify RED**

Run: `npm.cmd test -- test/topnlab.test.ts`

Expected: FAIL because the mapper returns raw `address` and `description`.

- [ ] **Step 3: Normalize mapper fields**

In `src/lib/topnlab/map.ts`:

```ts
import {
  formatTopnlabAddress,
  normalizePropertyDescription,
} from "../property-content";
```

Replace the two mappings with:

```ts
address: formatTopnlabAddress(e) ?? undefined,
description: normalizePropertyDescription(e.description),
```

- [ ] **Step 4: Run mapper test and verify GREEN**

Run: `npm.cmd test -- test/topnlab.test.ts`

Expected: PASS.

- [ ] **Step 5: Write a failing content-sync test**

Create `test/property-content-sync.test.ts` around an exported pure helper:

```ts
import { expect, test } from "vitest";
import { propertyContentUpdate } from "../src/lib/topnlab/content";

test("content sync updates only address and description", () => {
  expect(
    propertyContentUpdate({
      region: "ДНР",
      city: "Донецк",
      street: "ул. Мира",
      house: "д. 7",
      description: "Строка 1<br />Строка 2",
      price: 9_999_999,
    }),
  ).toEqual({
    address: "ДНР, Донецк, ул. Мира, д. 7",
    description: "Строка 1\nСтрока 2",
  });
});
```

- [ ] **Step 6: Run sync test and verify RED**

Run: `npm.cmd test -- test/property-content-sync.test.ts`

Expected: FAIL because `src/lib/topnlab/content.ts` does not exist.

- [ ] **Step 7: Implement the pure update helper and synchronization**

In `src/lib/topnlab/content.ts`:

```ts
import { db } from "../db";
import {
  formatTopnlabAddress,
  normalizePropertyDescription,
} from "../property-content";
import { getEntities, getIds } from "./client";

export function propertyContentUpdate(entity: Record<string, unknown>) {
  const address = formatTopnlabAddress(entity);
  const description = normalizePropertyDescription(
    typeof entity.description === "string" ? entity.description : undefined,
  );

  return {
    ...(address ? { address } : {}),
    ...(description ? { description } : {}),
  };
}

export async function syncPropertyContent() {
  const ids = [...new Set([...(await getIds("sale")), ...(await getIds("rent"))])];
  const entities = await getEntities(ids);
  const existing = new Set(
    (
      await db.property.findMany({
        where: { id: { in: entities.map((entity) => String(entity.id)) } },
        select: { id: true },
      })
    ).map(({ id }) => id),
  );

  let updated = 0;
  let skipped = 0;

  for (const entity of entities) {
    const id = String(entity.id);
    if (!existing.has(id)) {
      skipped += 1;
      continue;
    }

    const data = propertyContentUpdate(entity);
    if (Object.keys(data).length === 0) {
      skipped += 1;
      continue;
    }

    await db.property.update({ where: { id }, data });
    updated += 1;
  }

  return { updated, skipped };
}
```

In `scripts/sync-property-content.ts`:

```ts
import "dotenv/config";
import { syncPropertyContent } from "../src/lib/topnlab/content";

syncPropertyContent()
  .then(({ updated, skipped }) => {
    console.log(`updated property content: ${updated}`);
    console.log(`skipped property content: ${skipped}`);
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
```

Add to `package.json`:

```json
"sync:content": "tsx scripts/sync-property-content.ts"
```

- [ ] **Step 8: Run tests and commit**

Run: `npm.cmd test -- test/property-content-sync.test.ts test/topnlab.test.ts`

Expected: PASS.

Run: `npm.cmd test`

Expected: all tests PASS.

```bash
git add src/lib/topnlab/map.ts src/lib/topnlab/content.ts scripts/sync-property-content.ts package.json test/topnlab.test.ts test/property-content-sync.test.ts test/fixtures/topnlab-entity.json
git commit -m "feat: sync clean property content"
```

---

### Task 4: Сборка и локальная визуальная проверка

**Files:**
- No production file changes expected

**Interfaces:**
- Consumes: completed Tasks 1-3
- Produces: verified local build and visual approval

- [ ] **Step 1: Run complete verification**

Run: `npm.cmd test`

Expected: all tests PASS with no failures.

Run: `npm.cmd run build`

Expected: Next.js production build completes successfully.

- [ ] **Step 2: Start local application**

Run: `npm.cmd run dev`

Expected: local Next.js server starts without a runtime error.

- [ ] **Step 3: Inspect three object variants**

Open three local object pages:

1. an object with `<br />` in the description;
2. an object with a structured full address;
3. an object with only the legacy short address.

Verify:

- no literal `<br />` is visible;
- paragraphs have stable spacing and line height;
- address is one readable string;
- the manager avatar has a green circular frame;
- desktop and mobile layouts have no overlap.

- [ ] **Step 4: Ask the customer to approve the local preview**

Do not push or deploy before the customer approves the browser preview.

---

### Task 5: Production rollout after approval

**Files:**
- No additional source changes expected

**Interfaces:**
- Consumes: approved local preview
- Produces: GitHub `main`, rebuilt production app, normalized production content

- [ ] **Step 1: Push the reviewed commits**

```bash
git push origin HEAD:main
```

Expected: GitHub accepts the commits.

- [ ] **Step 2: Deploy the exact reviewed source files**

On the Beget server in `/home/vizual/app`, fetch `origin/main`, check out the reviewed files, install only if the lockfile changed, build the app, and restart the `vizual` PM2 process.

Expected: `pm2 status` shows `vizual` as `online`.

- [ ] **Step 3: Update production content**

Run:

```bash
node_modules/.bin/tsx scripts/sync-property-content.ts
```

Expected: output contains `updated property content: N`, where `N` is greater than zero.

- [ ] **Step 4: Verify production**

Open the live versions of the same three objects and confirm the address, description and manager border. Keep one corrected object page open for customer review.
