# Catalog Filters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add catalog filters for property type, Topnlab city, city-dependent district, rooms, and inclusive minimum/maximum price.

**Architecture:** Persist normalized Topnlab cities on `Property`, then keep catalog query construction in a small pure helper that can be tested without Prisma or Next.js. The server catalog page loads unique cities and districts from PostgreSQL, while a focused client filter component submits the existing GET form when the city changes so the server can return the correct district list.

**Tech Stack:** Next.js 16.2.9 App Router, React 19.2.4, TypeScript, Prisma 7.8, PostgreSQL, Vitest 4.1.9, Tailwind CSS 4.

## Global Constraints

- Filter order is exactly: property type, city, district, rooms, minimum price, maximum price.
- Property type choices are exactly Apartment (`flat`), House (`house`), and Land plot (`land`), plus the neutral choice.
- City options come from published Topnlab objects; district options come only from the selected city.
- District is disabled until a city is selected.
- Price bounds are inclusive; invalid or negative price values are ignored.
- Objects without `city` remain visible when no city is selected.
- Do not read, print, or commit `.env`; do not deploy or publish without a separate user request.
- Before editing Next.js-dependent files, read the relevant installed guides under `node_modules/next/dist/docs/` as required by `AGENTS.md`.
- On Windows use `npm.cmd`, not `npm`.

---

## File Structure

- Modify `prisma/schema.prisma` — add persisted optional `Property.city`.
- Modify `src/lib/property-content.ts` — extract and normalize a city from Topnlab data.
- Modify `src/lib/topnlab/map.ts` — include `city` in `MappedProperty` and full sync mapping.
- Modify `src/lib/topnlab/content.ts` — include `city` in content-only resynchronization.
- Create `src/lib/catalog-filters.ts` — own search parameter parsing, validation, and Prisma-compatible `where` construction.
- Modify `src/app/catalog/page.tsx` — query city/district options and use the filter helper.
- Modify `src/components/CatalogFilters.tsx` — render the approved controls and submit on city change.
- Modify `test/property-content.test.ts`, `test/map.test.ts`, and `test/property-content-sync.test.ts` — city data behavior.
- Create `test/catalog-filters.test.ts` — pure query-building behavior.
- Create `test/catalog-filters-ui.test.tsx` — filter order, copy, options, and district state.

### Task 1: Persist normalized Topnlab city data

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `src/lib/property-content.ts`
- Modify: `src/lib/topnlab/map.ts`
- Test: `test/property-content.test.ts`
- Test: `test/map.test.ts`

**Interfaces:**
- Produces: `extractTopnlabCity(entity: Record<string, unknown>): string | undefined`
- Produces: `MappedProperty.city?: string`
- Consumes: existing Topnlab keys `city_name`, `locality`, and `city`, including nested `{ name }` values.

- [ ] **Step 1: Install dependencies and verify the isolated baseline**

Run:

```powershell
npm.cmd install
npm.cmd test
```

Expected: dependency generation succeeds and the existing 47 tests pass. If the baseline fails, stop and report the exact pre-existing failure before changing production code.

- [ ] **Step 2: Write failing city extraction and mapping tests**

Add to `test/property-content.test.ts`:

```ts
import { extractTopnlabCity } from "../src/lib/property-content";

describe("extractTopnlabCity", () => {
  test("normalizes plain and nested Topnlab city values", () => {
    expect(extractTopnlabCity({ city: "  г. Донецк  " })).toBe("Донецк");
    expect(extractTopnlabCity({ city_name: { name: "Макеевка" } })).toBe("Макеевка");
  });

  test("returns undefined when the city is absent", () => {
    expect(extractTopnlabCity({ district: "Киевский" })).toBeUndefined();
  });
});
```

Extend the existing mapping test in `test/map.test.ts`:

```ts
expect(p.city).toBe("Донецк");
```

- [ ] **Step 3: Run the focused tests and verify RED**

Run:

```powershell
npm.cmd test -- test/property-content.test.ts test/map.test.ts
```

Expected: FAIL because `extractTopnlabCity` and `MappedProperty.city` do not exist.

- [ ] **Step 4: Implement minimal city persistence and mapping**

