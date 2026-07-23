# Property Address, District, and Description Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show complete readable addresses, real districts in object cards and catalog filters, and compact description paragraphs for every Topnlab property.

**Architecture:** Keep Topnlab field interpretation in `src/lib/property-content.ts`, then reuse it from both full import and safe content synchronization. Persist the normalized district in the existing `Property.district` column so catalog queries remain simple. Render normalized description blocks with a small dedicated component that preserves safe line breaks.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Prisma/PostgreSQL, Tailwind CSS 4, Vitest.

## Global Constraints

- Content sync may update only `address`, `description`, and `district`.
- Price, photos, object type, feed status, and assigned manager must remain unchanged.
- District comes from `city_district_name` or `city_district`; generic district fields are fallback only when they do not equal the city.
- Missing districts remain empty; never infer a district from a street.
- Show local results before any production deployment.

---

### Task 1: Normalize Topnlab district and address

**Files:**
- Modify: `src/lib/property-content.ts`
- Modify: `test/property-content.test.ts`

**Interfaces:**
- Produces: `extractTopnlabDistrict(entity: Record<string, unknown>): string | undefined`
- Produces: `formatTopnlabAddress(entity: Record<string, unknown>): string | undefined`

- [ ] **Step 1: Add failing district and prefix tests**

Add tests that require the real district to win over a city-like generic field, reject a generic field equal to the city, support `{ name }`, and add readable prefixes:

```ts
expect(
  extractTopnlabDistrict({
    city: "Донецк",
    district: "Донецк г.",
    city_district: "Пролетарский",
  }),
).toBe("Пролетарский р-н");

expect(
  extractTopnlabDistrict({
    city: { name: "Донецк" },
    district: { name: "Донецк г." },
  }),
).toBeUndefined();

expect(
  formatTopnlabAddress({
    region: "Донецкая Народная Республика",
    city: "Донецк",
    city_district: "Пролетарский",
    street: "Раздольная",
    house: "26",
  }),
).toBe(
  "Донецкая Народная Республика, г. Донецк, Пролетарский р-н, ул. Раздольная, д. 26",
);
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
npx vitest run test/property-content.test.ts
```

Expected: FAIL because `extractTopnlabDistrict` is not exported and unprefixed structured address parts are not normalized.

- [ ] **Step 3: Implement minimal normalization**

In `src/lib/property-content.ts`, add:

```ts
function comparablePlace(value: string): string {
  return value
    .toLocaleLowerCase("ru")
    .replace(/(?:^|\s)(?:г\.?|город|р-?н|район)(?=\s|$)/giu, "")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

function withPrefix(value: string, prefix: "г." | "р-н" | "ул." | "д."): string {
  const patterns = {
    "г.": /^(?:г\.?|город)\s+/iu,
    "р-н": /(?:\s+(?:р-?н|район))$/iu,
    "ул.": /^(?:ул\.?|улица)\s+/iu,
    "д.": /^(?:д\.?|дом)\s+/iu,
  };
  if (patterns[prefix].test(value)) return value;
  return prefix === "р-н" ? `${value} р-н` : `${prefix} ${value}`;
}

export function extractTopnlabDistrict(
  entity: Record<string, unknown>,
): string | undefined {
  const city = textValue(entity.city_name, entity.locality, entity.city);
  const primary = textValue(entity.city_district_name, entity.city_district);
  const fallback = textValue(entity.district_name, entity.district);
  const district = primary ?? fallback;
  if (!district) return undefined;
  if (city && comparablePlace(district) === comparablePlace(city)) return undefined;
  return withPrefix(district, "р-н");
}
```

Update `formatTopnlabAddress` to use `extractTopnlabDistrict(entity)` and apply `withPrefix` to city, street, and house before removing duplicates.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```bash
npx vitest run test/property-content.test.ts
```

Expected: all property-content tests PASS.

- [ ] **Step 5: Commit Task 1**

```bash
git add src/lib/property-content.ts test/property-content.test.ts
git commit -m "fix: normalize Topnlab districts and addresses"
```

### Task 2: Persist districts through import and safe content sync

**Files:**
- Modify: `src/lib/topnlab/map.ts`
- Modify: `src/lib/topnlab/content.ts`
- Modify: `test/topnlab.test.ts`
- Modify: `test/property-content-sync.test.ts`

**Interfaces:**
- Consumes: `extractTopnlabDistrict(entity)`
- Produces: `MappedProperty.district`
- Produces: `propertyContentUpdate(entity)` with only optional `address`, `description`, and `district`

- [ ] **Step 1: Add failing mapping and safe-update tests**

Extend the fixture expectations:

```ts
expect(mapped.district).toBe("Пролетарский р-н");
```

Add a content update assertion:

