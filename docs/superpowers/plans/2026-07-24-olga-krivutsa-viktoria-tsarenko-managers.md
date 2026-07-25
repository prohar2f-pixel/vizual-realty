# Olga Krivutsa and Viktoria Tsarenko Managers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Olga Krivutsa and Viktoria Tsarenko to the team carousel and contacts list with phone and e-mail actions.

**Architecture:** Keep the existing page-local manager data, but replace the Telegram-only card contract with a generic contact action (`contactUrl`, `contactLabel`, `contactExternal`). Reuse that contract in the team card and apply the same behavior to contact rows, so `mailto:` links do not open blank browser tabs while Telegram links retain their current behavior.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS, Vitest, React server rendering, Sharp.

## Global Constraints

- Olga is the seventh manager and Viktoria is the eighth manager.
- Desktop carousel continues to show three cards and advances one manager per arrow click.
- Mobile carousel continues to show one card.
- Olga uses `mailto:olya_malina22@mail.ru`.
- Viktoria uses `mailto:tsarenko.viktoria2000@mail.ru`.
- Existing Telegram links and labels stay unchanged.
- Both phones are clickable.
- Manager photos use the existing green card/avatar framing.
- Neither manager is linked to Topnlab objects without an employee ID.
- Do not modify the unrelated dirty `.superpowers/sdd` reports, preview HTML files, or the existing property-manager plan.

---

### Task 1: Test generic manager contact actions

**Files:**
- Create: `test/team-manager-contact.test.tsx`
- Modify: `src/components/TeamCarousel.tsx`

**Interfaces:**
- Consumes: existing `TeamManager` and manager-card rendering.
- Produces: exported `ManagerCard` and `TeamManager.contactUrl`, `contactLabel`, `contactExternal`.

- [ ] **Step 1: Write the failing component test**

```tsx
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import {
  ManagerCard,
  type TeamManager,
} from "../src/components/TeamCarousel";

test("renders an e-mail action without opening a browser tab", () => {
  const manager: TeamManager = {
    name: "Ольга Кривуца",
    phone: "+7 (978) 059-26-69",
    phoneHref: "tel:+79780592669",
    contactUrl: "mailto:olya_malina22@mail.ru",
    contactLabel: "Написать на e-mail",
    contactExternal: false,
    photoUrl: "/managers/olga-krivutsa-card.webp",
  };

  const html = renderToStaticMarkup(<ManagerCard manager={manager} />);

  expect(html).toContain('href="mailto:olya_malina22@mail.ru"');
  expect(html).toContain("Написать на e-mail");
  expect(html).not.toContain('target="_blank"');
});

test("keeps Telegram actions external", () => {
  const manager: TeamManager = {
    name: "Аянот Елена",
    phone: "+7 (949) 537-55-65",
    phoneHref: "tel:+79495375565",
    contactUrl: "https://t.me/Lena_Katana",
    contactLabel: "Написать в Telegram",
    contactExternal: true,
    photoUrl: "/managers/ayanot-elena-card.webp",
  };

  const html = renderToStaticMarkup(<ManagerCard manager={manager} />);

  expect(html).toContain('href="https://t.me/Lena_Katana"');
  expect(html).toContain('target="_blank"');
  expect(html).toContain('rel="noreferrer"');
});
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run: `npm test -- test/team-manager-contact.test.tsx`

Expected: FAIL because `ManagerCard` is not exported and `TeamManager` does not accept generic contact fields.

- [ ] **Step 3: Implement the generic contact contract**

Change `TeamManager` and export `ManagerCard`:

```tsx
export type TeamManager = {
  name: string;
  phone: string;
  phoneHref: string;
  contactUrl: string;
  contactLabel: string;
  contactExternal: boolean;
  photoUrl: string;
};

