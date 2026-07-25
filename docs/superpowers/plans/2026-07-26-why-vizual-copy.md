# Why Vizual Copy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the homepage `Почему «Визуал»` introduction and benefit list with the approved copy.

**Architecture:** Keep the existing section and list-row markup. Extend the existing homepage server-rendering test first, then replace the introduction, update the first two rows, add a title-only mortgage row, and move the turnkey transaction copy into a fourth row.

**Tech Stack:** Next.js 16, React 19, TypeScript, Vitest, React DOM server renderer.

## Global Constraints

- Preserve the existing visual styling and adjacent `200+` panel.
- Render exactly four benefit rows.
- Render `Открытие ипотеки бесплатно` without an empty description element.
- Do not change any other homepage content.

---

### Task 1: Why Vizual content

**Files:**
- Modify: `test/homepage-hero.test.tsx`
- Modify: `src/app/page.tsx:85-123`

**Interfaces:**
- Consumes: the default async `Home()` server component.
- Produces: the approved introduction and four benefit rows in rendered homepage HTML.

- [ ] **Step 1: Extend the failing rendering test**

Add assertions for these exact strings:

```tsx
expect(html).toContain("Мы поможем купить или продать недвижимость с заботой и вниманием к деталям. Каждый объект проверен юристами, а сопроводит вашу сделку опытный агент.");
expect(html).toContain("Большой каталог");
expect(html).toContain("более 200 проверенных объектов");
expect(html).toContain("Опытный агент");
expect(html).toContain("на каждом этапе сделки, полное сопровождение");
expect(html).toContain("Открытие ипотеки бесплатно");
expect(html).toContain("Сопровождение сделки под ключ");
expect(html).toContain("от звонка до получения ключей");
expect(html).not.toContain("Более 200 проверенных квартир и домов");
```

- [ ] **Step 2: Verify the expected failure**

Run: `npm.cmd test -- test/homepage-hero.test.tsx`

Expected: FAIL because the page still contains the legacy introduction and three benefit rows.

- [ ] **Step 3: Apply the approved copy**

Replace the introduction and render the four specified rows. Reuse the existing row classes; omit the description `<div>` from the mortgage row.

- [ ] **Step 4: Verify tests**

Run: `npm.cmd test -- test/homepage-hero.test.tsx`

Expected: PASS, 1 test passed.

Run: `npm.cmd test`

Expected: PASS, all tests passed.

- [ ] **Step 5: Verify production build**

Run: `npm.cmd run build`

Expected: exit code 0 and successful Next.js production build.

- [ ] **Step 6: Commit, publish, and verify**

Commit `src/app/page.tsx` and `test/homepage-hero.test.tsx`, push `HEAD` to `origin/main`, deploy through the existing Beget/PM2 workflow, and visually confirm the updated section on the live homepage.
