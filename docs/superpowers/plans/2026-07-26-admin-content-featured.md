# План реализации админ-панели, текстов, команды и избранных объектов

> **Для исполнителей:** ОБЯЗАТЕЛЬНЫЙ НАВЫК: выполнять план по задачам с помощью `superpowers:subagent-driven-development` (рекомендуется) или `superpowers:executing-plans`. Для отслеживания используются флажки `- [ ]`.

**Цель:** Создать защищённую админ-панель, через которую заказчик управляет избранными объектами, текстами сайта и карточками сотрудников с черновиком, предпросмотром, публикацией и одним обратимым откатом.

**Архитектура:** Авторизация работает через один серверный логин, scrypt-хеш пароля и зашифрованную AES-256-GCM cookie-сессию. Избранные объекты хранятся реляционно, а версионируемые тексты и карточки команды — в строго проверяемом JSON `SiteContent`; фотографии команды лежат в постоянной папке VPS вне Git. Публичные страницы читают только опубликованную версию и при любой ошибке используют безопасные значения из кода.

**Стек:** Next.js 16.2.9 App Router, React 19.2.4, TypeScript, Prisma 7.8, PostgreSQL, Vitest 4.1.9, Tailwind CSS 4, Node.js `crypto`, Sharp.

## Общие ограничения

- Все пользовательские надписи админ-панели и сообщения об ошибках — на русском языке.
- Секреты задаются только через `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`, `ADMIN_SESSION_SECRET`, необязательный `ADMIN_SESSION_TTL_HOURS`, `SITE_ORIGIN` и `TEAM_UPLOAD_DIR`.
- Нельзя читать, печатать, коммитить или передавать клиенту содержимое `.env`, секреты, хеш пароля и cookie.
- Cookie: зашифрованная и защищённая от подмены, `HttpOnly`, `SameSite=Strict`, `Secure` в production, путь `/`, срок по умолчанию 12 часов.
- Все изменяющие запросы требуют действующую сессию и точное совпадение `Origin` с `SITE_ORIGIN`.
- В избранном разрешено от одного до трёх уникальных публичных объектов; порядок 1–3 сохраняется транзакционно.
- В текстах нельзя сохранять HTML, Markdown, JavaScript, произвольные ключи и значения сверх установленных ограничений.
- Разрешено не более 30 карточек сотрудников, включая скрытые; физического удаления через админ-панель нет.
- Фото: JPG, PNG или WebP до 10 МБ, реальный формат проверяется, метаданные удаляются, большая сторона не более 1600 px, результат WebP.
- До публикации посетители видят только `published`; предпросмотр черновика доступен только администратору.
- Перед изменением файлов Next.js полностью прочитать подходящие установленные руководства из `node_modules/next/dist/docs/`, как требует `AGENTS.md`.
- На Windows использовать `npm.cmd` и `npx.cmd`, а не `npm` и `npx`.
- Не пушить и не развёртывать без отдельного явного запроса пользователя.

---

## Структура файлов

- `prisma/schema.prisma` — модели `FeaturedProperty` и `SiteContent`.
- `prisma/migrations/<timestamp>_admin_content_featured/migration.sql` — атомарная миграция и начальное избранное.
- `src/lib/admin/session.ts` — шифрование, чтение и срок cookie-сессии.
- `src/lib/admin/auth.ts` — пароль scrypt, вход, выход и обязательная серверная авторизация.
- `src/lib/admin/request.ts` — проверка `Origin` и безопасные ответы ошибок.
- `src/lib/site-content/schema.ts` — типы, ограничения и строгая проверка JSON.
- `src/lib/site-content/defaults.ts` — текущие тексты и восемь сотрудников как встроенный резерв.
- `src/lib/site-content/store.ts` — чтение черновика/публикации, сохранение, публикация и откат.
- `src/lib/featured.ts` — запрос, проверка и транзакционная замена избранного.
- `src/lib/team-images.ts` — проверка, преобразование, хранение и безопасная выдача фото.
- `src/app/admin/**` — закрытые страницы и клиентские формы.
- `src/app/api/admin/**` — вход, выход, поиск/сохранение избранного, тексты, публикация, откат и загрузка фото.
- `src/app/api/team-images/[id]/route.ts` — публичная безопасная выдача загруженного изображения.
- `src/components/site-content/**` — небольшие публичные секции с данными через props.
- `scripts/seed-admin-content.ts` — идемпотентное начальное заполнение текущими данными.
- `test/admin-*.test.ts`, `test/site-content*.test.ts`, `test/featured*.test.ts`, `test/team-images.test.ts` — модульные и маршрутные проверки.