In `prisma/schema.prisma`, add beside `district`:

```prisma
city        String?
district    String?
```

In `src/lib/property-content.ts`, reuse the file's existing `textValue` helper and add:

```ts
export function extractTopnlabCity(entity: Record<string, unknown>): string | undefined {
  const city = textValue(entity.city_name, entity.locality, entity.city)?.trim();
  if (!city) return undefined;
  return city.replace(/^(?:г\.?|город)\s*/iu, "").trim() || undefined;
}
```

In `src/lib/topnlab/map.ts`, import `extractTopnlabCity`, add `city?: string` to `MappedProperty`, and add this property to the mapped result:

```ts
city: extractTopnlabCity(e),
```

- [ ] **Step 5: Generate Prisma Client and verify GREEN**

Run:

```powershell
npx.cmd prisma generate
npm.cmd test -- test/property-content.test.ts test/map.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit the persistence unit**

```powershell
git add prisma/schema.prisma src/lib/property-content.ts src/lib/topnlab/map.ts test/property-content.test.ts test/map.test.ts src/generated/prisma
git commit -m "feat: persist Topnlab property cities"
```

### Task 2: Add city to content resynchronization

**Files:**
- Modify: `src/lib/topnlab/content.ts`
- Test: `test/property-content-sync.test.ts`

**Interfaces:**
- Consumes: `extractTopnlabCity(entity): string | undefined` from Task 1.
- Produces: `propertyContentUpdate(entity)` data containing `city` when usable.

- [ ] **Step 1: Update the content-sync expectation first**

Change the first expectation in `test/property-content-sync.test.ts` to include:

```ts
city: "Донецк",
```

Change the expected `good` update data to include:

```ts
city: "Донецк",
```

Change the final flattened key expectation so both successful Topnlab records include `city` in the same insertion order as the production result.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
npm.cmd test -- test/property-content-sync.test.ts
```

Expected: FAIL because `propertyContentUpdate` omits `city`.

- [ ] **Step 3: Add city to the content update**

Import `extractTopnlabCity` in `src/lib/topnlab/content.ts`, calculate it beside `address`, and return it before `district`:

```ts
const city = extractTopnlabCity(entity);

return {
  ...(address ? { address } : {}),
  ...(description ? { description } : {}),
  ...(city ? { city } : {}),
  ...(district ? { district } : {}),
};
```

- [ ] **Step 4: Verify GREEN and commit**

Run:

```powershell
npm.cmd test -- test/property-content-sync.test.ts
git add src/lib/topnlab/content.ts test/property-content-sync.test.ts
git commit -m "feat: resync property cities from Topnlab"
```

Expected: PASS, followed by a commit containing only the two listed files.

### Task 3: Build validated catalog query conditions

**Files:**
- Create: `src/lib/catalog-filters.ts`
- Create: `test/catalog-filters.test.ts`

**Interfaces:**
- Produces: `CatalogSearchParams` with optional string fields `objectType`, `city`, `district`, `rooms`, `priceMin`, `priceMax`.
- Produces: `buildCatalogWhere(params: CatalogSearchParams): Record<string, unknown>`.

- [ ] **Step 1: Write failing filter-condition tests**

Create `test/catalog-filters.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { buildCatalogWhere } from "../src/lib/catalog-filters";

describe("buildCatalogWhere", () => {
  test("combines the approved catalog filters", () => {
    expect(buildCatalogWhere({
      objectType: "house",
      city: "Донецк",
      district: "Киевский р-н",
      rooms: "4",
      priceMin: "2000000",
      priceMax: "5000000",
    })).toEqual({
      isFeed: true,
      objectType: "house",
      city: "Донецк",
      district: "Киевский р-н",
      rooms: { gte: 4 },
      price: { gte: 2000000, lte: 5000000 },
    });
  });

  test("ignores unsupported types, orphan districts, and invalid prices", () => {
    expect(buildCatalogWhere({
      objectType: "commercial",
      district: "Центральный р-н",
      priceMin: "-1",
      priceMax: "не число",
    })).toEqual({ isFeed: true });
  });

  test("keeps either valid inclusive price bound", () => {
    expect(buildCatalogWhere({ priceMin: "1000000" })).toEqual({
      isFeed: true,
      price: { gte: 1000000 },
    });
    expect(buildCatalogWhere({ priceMax: "3000000" })).toEqual({
      isFeed: true,
      price: { lte: 3000000 },
    });
  });

  test("ignores unsupported room values", () => {
    expect(buildCatalogWhere({ rooms: "studio" })).toEqual({ isFeed: true });
    expect(buildCatalogWhere({ rooms: "0" })).toEqual({ isFeed: true });
  });
});
```

