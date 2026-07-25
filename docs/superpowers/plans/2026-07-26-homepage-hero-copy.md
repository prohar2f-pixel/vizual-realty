# Homepage Hero Copy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the homepage hero copy with the approved two-line Russian text.

**Architecture:** Keep the existing homepage component and styling intact. Add one focused server-rendering regression test, then replace the paragraph content and insert an explicit JSX `<br />` between the two approved sentences.

**Tech Stack:** Next.js 16, React 19, TypeScript, Vitest, React DOM server renderer.

## Global Constraints

- Line 1 must be exactly: `Продажа квартир, домов, и земельных участков.`
- Line 2 must be exactly: `Большой каталог проверенных объектов и личный агент сопровождающий всю сделку.`
- The split must be explicit and must not depend on viewport width.
- Preserve existing typography, spacing, responsive layout, metadata, and all other copy.

---

### Task 1: Homepage hero copy

**Files:**
- Create: `test/homepage-hero.test.tsx`
- Modify: `src/app/page.tsx:37-40`

**Interfaces:**
- Consumes: the default async `Home()` server component from `src/app/page.tsx`.
- Produces: rendered hero copy with an explicit `<br />` separating the approved lines.

- [ ] **Step 1: Write the failing rendering test**

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
import Home from "../src/app/page";

vi.mock("../src/lib/db", () => ({
  db: { property: { findMany: vi.fn().mockResolvedValue([]) } },
}));

test("renders the approved homepage hero copy as two explicit lines", async () => {
  const html = renderToStaticMarkup(await Home());

  expect(html).toContain(
    "Продажа квартир, домов, и земельных участков.<br/>Большой каталог проверенных объектов и личный агент сопровождающий всю сделку.",
  );
});
```

- [ ] **Step 2: Run the focused test and verify the expected failure**

Run: `npm.cmd test -- test/homepage-hero.test.tsx`

Expected: FAIL because the current hero paragraph contains the old one-line copy.

- [ ] **Step 3: Apply the minimal homepage change**

```tsx
<p className="mx-auto text-base font-medium text-on-brand sm:whitespace-nowrap sm:text-sm xl:text-base 2xl:text-lg">
  Продажа квартир, домов, и земельных участков.
  <br />
  Большой каталог проверенных объектов и личный агент сопровождающий всю сделку.
</p>
```

- [ ] **Step 4: Verify the focused test and complete suite**

Run: `npm.cmd test -- test/homepage-hero.test.tsx`

Expected: PASS, 1 test passed.

Run: `npm.cmd test`

Expected: PASS, all tests passed.

- [ ] **Step 5: Verify the production build**

Run: `npm.cmd run build`

Expected: exit code 0 and a successful Next.js production build.

- [ ] **Step 6: Commit the implementation**

```bash
git add test/homepage-hero.test.tsx src/app/page.tsx
git commit -m "feat: update homepage hero copy"
```

- [ ] **Step 7: Publish and verify**

Push the implementation commit to `origin/main`, deploy it using the existing Beget/PM2 workflow, and visually confirm the two explicit lines on `https://nedvizhimostdoneck.ru/`.