### Задача 1: Добавить модели базы и первоначальные данные

**Файлы:**
- Изменить: `prisma/schema.prisma`
- Создать: `prisma/migrations/<timestamp>_admin_content_featured/migration.sql`
- Создать: `src/lib/site-content/defaults.ts`
- Создать: `scripts/seed-admin-content.ts`
- Создать: `test/site-content-defaults.test.ts`

**Интерфейсы:**
- Создаёт `FeaturedProperty { propertyId, position, updatedAt }` и `SiteContent { id, draft, published, previousPublished, draftUpdatedAt, publishedAt, updatedAt }`.
- Создаёт `DEFAULT_SITE_CONTENT: SiteContentV1` с текущими текстами и восемью карточками сотрудников.
- Создаёт `seedAdminContent(): Promise<void>`; повторный запуск не перезаписывает пользовательские данные.

- [ ] **Шаг 1: Зафиксировать резервные данные тестом**

Создать тест, проверяющий версию, текущий заголовок главной, восемь уникальных сотрудников и отсутствие HTML:

```ts
expect(DEFAULT_SITE_CONTENT.schemaVersion).toBe(1);
expect(DEFAULT_SITE_CONTENT.home.heroTitle).toContain("земельных участков");
expect(DEFAULT_SITE_CONTENT.team.members).toHaveLength(8);
expect(new Set(DEFAULT_SITE_CONTENT.team.members.map((m) => m.id)).size).toBe(8);
expect(JSON.stringify(DEFAULT_SITE_CONTENT)).not.toMatch(/<script|<[^>]+>/i);
```

- [ ] **Шаг 2: Запустить тест и увидеть RED**

`npm.cmd test -- test/site-content-defaults.test.ts`

Ожидается ошибка отсутствующего модуля `site-content/defaults`.

- [ ] **Шаг 3: Добавить модели, миграцию и минимальные значения по умолчанию**

В Prisma добавить связь `Property.featured`, каскадное удаление и уникальную позицию. В миграции создать таблицы и заполнить `FeaturedProperty` максимум тремя строками из `Property WHERE isFeed = true ORDER BY price DESC`, используя `row_number()`. JSON начально записывать через скрипт, чтобы источником истины был типизированный `DEFAULT_SITE_CONTENT`, а не продублированная SQL-строка.

- [ ] **Шаг 4: Сделать seed идемпотентным**

Использовать `upsert` только с веткой `create`; если `SiteContent(id="site")` существует, не менять ни черновик, ни публикацию. Первоначальное избранное добавлять только при пустой таблице.

- [ ] **Шаг 5: Сгенерировать Prisma Client и проверить GREEN**

```powershell
npx.cmd prisma generate
npm.cmd test -- test/site-content-defaults.test.ts
```

- [ ] **Шаг 6: Коммит**

```powershell
git add prisma src/generated/prisma src/lib/site-content/defaults.ts scripts/seed-admin-content.ts test/site-content-defaults.test.ts
git commit -m "feat: add admin content persistence"
```

### Задача 2: Реализовать строгую схему контента

**Файлы:**
- Создать: `src/lib/site-content/schema.ts`
- Создать: `test/site-content-schema.test.ts`

**Интерфейсы:**
- Создаёт `SiteContentV1`, `TeamMemberV1`, `SiteContentValidationError`.
- Создаёт `parseSiteContent(value: unknown): SiteContentV1` и `safeParseSiteContent(value: unknown): { success: true; data: SiteContentV1 } | { success: false; issues: ContentIssue[] }`.

