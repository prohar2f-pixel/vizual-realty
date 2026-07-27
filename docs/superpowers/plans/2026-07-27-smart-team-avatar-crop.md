# Умное кадрирование аватаров сотрудников Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Автоматически готовить квадратные аватары сотрудников для корректного отображения в круглых контактах.

**Architecture:** Загрузчик в `team-images.ts` будет кодировать входные изображения в квадратный WebP с кадрированием от верхнего края. Служебный скрипт применит тот же преобразователь к уже сохранённым файлам, не меняя их ID и ссылки в контенте.

**Tech Stack:** TypeScript, Sharp, Vitest, Next.js.

## Global Constraints

- Фото остаются WebP, без EXIF и не больше 1600×1600 пикселей.
- Нельзя увеличивать фото сверх исходного размера.
- Для нового кадра используется верхняя область портрета.
- Повторная обработка не меняет идентификаторы файлов и контент сотрудников.

---

### Task 1: Квадратное кадрирование при загрузке

**Files:**
- Modify: `src/lib/team-images.ts`
- Modify: `test/team-images.test.ts`

**Interfaces:**
- Produces: `storeTeamImage(bytes, type)` сохраняет квадратный WebP.
- Consumes: текущую проверку формата, лимита размера и EXIF-поворота.

- [ ] **Step 1: Write the failing tests**

```ts
expect(metadata).toMatchObject({ format: "webp", width: 32, height: 32 });
```

```ts
expect(metadata).toMatchObject({ format: "webp", width: 960, height: 960 });
```

- [ ] **Step 2: Run the targeted test and verify it fails**

Run: `npm.cmd test -- test/team-images.test.ts`

Expected: FAIL because existing conversion retains the original aspect ratio.

- [ ] **Step 3: Implement the minimal Sharp transformation**

```ts
.resize({
  width: TEAM_IMAGE_MAX_DIMENSION,
  height: TEAM_IMAGE_MAX_DIMENSION,
  fit: "cover",
  position: "north",
  withoutEnlargement: true,
})
```

- [ ] **Step 4: Run the targeted test and verify it passes**

Run: `npm.cmd test -- test/team-images.test.ts`

Expected: PASS.

### Task 2: Перекодирование существующих загруженных фото

**Files:**
- Create: `scripts/reprocess-team-avatars.ts`

**Interfaces:**
- Consumes: `transformTeamImage` from `src/lib/team-images.ts` and canonical image IDs stored in the team content.
- Produces: перезаписанные квадратные WebP по прежним UUID-файлам.

- [ ] **Step 1: Add the reprocessing script**

```ts
for (const imageId of referencedImageIds) {
  const source = await readFile(join(uploadDirectory, `${imageId}.webp`));
  await writeFile(join(uploadDirectory, `${imageId}.webp`), await transformTeamImage(source));
}
```

- [ ] **Step 2: Run the complete verification suite**

Run: `npm.cmd test && npm.cmd run build`

Expected: all tests pass and the production build completes.

- [ ] **Step 3: Commit, deploy, and reprocess the three specified images**

```bash
git add src/lib/team-images.ts test/team-images.test.ts scripts/reprocess-team-avatars.ts
git commit -m "fix: smart crop team avatars"
git push origin HEAD:main
```

Run the reprocessing script on the server with the three image UUIDs currently assigned to Федоровская Юлия, Антонович Виталий and Шаклеин Вадим; verify the output dimensions and the contacts page.

## Self-Review

- Spec coverage: new uploads, existing three uploads, preserved identifiers, square output and validation are covered.
- Type consistency: the script uses the same exported transform function as uploads.
- Scope: no manual crop coordinates or admin UI are added.