```ts
expect(propertyContentUpdate(entity)).toEqual({
  address:
    "Донецкая Народная Республика, г. Донецк, Пролетарский р-н, ул. Раздольная, д. 26",
  description: "Первая строка\nВторая строка",
  district: "Пролетарский р-н",
});
expect(propertyContentUpdate(entity)).not.toHaveProperty("price");
expect(propertyContentUpdate(entity)).not.toHaveProperty("agentId");
expect(propertyContentUpdate(entity)).not.toHaveProperty("photos");
```

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
npx vitest run test/topnlab.test.ts test/property-content-sync.test.ts
```

Expected: FAIL because mapping still uses `e.district` and content sync omits `district`.

- [ ] **Step 3: Wire the shared extractor into both paths**

Update imports and assignments:

```ts
import {
  extractTopnlabDistrict,
  formatTopnlabAddress,
  normalizePropertyDescription,
} from "../property-content";
```

In `mapTopnlabEntity`:

```ts
district: extractTopnlabDistrict(e),
```

In `propertyContentUpdate`:

```ts
const district = extractTopnlabDistrict(entity);

return {
  ...(address ? { address } : {}),
  ...(description ? { description } : {}),
  ...(district ? { district } : {}),
};
```

- [ ] **Step 4: Run focused tests and verify GREEN**

Run:

```bash
npx vitest run test/topnlab.test.ts test/property-content-sync.test.ts
```

Expected: both files PASS and the update object contains no unrelated fields.

- [ ] **Step 5: Commit Task 2**

```bash
git add src/lib/topnlab/map.ts src/lib/topnlab/content.ts test/topnlab.test.ts test/property-content-sync.test.ts
git commit -m "fix: sync real property districts"
```

### Task 3: Render compact description paragraphs

**Files:**
- Create: `src/components/PropertyDescription.tsx`
- Create: `test/property-description.test.tsx`
- Modify: `src/app/object/[id]/page.tsx`

**Interfaces:**
- Produces: `PropertyDescription({ value }: { value: string }): React.ReactNode`
- Consumes: normalized plain text containing single and double newline separators

- [ ] **Step 1: Add a failing pure paragraph-splitting test**

Export a pure helper alongside the component and test its output:

```ts
expect(
  splitPropertyDescription("Первый блок\nпродолжение\n\nВторой блок"),
).toEqual(["Первый блок\nпродолжение", "Второй блок"]);
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
npx vitest run test/property-description.test.tsx
```

Expected: FAIL because the component and helper do not exist.

- [ ] **Step 3: Implement the component and replace the old block**

Create:

```tsx
export function splitPropertyDescription(value: string): string[] {
  return value
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

export function PropertyDescription({ value }: { value: string }) {
  return (
    <div className="mt-5 space-y-3 text-[15px] leading-7 text-stone-700">
      {splitPropertyDescription(value).map((paragraph, index) => (
        <p key={index} className="whitespace-pre-line">
          {paragraph}
        </p>
      ))}
    </div>
  );
}
```

In the object page, import `PropertyDescription` and replace the `whitespace-pre-line` wrapper with:

```tsx
{description && <PropertyDescription value={description} />}
```

- [ ] **Step 4: Run focused and full tests**

Run:

```bash
npx vitest run test/property-description.test.tsx
npm test
```

Expected: focused test and the complete suite PASS.

- [ ] **Step 5: Commit Task 3**

```bash
git add src/components/PropertyDescription.tsx test/property-description.test.tsx 'src/app/object/[id]/page.tsx'
git commit -m "fix: compact property description paragraphs"
```

### Task 4: Verify build and local data behavior

**Files:**
- Modify only if verification reveals a defect in files already listed above.

**Interfaces:**
- Consumes all preceding tasks.
- Produces a locally verified build ready for content synchronization and user review.

- [ ] **Step 1: Run complete automated verification**

Run:

```bash
npm test
npx tsc --noEmit
npm run build
git diff --check
```

Expected: all tests pass, TypeScript exits 0, Next.js production build succeeds, and `git diff --check` reports no whitespace errors.

- [ ] **Step 2: Start the local application**

Run:

```bash
npm run dev
```

Expected: Next.js reports a local URL and stays running.

- [ ] **Step 3: Synchronize content only when a configured local database is available**

Run:

```bash
npm run sync:content
```

Expected: output reports updated/skipped objects without changing price, photos, or manager relationships. If local database credentials are unavailable, do not invent them; verify with fixtures and perform the real sync during the separately approved Beget deployment.

- [ ] **Step 4: Visually verify object and catalog pages**

Check:

- an object address includes region, city, district, street, and house;
- the object’s «Район» equals the actual district;
- description paragraphs have compact spacing;
- catalog filter values are districts rather than cities;
- filtering returns only matching objects.

- [ ] **Step 5: Present local result**

Open the local object and catalog pages for user review. Do not push to GitHub or deploy to Beget until the user explicitly approves publication.