- [ ] **Шаг 1: Написать RED-тесты схемы**

Проверить корректный default, неизвестный ключ, HTML/Markdown-ссылку, слишком длинное поле, 31 сотрудника, повтор ID карточки, повтор `topnlabAgentId`, видимого сотрудника без контакта и допустимого скрытого сотрудника без контакта.

```ts
expect(() => parseSiteContent(DEFAULT_SITE_CONTENT)).not.toThrow();
expect(() => parseSiteContent({ ...DEFAULT_SITE_CONTENT, extra: true })).toThrow();
expect(() => parseSiteContent(withTitle("<b>текст</b>"))).toThrow();
expect(() => parseSiteContent(withVisibleMember({ phone: "", email: "", telegram: "" }))).toThrow();
```

- [ ] **Шаг 2: Убедиться в RED**

`npm.cmd test -- test/site-content-schema.test.ts`

- [ ] **Шаг 3: Реализовать проверку без новой универсальной CMS-библиотеки**

Явно разобрать каждый разрешённый объект и поле, проверяя точное множество ключей. Нормализовать пробелы, телефон, email, Telegram username/URL и необязательный ID Topnlab. Запретить `<`, `>`, Markdown-ссылки и схемы URL в обычном тексте. Ограничить короткие подписи 120 символами, абзацы 1200 символами, массив преимуществ шестью, команду тридцатью карточками.

- [ ] **Шаг 4: Проверить GREEN и коммит**

```powershell
npm.cmd test -- test/site-content-schema.test.ts
git add src/lib/site-content/schema.ts test/site-content-schema.test.ts
git commit -m "feat: validate editable site content"
```

### Задача 3: Реализовать зашифрованную сессию и вход

**Файлы:**
- Создать: `src/lib/admin/session.ts`
- Создать: `src/lib/admin/auth.ts`
- Создать: `src/lib/admin/request.ts`
- Создать: `src/app/api/admin/login/route.ts`
- Создать: `src/app/api/admin/logout/route.ts`
- Создать: `src/app/admin/login/page.tsx`
- Создать: `src/app/admin/login/LoginForm.tsx`
- Создать: `test/admin-session.test.ts`
- Создать: `test/admin-auth.test.ts`

**Интерфейсы:**
- `sealSession(payload, secret, now?): string`, `unsealSession(token, secret, now?): AdminSession | null`.
- `verifyAdminPassword(password, encodedScryptHash): Promise<boolean>`.
- `requireAdminSession(): Promise<AdminSession>` перенаправляет на `/admin/login`.
- `assertTrustedOrigin(request): void` бросает безопасную ошибку 403.

- [ ] **Шаг 1: Прочитать документацию Next.js**

Полностью прочитать установленные разделы про `cookies()`, Route Handlers, redirect, Server/Client Components и формы в `node_modules/next/dist/docs/`.

- [ ] **Шаг 2: Написать RED-тесты криптографии и пароля**

Проверить round-trip AES-256-GCM, подмену одного байта, истечение, неверный секрет, отсутствие обязательных env, корректный и неверный scrypt-пароль. Формат хеша закрепить как `scrypt$N$r$p$saltBase64$hashBase64`.

- [ ] **Шаг 3: Реализовать криптографическое ядро**

Получать 32-байтовый ключ из `ADMIN_SESSION_SECRET` через SHA-256, для каждой cookie генерировать 12-байтовый IV и 16-байтовый auth tag. Сравнивать scrypt-результат через `timingSafeEqual`; не включать логин или пароль в ошибки.

- [ ] **Шаг 4: Реализовать маршруты входа и выхода**

Вход использует существующий rate limiter, возвращает одно сообщение `Неверный логин или пароль`, ставит cookie `vizual_admin_session`. Выход проверяет Origin и удаляет cookie. При успехе форма делает переход на `/admin/featured`.

- [ ] **Шаг 5: Проверить маршруты и безопасность**

