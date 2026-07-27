# Описание сотрудника Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Дать владельцу сайта возможность редактировать опыт и достижения каждого сотрудника через админ-панель.

**Architecture:** В модель `TeamMemberV1` добавляется необязательное текстовое поле `description`. Валидатор принимает и нормализует его, редактор выводит многострочное поле, а публичная карточка показывает только заполненное описание.

**Tech Stack:** Next.js 16, React 19, TypeScript, Vitest, Tailwind CSS.

## Global Constraints

- Поле `description` необязательно и ограничено 1200 символами.
- Старые сохранённые карточки без `description` остаются валидными.
- Пустое описание не выводится на сайте; временная заглушка удаляется.
- Текст не допускает HTML, Markdown и URL-схемы по правилам существующего валидатора.

---

### Task 1: Схема и отображение описания

**Files:**
- Modify: `src/lib/site-content/schema.ts`
- Modify: `src/components/site-content/TeamPageView.tsx`
- Modify: `src/components/TeamCarousel.tsx`
- Test: `test/site-content-schema.test.ts`
- Test: `test/team-manager-contact.test.tsx`

**Interfaces:**
- Produces: `TeamMemberV1.description?: string`.
- Consumes: `TeamManager.description?: string` в `ManagerCard`.

- [x] **Step 1: Write the failing tests**

```ts
content.team.members[0].description = "Опыт работы с жилой недвижимостью.";
expect(parseSiteContent(content).team.members[0].description).toBe(
  "Опыт работы с жилой недвижимостью.",
);
```

```tsx
expect(renderToStaticMarkup(<ManagerCard manager={manager} />)).not.toContain(
  "Подробная информация об опыте",
);
```

- [x] **Step 2: Run the targeted tests and verify they fail**

Run: `npm.cmd test -- test/site-content-schema.test.ts test/team-manager-contact.test.tsx`

Expected: validation rejects the new field and the public card renders the legacy placeholder.

- [x] **Step 3: Implement the minimal model and rendering changes**

```ts
export type TeamMemberV1 = {
  // existing fields
  description?: string;
};
```

```tsx
{manager.description ? (
  <div className="mt-5 rounded-xl bg-brand/5 p-4 text-sm leading-6 text-text/75">
    {manager.description}
  </div>
) : null}
```

- [x] **Step 4: Run the targeted tests and verify they pass**

Run: `npm.cmd test -- test/site-content-schema.test.ts test/team-manager-contact.test.tsx`

Expected: PASS.

### Task 2: Поле в админ-панели и итоговая проверка

**Files:**
- Modify: `src/components/admin/TeamMemberEditor.tsx`
- Test: `test/team-member-editor.test.tsx`

**Interfaces:**
- Consumes: `TeamMemberV1.description?: string` из Task 1.
- Produces: вызов `onChange("description", value)` из редактора сотрудника.

- [x] **Step 1: Write the failing test**

```tsx
expect(html).toContain("Описание / опыт и достижения");
expect(html).toContain('name="team.members[0].description"');
```

- [x] **Step 2: Run the targeted test and verify it fails**

Run: `npm.cmd test -- test/team-member-editor.test.tsx`

Expected: FAIL because поля с этим названием ещё нет.

- [x] **Step 3: Add the multi-line editor field**

```tsx
<TextField
  label="Описание / опыт и достижения"
  path={`${basePath}.description`}
  value={member.description ?? ""}
  maxLength={1200}
  multiline
  rows={4}
  disabled={locked}
  issue={firstIssue(issues, `${basePath}.description`)}
  help="Необязательно, до 1200 символов."
  onChange={(value) => onChange("description", value)}
/>
```

- [x] **Step 4: Run the complete verification suite**

Run: `npm.cmd test && npm.cmd run build`

Expected: all tests pass and Next.js production build completes.

- [ ] **Step 5: Commit and publish**

```bash
git add docs/superpowers src test
git commit -m "feat: edit team member descriptions"
git push origin HEAD:main
```

Deploy the new `origin/main` build with PM2, then confirm the admin field and public team page load.

## Self-Review

- Spec coverage: schema, editor, publication path, empty-state rendering, validation and tests are covered by Tasks 1–2.
- Placeholder scan: no incomplete implementation steps remain.
- Type consistency: `description?: string` is used consistently by `TeamMemberV1`, `TeamManager`, editor callbacks and the public card.
