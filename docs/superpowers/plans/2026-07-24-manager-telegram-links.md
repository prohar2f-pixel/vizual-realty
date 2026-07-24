# Manager Telegram Links Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the obsolete Telegram links for Аянот Елена and Бороха Юлия everywhere they are exposed on the site.

**Architecture:** Keep the existing page-local manager arrays and approved manager-profile registry unchanged in structure. Update only the two URL values in the object manager profile, Team page, and Contacts page, with a focused unit-test assertion for the object-card profile and repository searches guarding against stale URLs.

**Tech Stack:** Next.js 16, React 19, TypeScript, Vitest

## Global Constraints

- Аянот Елена must use exactly `https://t.me/Lena_Katana`.
- Бороха Юлия must use exactly `https://t.me/juliaborokha24`.
- Do not change any other manager data or storage architecture.
- The old exact links `https://t.me/Lena_Katan` and `https://t.me/juliaborokha2` must not remain in `src` or `test`.

---

### Task 1: Update manager Telegram links

**Files:**
- Modify: `test/manager-profiles.test.ts:52-65`
- Modify: `src/lib/manager-profiles.ts:24-32`
- Modify: `src/app/team/page.tsx:5-34`
- Modify: `src/app/contacts/page.tsx:20-52`

**Interfaces:**
- Consumes: existing `resolveManager(manager: ManagerRecord): ManagerContact` behavior and existing `telegram`/`telegramUrl` string fields.
- Produces: public URLs `https://t.me/Lena_Katana` and `https://t.me/juliaborokha24` in all current site surfaces.

- [ ] **Step 1: Change the approved-profile assertion so it fails against the old implementation**

In `test/manager-profiles.test.ts`, replace the Telegram expectation in the existing Аянот test:

```ts
test("uses Ayanot Elena's approved Telegram URL and portrait", () => {
  expect(
    resolveManager({
      id: "296892",
      name: "Generic CRM name",
      phone: null,
      photoUrl: null,
    }),
  ).toMatchObject({
    telegram: "https://t.me/Lena_Katana",
    photo: "/managers/ayanot-elena-card.webp",
  });
});
```

- [ ] **Step 2: Run the focused test and confirm the expected failure**

Run:

```powershell
npx.cmd vitest run test/manager-profiles.test.ts
```

Expected: FAIL because the received Telegram value is `https://t.me/Lena_Katan`.

- [ ] **Step 3: Update the production URL values**

In `src/lib/manager-profiles.ts`, set Аянот's approved profile field to:

```ts
telegram: "https://t.me/Lena_Katana",
```

In both `src/app/team/page.tsx` and `src/app/contacts/page.tsx`, set the two manager fields to:

```ts
telegramUrl: "https://t.me/Lena_Katana",
```

```ts
telegramUrl: "https://t.me/juliaborokha24",
```

Do not alter names, phone numbers, photos, IDs, ordering, or component structure.

- [ ] **Step 4: Run the focused test and confirm it passes**

Run:

```powershell
npx.cmd vitest run test/manager-profiles.test.ts
```

Expected: all tests in `test/manager-profiles.test.ts` PASS.

- [ ] **Step 5: Prove that no obsolete exact URL remains**

Run:

```powershell
rg -n -F 'https://t.me/Lena_Katan"' src test
rg -n -F 'https://t.me/juliaborokha2"' src test
```

Expected: both commands produce no matches. The trailing quote prevents the new URLs, which contain the old strings as prefixes, from being false positives.

- [ ] **Step 6: Run the complete automated verification**

Run:

```powershell
npm.cmd test
npx.cmd tsc --noEmit --incremental false
```

Expected: the full Vitest suite passes and TypeScript exits with code 0.

- [ ] **Step 7: Commit only the Telegram-link implementation files**

Run:

```powershell
git add -- test/manager-profiles.test.ts src/lib/manager-profiles.ts src/app/team/page.tsx src/app/contacts/page.tsx
git commit -m "fix: update manager Telegram links"
```

Expected: one implementation commit containing only the four listed files.