```powershell
npm.cmd test -- test/admin-session.test.ts test/admin-auth.test.ts test/rate-limit.test.ts
```

Добавить проверки, что тело ответа и сериализованный HTML не содержат `ADMIN_SESSION_SECRET`, hash или введённый пароль.

- [ ] **Шаг 6: Коммит**

```powershell
git add src/lib/admin src/app/api/admin/login src/app/api/admin/logout src/app/admin/login test/admin-session.test.ts test/admin-auth.test.ts
git commit -m "feat: secure admin authentication"
```

### Задача 4: Создать защищённую оболочку админ-панели

**Файлы:**
- Создать: `src/app/admin/(protected)/layout.tsx`
- Создать: `src/app/admin/(protected)/page.tsx`
- Создать: `src/components/admin/AdminShell.tsx`
- Создать: `src/app/admin/robots.ts` или добавить admin-запрет в `src/app/robots.ts`
- Создать: `test/admin-shell.test.tsx`

**Интерфейсы:**
- `AdminShell` принимает `children`, показывает навигацию «Избранные», «Тексты», «Предпросмотр», «Выйти».
- Protected layout вызывает `requireAdminSession()` до вывода дочерней страницы.

- [ ] **Шаг 1: Написать RED-тест интерфейса**

Через `renderToStaticMarkup` проверить русские пункты, отсутствие лишних настроек и наличие формы POST выхода. Отдельно проверить `robots.ts`: `/admin/` и `/api/admin/` запрещены.

- [ ] **Шаг 2: Реализовать мобильную оболочку в утверждённом дизайне**

Использовать существующие брендовые CSS-переменные, крупные области нажатия и простую верхнюю навигацию. Корневой `/admin` перенаправляет на `/admin/featured`. Для защищённых ответов добавить `Cache-Control: private, no-store` и `X-Robots-Tag: noindex, nofollow` там, где это поддерживает Next.js.

- [ ] **Шаг 3: GREEN и коммит**

```powershell
npm.cmd test -- test/admin-shell.test.tsx
git add src/app/admin src/components/admin/AdminShell.tsx src/app/robots.ts test/admin-shell.test.tsx
git commit -m "feat: add protected admin shell"
```

### Задача 5: Реализовать выбор избранных объектов

**Файлы:**
- Создать: `src/lib/featured.ts`
- Создать: `src/app/api/admin/featured/route.ts`
- Создать: `src/app/api/admin/properties/route.ts`
- Создать: `src/app/admin/(protected)/featured/page.tsx`
- Создать: `src/app/admin/(protected)/featured/FeaturedEditor.tsx`
- Создать: `test/featured.test.ts`
- Создать: `test/featured-editor.test.tsx`

**Интерфейсы:**
- `getFeaturedProperties(): Promise<PropertyCardData[]>`.
- `replaceFeaturedPropertyIds(ids: string[]): Promise<void>`.
- `searchPublicProperties({ query, page, pageSize }): Promise<{ items; total; page; pageSize }>`.

- [ ] **Шаг 1: Написать RED-тесты доменной логики**

Проверить 0, 1, 3 и 4 ID, повторы, скрытый/несуществующий объект, порядок результата, пропуск скрытого после сохранения и единственный вызов `$transaction` при замене.

- [ ] **Шаг 2: Реализовать чистую проверку и Prisma-запросы**

Сначала проверить форму массива, затем получить все `Property WHERE id IN (...) AND isFeed=true`, сопоставить отсутствующие ID и только после этого выполнить транзакцию `deleteMany + createMany`. Публичное чтение сортировать по `position` и фильтровать `property.isFeed`.

- [ ] **Шаг 3: Написать RED-тест редактора**

Проверить максимум три карточки, кнопки «Выше», «Ниже», «Убрать», блокировку «Добавить» при трёх, поиск и предупреждение `beforeunload` при изменении.

- [ ] **Шаг 4: Реализовать API и интерфейс**