export function ManagerCard({ manager }: { manager: TeamManager }) {
  const externalProps = manager.contactExternal
    ? { target: "_blank" as const, rel: "noreferrer" }
    : {};

  return (
    <article className="overflow-hidden rounded-2xl border-2 border-brand bg-white shadow-sm">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={manager.photoUrl}
        alt={manager.name}
        className="h-80 w-full object-cover object-top"
      />

      <div className="p-5">
        <h2 className="font-display text-2xl font-bold text-brand">
          {manager.name}
        </h2>
        <a
          href={manager.phoneHref}
          className="mt-2 block font-semibold text-text transition hover:text-brand"
        >
          {manager.phone}
        </a>

        <div className="mt-5 rounded-xl bg-brand/5 p-4 text-sm leading-6 text-text/75">
          Подробная информация об опыте и достижениях менеджера будет добавлена
          после согласования.
        </div>

      <a
        href={manager.contactUrl}
        {...externalProps}
        className="mt-5 inline-flex w-full justify-center rounded-lg bg-brand px-4 py-3 text-sm font-semibold text-on-brand transition hover:bg-brand-dim"
      >
        {manager.contactLabel}
      </a>
      </div>
    </article>
  );
}
```

Use the component above exactly so the existing card layout remains unchanged while the action becomes generic.

- [ ] **Step 4: Run the focused test and confirm it passes**

Run: `npm test -- test/team-manager-contact.test.tsx`

Expected: 2 tests PASS.

- [ ] **Step 5: Commit the component contract**

```bash
git add test/team-manager-contact.test.tsx src/components/TeamCarousel.tsx
git commit -m "refactor: support manager email contact actions"
```

### Task 2: Add both managers to the team carousel

**Files:**
- Modify: `src/app/team/page.tsx`
- Modify: `test/team-manager-contact.test.tsx`

**Interfaces:**
- Consumes: `TeamManager` generic contact contract from Task 1.
- Produces: eight ordered team managers with Olga at index 6 and Viktoria at index 7.

- [ ] **Step 1: Add a failing page-data rendering test**

Append:

```tsx
import { managers } from "../src/app/team/page";

test("Olga and Viktoria are seventh and eighth in the team carousel", () => {
  expect(managers).toHaveLength(8);
  expect(managers[6]).toMatchObject({
    name: "Ольга Кривуца",
    contactUrl: "mailto:olya_malina22@mail.ru",
  });
  expect(managers[7]).toMatchObject({
    name: "Тсаренко Виктория",
    contactUrl: "mailto:tsarenko.viktoria2000@mail.ru",
  });
});
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run: `npm test -- test/team-manager-contact.test.tsx`

Expected: FAIL because `managers` is not exported and the two managers are absent.

- [ ] **Step 3: Migrate existing managers and append Olga and Viktoria**

For all six existing entries, replace:

```tsx
telegramUrl: "https://t.me/...",
```

with:

```tsx
contactUrl: "https://t.me/...",
contactLabel: "Написать в Telegram",
contactExternal: true,
```

Append:

```tsx
{
  name: "Ольга Кривуца",
  phone: "+7 (978) 059-26-69",
  phoneHref: "tel:+79780592669",
  contactUrl: "mailto:olya_malina22@mail.ru",
  contactLabel: "Написать на e-mail",
  contactExternal: false,
  photoUrl: "/managers/olga-krivutsa-card.webp",
},
{
  name: "Тсаренко Виктория",
  phone: "+7 (963) 532-80-09",
  phoneHref: "tel:+79635328009",
  contactUrl: "mailto:tsarenko.viktoria2000@mail.ru",
  contactLabel: "Написать на e-mail",
  contactExternal: false,
  photoUrl: "/managers/tsarenko-viktoria-card.webp",
},
```

- [ ] **Step 4: Run the focused test**

Run: `npm test -- test/team-manager-contact.test.tsx`

Expected: 3 tests PASS.

- [ ] **Step 5: Commit the team data**

```bash
git add src/app/team/page.tsx test/team-manager-contact.test.tsx
git commit -m "feat: add Olga and Viktoria to team carousel"
```

### Task 3: Replace the contacts placeholder and add Viktoria

**Files:**
- Create: `test/contacts-managers.test.tsx`
- Modify: `src/app/contacts/page.tsx`