- [ ] **Step 2: Run the new test and verify RED**

Run:

```powershell
npm.cmd test -- test/catalog-filters.test.ts
```

Expected: FAIL because `src/lib/catalog-filters.ts` does not exist.

- [ ] **Step 3: Implement the minimal pure helper**

Create `src/lib/catalog-filters.ts` with:

```ts
export type CatalogSearchParams = {
  objectType?: string;
  city?: string;
  district?: string;
  rooms?: string;
  priceMin?: string;
  priceMax?: string;
};

const OBJECT_TYPES = new Set(["flat", "house", "land"]);
const ROOM_VALUES = new Set(["1", "2", "3", "4"]);

function priceBound(value: string | undefined): number | undefined {
  if (!value?.trim()) return undefined;
  const price = Number(value);
  return Number.isFinite(price) && price >= 0 ? price : undefined;
}

export function buildCatalogWhere(params: CatalogSearchParams): Record<string, unknown> {
  const where: Record<string, unknown> = { isFeed: true };
  if (params.objectType && OBJECT_TYPES.has(params.objectType)) where.objectType = params.objectType;
  if (params.city) where.city = params.city;
  if (params.city && params.district) where.district = params.district;
  if (params.rooms && ROOM_VALUES.has(params.rooms)) {
    where.rooms = params.rooms === "4" ? { gte: 4 } : Number(params.rooms);
  }

  const gte = priceBound(params.priceMin);
  const lte = priceBound(params.priceMax);
  if (gte !== undefined || lte !== undefined) {
    where.price = { ...(gte !== undefined ? { gte } : {}), ...(lte !== undefined ? { lte } : {}) };
  }
  return where;
}
```

- [ ] **Step 4: Verify GREEN and commit**

Run:

```powershell
npm.cmd test -- test/catalog-filters.test.ts
git add src/lib/catalog-filters.ts test/catalog-filters.test.ts
git commit -m "feat: build validated catalog filters"
```

Expected: PASS. Only room values `1`, `2`, `3`, and `4` may create a room condition; add that assertion and minimal guard before committing.

### Task 4: Render server-backed dependent filters

**Files:**
- Modify: `src/app/catalog/page.tsx`
- Modify: `src/components/CatalogFilters.tsx`
- Create: `test/catalog-filters-ui.test.tsx`

**Interfaces:**
- Consumes: `CatalogSearchParams` and `buildCatalogWhere()` from Task 3.
- `CatalogFilters` consumes `{ cities: string[]; districts: string[]; current: CatalogSearchParams }`.
- The city `<select>` submits its closest GET form on change.

- [ ] **Step 1: Read the installed Next.js 16 guides before editing framework code**

Run:

```powershell
rg -n "searchParams|Client Component|form" node_modules/next/dist/docs
```

Read the matching App Router page/search-parameter and Server/Client Component guides completely. Follow their current Next.js 16.2.9 conventions and heed deprecation notices.

- [ ] **Step 2: Write the failing UI test**

Create `test/catalog-filters-ui.test.tsx` using `renderToStaticMarkup`:

```tsx
import { expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CatalogFilters } from "../src/components/CatalogFilters";

test("renders approved filters in order and disables district without city", () => {
  const html = renderToStaticMarkup(
    <CatalogFilters cities={["Донецк", "Макеевка"]} districts={[]} current={{}} />,
  );
  const labels = ["Тип объекта", "Город", "Район", "Комнаты", "Цена от", "Цена до"];
  const positions = labels.map((label) => html.indexOf(label));
  expect(positions.every((position) => position >= 0)).toBe(true);
  expect(positions.every((position, index) => index === 0 || position > positions[index - 1])).toBe(true);
  expect(html).toContain('name="objectType"');
  expect(html).toContain('value="flat"');
  expect(html).toContain('value="house"');
  expect(html).toContain('value="land"');
  expect(html).toMatch(/name="district"[^>]*disabled/);
  expect(html).toContain('name="priceMin"');
  expect(html).toContain('name="priceMax"');
});

test("enables only the supplied districts for a selected city", () => {
  const html = renderToStaticMarkup(
    <CatalogFilters
      cities={["Донецк"]}
      districts={["Киевский р-н"]}
      current={{ city: "Донецк", district: "Киевский р-н" }}
    />,
  );
  expect(html).toContain("Киевский р-н");
  expect(html).not.toMatch(/name="district"[^>]*disabled/);
});
```

- [ ] **Step 3: Run the UI test and verify RED**

Run:

```powershell
npm.cmd test -- test/catalog-filters-ui.test.tsx
```

Expected: FAIL because the component lacks `cities`, property type, price minimum, and the new ordering.

- [ ] **Step 4: Implement the filter controls**

Add `"use client"` to `src/components/CatalogFilters.tsx`. Render controlled-by-default GET fields in the approved order. Use this city handler:

```tsx
onChange={(event) => event.currentTarget.form?.requestSubmit()}
```

Use these type values and labels:

```tsx
<option value="">Любой</option>
<option value="flat">Квартира</option>
<option value="house">Дом</option>
<option value="land">Земельный участок</option>
```

Set the district select to `disabled={!current.city}` and show `Сначала выберите город` as its empty option when disabled. Use `min="0"` on both price inputs, while retaining server-side validation from Task 3.

- [ ] **Step 5: Connect server queries and city-dependent districts**

In `src/app/catalog/page.tsx`, replace the local search-param type and manual conditions with:

```ts
import { buildCatalogWhere, type CatalogSearchParams } from "@/lib/catalog-filters";

const where = buildCatalogWhere(sp);
```

Query published city rows with `select: { city: true }` and `distinct: ["city"]`. Query district rows only when `sp.city` exists, using:

```ts
where: { isFeed: true, city: sp.city, district: { not: null } },
```

Normalize, deduplicate with `new Set`, and Russian-sort both option arrays. Pass them as:

```tsx
<CatalogFilters cities={cities} districts={districts} current={sp} />
```

- [ ] **Step 6: Verify UI and query tests pass**

Run:

```powershell
npm.cmd test -- test/catalog-filters-ui.test.tsx test/catalog-filters.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit the catalog interface**

```powershell
git add src/app/catalog/page.tsx src/components/CatalogFilters.tsx test/catalog-filters-ui.test.tsx
git commit -m "feat: expand catalog filters"
```

### Task 5: Full verification and local handoff

**Files:**
- Verify all files changed in Tasks 1–4.
- Do not modify production deployment state.

**Interfaces:**
- Produces: a tested local branch ready for user review.

- [ ] **Step 1: Run the full automated test suite**

```powershell
npm.cmd test
```

Expected: all existing and new tests pass with zero failures.

- [ ] **Step 2: Run lint and distinguish legacy findings**

```powershell
npm.cmd run lint
```

Expected: no new errors in modified or created files. The known `no-explicit-any` findings named in `PROJECT_CONTEXT.md` may remain and must be reported exactly rather than hidden.

- [ ] **Step 3: Run the production build**

```powershell
npm.cmd run build
```

Expected: Next.js production build succeeds.

- [ ] **Step 4: Review the final diff and secret safety**

```powershell
git status --short --branch
git diff origin/main...HEAD --check
git diff --stat origin/main...HEAD
git log --oneline origin/main..HEAD
```

Expected: only the specification, plan, schema/generated client, city sync, catalog filter implementation, and related tests are present. No `.env` file is staged or committed.

- [ ] **Step 5: Present the local result for review**

Report the worktree path, test/build results, known lint baseline, commits, and any database rollout requirement. Do not push to GitHub or deploy to Beget until the user explicitly requests publication.