Поиск принимает строку до 120 символов и страницу, ищет по точному ID/shortId и нечувствительному `contains` для title, address, city. Выдавать по 20 результатов. POST сохранения проверяет сессию и Origin, затем возвращает новый сохранённый список.

- [ ] **Шаг 5: GREEN и коммит**

```powershell
npm.cmd test -- test/featured.test.ts test/featured-editor.test.tsx
git add src/lib/featured.ts src/app/api/admin/featured src/app/api/admin/properties src/app/admin/\(protected\)/featured test/featured*.test.*
git commit -m "feat: manage featured properties"
```

### Задача 6: Реализовать хранилище черновика, публикацию и откат

**Файлы:**
- Создать: `src/lib/site-content/store.ts`
- Создать: `src/app/api/admin/content/route.ts`
- Создать: `src/app/api/admin/publish/route.ts`
- Создать: `src/app/api/admin/rollback/route.ts`
- Создать: `test/site-content-store.test.ts`

**Интерфейсы:**
- `getPublishedContent(): Promise<SiteContentV1>` всегда возвращает пригодные данные.
- `getDraftContent(): Promise<SiteContentV1>` требует корректной записи и сообщает админке об ошибке.
- `saveDraft(input: unknown): Promise<SiteContentV1>`.
- `publishDraft(): Promise<SiteContentV1>` и `rollbackPublished(): Promise<SiteContentV1>`.

- [ ] **Шаг 1: Написать RED-тесты состояний**

Проверить fallback при отсутствии строки, ошибке БД и повреждённом JSON; сохранение draft без изменения published; атомарное `previousPublished=published, published=draft`; откат со swap; отказ отката без предыдущей версии.

- [ ] **Шаг 2: Реализовать store с инъекцией Prisma для тестов**

Фабрика `createSiteContentStore(client)` содержит всю работу с БД, а экспортируемые функции используют `db`. Публичный loader ловит исключение, пишет только код `site_content_fallback` и возвращает clone default; административное чтение не скрывает повреждение.

- [ ] **Шаг 3: Реализовать изменяющие API**

Каждый POST сначала вызывает проверку сессии и Origin, затем строгую схему. Ошибки полей возвращать как `{ ok:false, issues:[{ path, message }] }` со статусом 400; конфликт/БД — общий статус 409/500 без stack и JSON контента.

- [ ] **Шаг 4: GREEN и коммит**

```powershell
npm.cmd test -- test/site-content-store.test.ts test/site-content-schema.test.ts
git add src/lib/site-content/store.ts src/app/api/admin/content src/app/api/admin/publish src/app/api/admin/rollback test/site-content-store.test.ts
git commit -m "feat: add content draft publishing"
```

### Задача 7: Добавить загрузку и выдачу фотографий команды

**Файлы:**
- Изменить: `package.json`, `package-lock.json`
- Создать: `src/lib/team-images.ts`
- Создать: `src/app/api/admin/team-images/route.ts`
- Создать: `src/app/api/team-images/[id]/route.ts`
- Создать: `scripts/cleanup-team-images.ts`
- Создать: `test/team-images.test.ts`