**Interfaces:**
- Consumes: manager phone, image and contact-action data.
- Produces: eight real contact rows with correct per-manager link behavior.

- [ ] **Step 1: Write the failing contacts-page test**

```tsx
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import ContactsPage from "../src/app/contacts/page";

test("contacts page shows Olga and Viktoria instead of a placeholder", () => {
  const html = renderToStaticMarkup(<ContactsPage />);

  expect(html).toContain("Ольга Кривуца");
  expect(html).toContain("+7 (978) 059-26-69");
  expect(html).toContain("mailto:olya_malina22@mail.ru");
  expect(html).toContain("/managers/olga-krivutsa.webp");
  expect(html).toContain("Тсаренко Виктория");
  expect(html).toContain("+7 (963) 532-80-09");
  expect(html).toContain("mailto:tsarenko.viktoria2000@mail.ru");
  expect(html).toContain("/managers/tsarenko-viktoria.webp");
  expect(html).not.toContain("Фамилия Имя");
});

test("contacts page preserves approved Telegram links", () => {
  const html = renderToStaticMarkup(<ContactsPage />);

  expect(html).toContain("https://t.me/Lena_Katana");
  expect(html).toContain("https://t.me/juliaborokha24");
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npm test -- test/contacts-managers.test.tsx`

Expected: FAIL because Olga and Viktoria are absent and the placeholder remains.

- [ ] **Step 3: Generalize contact-row data and rendering**

Replace the Telegram-only property:

```tsx
contactUrl: string;
contactLabel: string;
contactExternal: boolean;
```

Migrate the six existing managers to:

```tsx
contactUrl: "https://t.me/...",
contactLabel: "Написать менеджеру",
contactExternal: true,
```

Replace the placeholder with:

```tsx
{
  id: 7,
  name: "Ольга Кривуца",
  phone: "+7 (978) 059-26-69",
  phoneHref: "tel:+79780592669",
  photoUrl: "/managers/olga-krivutsa.webp",
  contactUrl: "mailto:olya_malina22@mail.ru",
  contactLabel: "Написать на e-mail",
  contactExternal: false,
},
{
  id: 8,
  name: "Тсаренко Виктория",
  phone: "+7 (963) 532-80-09",
  phoneHref: "tel:+79635328009",
  photoUrl: "/managers/tsarenko-viktoria.webp",
  contactUrl: "mailto:tsarenko.viktoria2000@mail.ru",
  contactLabel: "Написать на e-mail",
  contactExternal: false,
},
```

Render each action with:

```tsx
<a
  href={manager.contactUrl}
  {...(manager.contactExternal
    ? { target: "_blank" as const, rel: "noreferrer" }
    : {})}
  className="ml-auto shrink-0 rounded-lg border border-brand px-2.5 py-1.5 text-[11px] font-semibold leading-none text-brand transition hover:bg-brand hover:text-on-brand"
  aria-label={`${manager.contactLabel}: ${manager.name}`}
>
  {manager.contactLabel}
</a>
```

Change the list container from `gap-1` to `gap-0.5`, row padding from `py-0.5` to `py-0`, and keep the section at `h-[420px]` so eight rows fit without changing the approved card/map dimensions.

- [ ] **Step 4: Run the contacts tests**

Run: `npm test -- test/contacts-managers.test.tsx`

Expected: 2 tests PASS.

- [ ] **Step 5: Commit the contacts data**

```bash
git add src/app/contacts/page.tsx test/contacts-managers.test.tsx
git commit -m "feat: add Olga and Viktoria to contacts"
```

### Task 4: Produce optimized manager images

**Files:**
- Create: `public/managers/olga-krivutsa-card.webp`
- Create: `public/managers/olga-krivutsa.webp`
- Create: `public/managers/tsarenko-viktoria-card.webp`
- Create: `public/managers/tsarenko-viktoria.webp`

**Interfaces:**
- Consumes: `C:\Users\Udacha\Downloads\D2BA67CE-020E-437F-96B0-BF9D9B2BE6FE.jpg` and `C:\Users\Udacha\Downloads\IMG_3888.JPG`.
- Produces: 720×900 team images and 360×360 avatars referenced by Tasks 2 and 3.