**Интерфейсы:**
- `storeTeamImage(bytes, claimedType): Promise<{ id: string; url: string }>`.
- `resolveTeamImagePath(id): string | null` не принимает `/`, `\`, `..` или расширение от клиента.
- `collectReferencedImageIds(contents): Set<string>` и `cleanupOrphanTeamImages(now): Promise<number>`.

- [ ] **Шаг 1: Установить Sharp и написать RED-тесты**

```powershell
npm.cmd install sharp
```

Тесты создают небольшие in-memory PNG/JPEG/WebP и проверяют итоговый WebP, максимум 1600 px, отказ для SVG/текста/10 МБ+, traversal ID, отсутствие исходного имени и сохранность ID из draft/published/previousPublished.

- [ ] **Шаг 2: Реализовать атомарную запись файла**

Проверить magic bytes через Sharp metadata, обработать `rotate()`, `resize({ width:1600, height:1600, fit:"inside", withoutEnlargement:true })`, `webp()`. Записать во временный файл в `TEAM_UPLOAD_DIR`, затем атомарно переименовать в `<randomUUID>.webp`; при ошибке убрать только известный временный файл.

- [ ] **Шаг 3: Реализовать upload и public GET**

Upload требует auth+Origin, `multipart/form-data`, один файл и лимит 10 МБ до обработки. GET принимает только UUID, отдаёт `image/webp`, `nosniff` и длительный immutable cache; отсутствующий файл даёт 404 без раскрытия пути.

- [ ] **Шаг 4: Реализовать безопасную очистку**

Скрипт читает три версии `SiteContent`, строит множество ссылок и удаляет только `.webp` с UUID-именем, не используемые нигде и старше 24 часов. Перед удалением проверяет `resolve()` каждого файла внутри точного `TEAM_UPLOAD_DIR`.

- [ ] **Шаг 5: GREEN и коммит**

```powershell
npm.cmd test -- test/team-images.test.ts
git add package.json package-lock.json src/lib/team-images.ts src/app/api/admin/team-images src/app/api/team-images scripts/cleanup-team-images.ts test/team-images.test.ts
git commit -m "feat: upload team photos safely"
```

### Задача 8: Создать редактор текстов и сотрудников

**Файлы:**
- Создать: `src/app/admin/(protected)/content/page.tsx`
- Создать: `src/app/admin/(protected)/content/ContentEditor.tsx`
- Создать: `src/components/admin/TextField.tsx`
- Создать: `src/components/admin/TeamMemberEditor.tsx`
- Создать: `test/content-editor.test.tsx`
- Создать: `test/team-member-editor.test.tsx`

**Интерфейсы:**
- `ContentEditor` принимает `initialDraft: SiteContentV1`, сохраняет весь проверяемый snapshot.
- `TeamMemberEditor` изменяет одну `TeamMemberV1`, загружает фото и возвращает новый `imageId` только после успешного ответа.

- [ ] **Шаг 1: Написать RED-тесты интерфейса**

Проверить четыре вкладки, русские labels, limits, сохранение черновика, показ field issue по path, возврат к сохранённому draft и `beforeunload`. Для команды проверить добавление со случайным ID, максимум 30, порядок, скрытие/восстановление, отсутствие кнопки физического удаления и сохранение старого фото при ошибке upload.

- [ ] **Шаг 2: Реализовать формы небольшими компонентами**

Не строить универсальный конструктор форм. Явно описать поля каждой страницы в `ContentEditor`, переиспользуя только `TextField` и `TeamMemberEditor`. Телефон/email/Telegram хранить как значения, не как готовые HTML или href.

- [ ] **Шаг 3: Реализовать устойчивое состояние**

Хранить `lastSavedDraft` отдельно от редактируемого состояния; dirty вычислять сравнением стабильной сериализации. «Отменить изменения» возвращает `lastSavedDraft`. После успешного POST обновлять обе копии. Ошибки сервера не сбрасывают форму.

- [ ] **Шаг 4: GREEN и коммит**

```powershell
npm.cmd test -- test/content-editor.test.tsx test/team-member-editor.test.tsx
git add src/app/admin/\(protected\)/content src/components/admin/TextField.tsx src/components/admin/TeamMemberEditor.tsx test/content-editor.test.tsx test/team-member-editor.test.tsx
git commit -m "feat: edit site content and team"
```

### Задача 9: Добавить закрытый предпросмотр, публикацию и откат

**Файлы:**
- Создать: `src/app/admin/(protected)/preview/page.tsx`
- Создать: `src/components/admin/PreviewBar.tsx`
- Создать: `src/components/site-content/SitePageRenderer.tsx`
- Создать: `test/admin-preview.test.tsx`

**Интерфейсы:**
- `SitePageRenderer({ page, content, preview })` использует те же публичные секции, что обычные страницы.
- `PreviewBar` отправляет publish/rollback только после подтверждения.

- [ ] **Шаг 1: Написать RED-тесты предпросмотра**

Проверить вывод draft-маркера, кнопок «Вернуться к правкам» и «Опубликовать», отсутствие доступа без сессии, `no-store/noindex`, а также отсутствие скрытых сотрудников в preview публичной части.

- [ ] **Шаг 2: Реализовать preview через реальные публичные компоненты**

Страница принимает только известный параметр `page=home|about|team|contacts`, читает draft и передаёт его в общий renderer. Не создавать копии публичной разметки внутри admin.

- [ ] **Шаг 3: Подключить публикацию и откат**

Перед POST показывать точное подтверждение. После publish обновлять состояние и сообщать дату. Кнопку отката отключать при `previousPublished=null`; успешный откат оставляет обратный откат доступным.

- [ ] **Шаг 4: GREEN и коммит**

```powershell
npm.cmd test -- test/admin-preview.test.tsx test/site-content-store.test.ts
git add src/app/admin/\(protected\)/preview src/components/admin/PreviewBar.tsx src/components/site-content/SitePageRenderer.tsx test/admin-preview.test.tsx
git commit -m "feat: preview and publish site content"
```

### Задача 10: Подключить опубликованные данные ко всем публичным страницам

**Файлы:**
- Изменить: `src/app/layout.tsx`
- Изменить: `src/app/page.tsx`
- Изменить: `src/app/about/page.tsx`
- Изменить: `src/app/team/page.tsx`
- Изменить: `src/app/contacts/page.tsx`
- Изменить: `src/app/catalog/page.tsx`
- Изменить: `src/app/object/[id]/page.tsx`
- Изменить: `src/components/Header.tsx`, `Footer.tsx`, `MobileNav.tsx`, `TeamCarousel.tsx`
- Изменить: `src/lib/manager-profiles.ts`, `src/lib/featured.ts`
- Удалить после переноса: `src/app/team/managers.ts`
- Создать: `test/published-content-pages.test.tsx`

**Интерфейсы:**
- Все страницы получают `SiteContentV1` через `getPublishedContent()`; preview передаёт draft тем же компонентам.
- `resolveManager(agent, content.team.members)` сначала ищет опубликованную видимую карточку по `topnlabAgentId`, затем использует безопасный CRM fallback.

- [ ] **Шаг 1: Написать RED-интеграционные тесты**

Проверить, что изменённый published title появляется на главной, draft — нет; team/contacts имеют одинаковый порядок видимых сотрудников; скрытые отсутствуют; custom manager используется для объекта с совпавшим Topnlab ID; при ошибке loader отображаются defaults.

- [ ] **Шаг 2: Вынести публичные секции без изменения дизайна**

Передавать текстовые данные через props в существующую разметку. Не менять классы и визуальную структуру, кроме корректного состояния при нуле сотрудников. Header/Footer получают global labels и контакты из published.

- [ ] **Шаг 3: Переключить избранные объекты**

Главная вызывает `getFeaturedProperties()`. Если таблица ещё не инициализирована, использовать прежний top-3 запрос; после наличия записей показывать ровно сохранённые доступные 1–3. Не дополнять выбор автоматическими объектами.

- [ ] **Шаг 4: Устранить дубли команды**

Удалить статические массивы из `team/managers.ts` и `contacts/page.tsx`. Общий опубликованный массив становится единственным источником. Синхронизация Topnlab продолжает обновлять `Agent` и связи объектов, но не перезаписывает административные профили.

- [ ] **Шаг 5: GREEN и коммит**

```powershell
npm.cmd test -- test/published-content-pages.test.tsx test/homepage-hero.test.tsx test/contacts-managers.test.tsx test/team-manager-contact.test.tsx test/manager-profiles.test.ts
git add src/app src/components src/lib test
git commit -m "feat: render published admin content"
```

### Задача 11: Полная проверка, миграционная репетиция и документация

**Файлы:**
- Изменить: `.env.example` — только названия и безопасные комментарии, без значений секретов.
- Изменить: `README.md`
- Изменить: `PROJECT_CONTEXT.md`
- Изменить: `CHANGELOG.md`

**Интерфейсы:**
- Документирует генерацию scrypt hash без вывода пароля, создание `TEAM_UPLOAD_DIR`, seed, cleanup, backup и rollback deploy.

- [ ] **Шаг 1: Выполнить полный набор проверок**

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run build
```

Ожидается: все тесты и production build проходят; новые файлы не добавляют lint errors. Известные старые предупреждения перечислить, а не скрывать.

- [ ] **Шаг 2: Проверить миграцию на отдельной тестовой базе**

Создать временную PostgreSQL-базу без использования production URL, применить все миграции, запустить `seed-admin-content` дважды, проверить одну строку `SiteContent`, 1–3 позиции избранного и восемь сотрудников. Затем проверить upgrade с копии схемы до миграции. Не выводить connection string.

- [ ] **Шаг 3: Проверить безопасность и границы diff**

```powershell
git status --short --branch
git diff --check origin/main...HEAD
git diff --stat origin/main...HEAD
git log --oneline origin/main..HEAD
git ls-files ".env*"
```

Убедиться, что отслеживается только `.env.example`, нет загруженных пользовательских фото, ключей, cookie, дампов БД и логов.

- [ ] **Шаг 4: Обновить документацию**

Описать точный порядок: backup БД и uploads → миграция → создание uploads с правами процесса → env без печати → seed → build → restart → smoke test. Добавить восстановление: откат к предыдущему commit, совместимая схема остаётся, published данные не удаляются.

- [ ] **Шаг 5: Финальный локальный коммит**

```powershell
git add .env.example README.md PROJECT_CONTEXT.md CHANGELOG.md docs/superpowers/plans/2026-07-26-admin-content-featured.md
git commit -m "docs: document admin operations"
```