- [ ] **Step 1: Generate WebP images with orientation correction and attention crop**

Run:

```powershell
node -e "const sharp=require('sharp'); const jobs=[['C:/Users/Udacha/Downloads/D2BA67CE-020E-437F-96B0-BF9D9B2BE6FE.jpg','olga-krivutsa'],['C:/Users/Udacha/Downloads/IMG_3888.JPG','tsarenko-viktoria']]; Promise.all(jobs.flatMap(([src,name])=>[sharp(src).rotate().resize(720,900,{fit:'cover',position:'attention'}).webp({quality:90}).toFile('public/managers/'+name+'-card.webp'),sharp(src).rotate().resize(360,360,{fit:'cover',position:'attention'}).webp({quality:90}).toFile('public/managers/'+name+'.webp')])).catch(error=>{console.error(error);process.exit(1)});"
```

Expected: four WebP files are created without errors.

- [ ] **Step 2: Verify dimensions and file sizes**

Run:

```powershell
node -e "const sharp=require('sharp'); const fs=require('fs'); const files=['olga-krivutsa-card.webp','olga-krivutsa.webp','tsarenko-viktoria-card.webp','tsarenko-viktoria.webp']; Promise.all(files.map(async f=>console.log(f,(await sharp('public/managers/'+f).metadata()).width+'x'+(await sharp('public/managers/'+f).metadata()).height,fs.statSync('public/managers/'+f).size)));"
```

Expected: card files report `720x900`; avatar files report `360x360`; every size is greater than 0 bytes.

- [ ] **Step 3: Visually inspect all four crops**

Open all four local images and confirm faces are centered, heads are not cut off, proportions are not distorted, and image quality matches existing manager photos.

- [ ] **Step 4: Commit the assets**

```bash
git add public/managers/olga-krivutsa-card.webp public/managers/olga-krivutsa.webp public/managers/tsarenko-viktoria-card.webp public/managers/tsarenko-viktoria.webp
git commit -m "assets: add Olga and Viktoria manager photos"
```

### Task 5: Verify the complete change locally

**Files:**
- Modify only if verification exposes a scoped defect: files from Tasks 1–4.

**Interfaces:**
- Consumes: all code and assets from Tasks 1–4.
- Produces: verified local pages ready for user review.

- [ ] **Step 1: Run the complete test suite**

Run: `npm test`

Expected: all tests PASS.

- [ ] **Step 2: Run lint**

Run: `npm run lint`

Expected: exit code 0 with no new errors.

- [ ] **Step 3: Run the production build**

Run: `npm run build`

Expected: Next.js production build succeeds and `/team` plus `/contacts` are generated without TypeScript errors.

- [ ] **Step 4: Start the local site**

Run: `npm run dev`

Expected: Next.js reports a local URL and stays running.

- [ ] **Step 5: Inspect `/team` and `/contacts`**

At desktop width verify three team cards, one-manager arrow movement, eight-manager counter, green card borders, eight compact contact rows, green circular avatars, clickable phones, and e-mail buttons for Olga and Viktoria. At mobile width verify one team card, working carousel arrows, and no horizontal overflow.

- [ ] **Step 6: Verify links**

Confirm Olga buttons resolve to `mailto:olya_malina22@mail.ru`, Viktoria buttons resolve to `mailto:tsarenko.viktoria2000@mail.ru`, Elena resolves to `https://t.me/Lena_Katana`, and Borokha resolves to `https://t.me/juliaborokha24`.

- [ ] **Step 7: Commit any verification-only correction**

If a correction was required:

```bash
git add src/components/TeamCarousel.tsx src/app/team/page.tsx src/app/contacts/page.tsx test/team-manager-contact.test.tsx test/contacts-managers.test.tsx public/managers/olga-krivutsa-card.webp public/managers/olga-krivutsa.webp public/managers/tsarenko-viktoria-card.webp public/managers/tsarenko-viktoria.webp
git commit -m "fix: polish new manager cards"
```

If no correction was required, do not create an empty commit.