- [ ] **Шаг 6: Передать результат на проверку**

Сообщить путь worktree, список коммитов, результаты test/lint/build, результат миграционной репетиции и необходимые серверные переменные без их значений. Не выполнять push и deploy, пока пользователь явно не попросит.

### Задача 12: Развёртывание после отдельного подтверждения пользователя

**Файлы:**
- Код не изменять; работать только с GitHub и сервером в согласованном порядке.

**Интерфейсы:**
- Результат: main содержит проверенные коммиты, production мигрирован, PM2 работает, `/admin/login` и публичный сайт прошли smoke test.

- [ ] **Шаг 1: Создать резервные копии**

На VPS сохранить датированную резервную копию PostgreSQL и постоянной папки uploads. Проверить существование и ненулевой размер файлов, не скачивая и не показывая их содержимое.

- [ ] **Шаг 2: Push и обновление main**

Только после явного разрешения пользователя отправить ветку, интегрировать проверенный код в `main` принятой в проекте процедурой и убедиться, что `origin/main` указывает на ожидаемый commit.

- [ ] **Шаг 3: Настроить серверные переменные закрытым способом**

Задать шесть переменных через защищённый интерфейс сервера. Хеш пароля генерировать локально на сервере из скрытого ввода; секрет сессии — CSPRNG. Не использовать команды, печатающие значения обратно.

- [ ] **Шаг 4: Мигрировать и перезапустить**

В `/home/vizual/app` получить точный `origin/main`, установить lockfile-зависимости, применить Prisma migration, запустить идемпотентный seed, собрать Next.js и перезапустить `vizual` через PM2. При любой ошибке остановиться до restart либо вернуть предыдущий рабочий commit.

- [ ] **Шаг 5: Выполнить production smoke test**

Проверить публичные Home/About/Team/Contacts/Catalog/Object, вход и выход, выбор 1–3 объектов, upload фото, сохранение draft, закрытый preview, publish, rollback, скрытие/восстановление сотрудника, мобильный вид и отсутствие индексации/cache админки. Не сообщать учётные данные в Git или задаче.

- [ ] **Шаг 6: Зафиксировать результат**

Сообщить публичный commit, время развёртывания, состояние PM2 и результаты smoke test. Указать, где хранится backup и каков срок его хранения, не раскрывая секретные пути или данные доступа.
