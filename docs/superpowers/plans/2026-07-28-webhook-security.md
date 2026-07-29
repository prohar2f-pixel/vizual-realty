# Topnlab Webhook Security Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Защитить `POST /api/webhook` обязательным query-секретом, строгой
проверкой запроса и внешним rate limit в Nginx без утечки секретов в логи.

**Architecture:** Next.js проверяет `TOPNLAB_WEBHOOK_SECRET` и `?secret=...` до
чтения body, затем ограниченно читает form-urlencoded payload и валидирует поля.
Nginx ограничивает размер и частоту запросов и пишет отдельный access log без
query string.

**Tech Stack:** Next.js 16.2.12 App Router, TypeScript, Node.js `crypto`,
Vitest 4, Nginx, PM2.

## Global Constraints

- Основной совместимый механизм: `POST /api/webhook?secret=...`.
- Использовать только `TOPNLAB_WEBHOOK_SECRET`; не переиспользовать другие
  секреты.
- Сравнивать SHA-256 digest через `timingSafeEqual`.
- При отсутствующей конфигурации возвращать `503`, а не отключать защиту.
- Возвращать `401` до чтения тела и вызовов CRM/БД.
- Разрешать только `application/x-www-form-urlencoded`.
- Максимальное тело: 8 КиБ.
- Realty ID соответствует `^[1-9][0-9]{0,19}$`.
- Rate limit хранится только в Nginx, не в памяти Next.js.
- Не логировать секрет, query string, ID объекта, payload или персональные данные.
- Не добавлять новые npm-зависимости.
- Production не изменять без отдельного подтверждения.
- Перед изменением Next.js route API прочитать релевантную документацию из
  `node_modules/next/dist/docs/`.

---

### Task 1: Зафиксировать конфигурационный и криптографический контракт

**Files:**
- Create: `src/lib/topnlab/webhook-security.ts`
- Test: `test/webhook-security.test.ts`

**Interfaces:**
- Produces:
  - `WebhookConfigurationError`
  - `readWebhookSecret(env?: Record<string, string | undefined>): string`
  - `verifyWebhookSecret(provided: string | null, expected: string): boolean`
  - `MAX_WEBHOOK_BODY_BYTES = 8_192`

- [ ] **Step 1: Прочитать документацию Next.js для Route Handlers**

После `npm ci` найти точный документ:

```bash
rg -n "Route Handlers|Request body|Request" node_modules/next/dist/docs
```

Прочитать найденный раздел перед изменением route. Не полагаться на API прежних
версий Next.js.

- [ ] **Step 2: Написать failing-тесты конфигурации**

Добавить в `test/webhook-security.test.ts` проверки:

```ts
expect(() => readWebhookSecret({})).toThrow(WebhookConfigurationError);
expect(() =>
  readWebhookSecret({ TOPNLAB_WEBHOOK_SECRET: "   " }),
).toThrow(WebhookConfigurationError);
expect(
  readWebhookSecret({
    TOPNLAB_WEBHOOK_SECRET: "0123456789abcdef0123456789abcdef",
  }),
).toBe("0123456789abcdef0123456789abcdef");
```

- [ ] **Step 3: Написать failing-тесты безопасного сравнения**

```ts
const expected = "0123456789abcdef0123456789abcdef";
expect(verifyWebhookSecret(expected, expected)).toBe(true);
expect(verifyWebhookSecret(null, expected)).toBe(false);
expect(verifyWebhookSecret("", expected)).toBe(false);
expect(verifyWebhookSecret("wrong", expected)).toBe(false);
```

Отдельно замокать `node:crypto` либо использовать spy вокруг
`timingSafeEqual`, чтобы подтвердить его вызов с двумя 32-байтовыми digest.

- [ ] **Step 4: Запустить тест и подтвердить красную фазу**

```bash
npx vitest run test/webhook-security.test.ts
```

Expected: FAIL, потому что модуль и экспорты ещё отсутствуют.

- [ ] **Step 5: Реализовать минимальный модуль**

Использовать фиксированные SHA-256 digest:

```ts
import { createHash, timingSafeEqual } from "node:crypto";

export const MAX_WEBHOOK_BODY_BYTES = 8_192;

export class WebhookConfigurationError extends Error {
  constructor() {
    super("Topnlab webhook authentication is not configured");
    this.name = "WebhookConfigurationError";
  }
}

export function readWebhookSecret(
  env: Record<string, string | undefined> = process.env,
): string {
  const secret = env.TOPNLAB_WEBHOOK_SECRET?.trim();
  if (!secret) throw new WebhookConfigurationError();
  return secret;
}

function digest(value: string) {
  return createHash("sha256").update(value, "utf8").digest();
}

export function verifyWebhookSecret(
  provided: string | null,
  expected: string,
): boolean {
  if (!provided) return false;
  return timingSafeEqual(digest(provided), digest(expected));
}
```

- [ ] **Step 6: Запустить точечный тест**

```bash
npx vitest run test/webhook-security.test.ts
```

Expected: PASS.

- [ ] **Step 7: Зафиксировать отдельный будущий commit**

После пользовательского разрешения на commit:

```bash
git add src/lib/topnlab/webhook-security.ts test/webhook-security.test.ts
git commit -m "test: define webhook authentication contract"
```

---

### Task 2: Добавить ограниченное чтение form-urlencoded body

**Files:**
- Modify: `src/lib/topnlab/webhook-security.ts`
- Modify: `test/webhook-security.test.ts`

**Interfaces:**
- Consumes: `MAX_WEBHOOK_BODY_BYTES`
- Produces:
  - `WebhookBodyTooLargeError`
  - `readLimitedWebhookBody(request: Request): Promise<string>`
  - `isWebhookFormContentType(value: string | null): boolean`

- [ ] **Step 1: Добавить failing-тесты Content-Type**

```ts
expect(isWebhookFormContentType("application/x-www-form-urlencoded")).toBe(true);
expect(
  isWebhookFormContentType(
    "application/x-www-form-urlencoded; charset=UTF-8",
  ),
).toBe(true);
expect(isWebhookFormContentType("application/json")).toBe(false);
expect(isWebhookFormContentType(null)).toBe(false);
```

- [ ] **Step 2: Добавить failing-тест по Content-Length**

Создать `Request` с `Content-Length: 8193` и убедиться, что
`readLimitedWebhookBody` отклоняет его через `WebhookBodyTooLargeError` до
обращения к `request.body.getReader()`.

- [ ] **Step 3: Добавить failing-тест потокового превышения**

Создать `ReadableStream<Uint8Array>` из двух chunk, суммарно превышающих 8192
байта. Проверить исключение `WebhookBodyTooLargeError` и вызов `reader.cancel()`.

- [ ] **Step 4: Добавить тест корректного UTF-8 тела**

```ts
const request = new Request("https://example.test/api/webhook", {
  method: "POST",
  body: "id=1233&type=realty",
});
expect(await readLimitedWebhookBody(request)).toBe("id=1233&type=realty");
```

- [ ] **Step 5: Запустить тесты и подтвердить красную фазу**

```bash
npx vitest run test/webhook-security.test.ts
```

Expected: FAIL на отсутствующих экспортируемых функциях.

- [ ] **Step 6: Реализовать MIME-проверку**

Нормализовать часть до первой `;` через `split(";", 1)[0].trim().toLowerCase()`
и сравнить с `application/x-www-form-urlencoded`.

- [ ] **Step 7: Реализовать потоковый лимит**

Алгоритм:

1. Строго разобрать `Content-Length`, если он есть.
2. Отклонить отрицательное, нецелое или превышающее лимит значение.
3. Получить `request.body?.getReader()`.
4. Суммировать `Uint8Array.byteLength`.
5. При превышении вызвать `reader.cancel()` и бросить
   `WebhookBodyTooLargeError`.
6. Декодировать собранные chunks одним `TextDecoder("utf-8", { fatal: true })`.
7. Ошибку невалидного UTF-8 преобразовать в безопасную ошибку запроса.

- [ ] **Step 8: Запустить точечные тесты**

```bash
npx vitest run test/webhook-security.test.ts
```

Expected: PASS.

- [ ] **Step 9: Зафиксировать отдельный будущий commit**

После пользовательского разрешения:

```bash
git add src/lib/topnlab/webhook-security.ts test/webhook-security.test.ts
git commit -m "feat: bound webhook request parsing"
```

---

### Task 3: Защитить Route Handler и сохранить совместимость

**Files:**
- Modify: `src/app/api/webhook/route.ts`
- Modify: `test/webhook.test.ts`

**Interfaces:**
- Consumes:
  - `readWebhookSecret`
  - `verifyWebhookSecret`
  - `isWebhookFormContentType`
  - `readLimitedWebhookBody`
  - `WebhookConfigurationError`
  - `WebhookBodyTooLargeError`
- Produces: защищённый `POST(request: Request): Promise<NextResponse>`

- [ ] **Step 1: Перестроить test setup без реальных секретов**

В `beforeEach`:

```ts
vi.stubEnv(
  "TOPNLAB_WEBHOOK_SECRET",
  "test-webhook-secret-0123456789abcdef",
);
```

В `afterEach` вызывать `vi.unstubAllEnvs()` и `vi.restoreAllMocks()`.
Штатные запросы создавать с URL:

```ts
new Request(
  "https://example.test/api/webhook?secret=test-webhook-secret-0123456789abcdef",
  requestInit,
);
```

- [ ] **Step 2: Написать failing-тест отсутствующей конфигурации**

Удалить env через `vi.stubEnv("TOPNLAB_WEBHOOK_SECRET", "")`, подать Request с
body getter/stream spy и проверить:

- HTTP `503`;
- `console.error` вызван только со строкой
  `topnlab_webhook_secret_not_configured`;
- body не прочитан;
- `getEntities` и `upsertProperty` не вызваны;
- response и log не содержат URL или тестовый секрет.

- [ ] **Step 3: Написать failing-тесты `401`**

Проверить отсутствующий, пустой и неверный `?secret=`. Для каждого случая:

- HTTP `401`;
- body не прочитан;
- CRM/БД не вызваны;
- `console` не получает URL, query, payload или secret.

- [ ] **Step 4: Написать failing-тесты `415` и `413`**

- Авторизованный JSON возвращает `415`.
- Авторизованный request с `Content-Length: 8193` возвращает `413`.
- Авторизованный поток свыше 8192 байт возвращает `413`.
- CRM/БД во всех случаях не вызываются.

- [ ] **Step 5: Написать table-driven failing-тесты полей**

Ожидаемый `400` для:

```text
type=
type=unknown
type=realty
type=realty&id=0
type=realty&id=-1
type=realty&id=abc
type=realty&id=123456789012345678901
type=realty&type=order&id=123
type=realty&id=123&id=124
```

Во всех случаях CRM/БД не вызываются.

- [ ] **Step 6: Сохранить тест игнорирования `type=order`**

Авторизованный `type=order&id=5` возвращает `200`, не вызывая CRM/БД.

- [ ] **Step 7: Обновить штатный тест `type=realty`**

Корректный авторизованный запрос вызывает `getEntities(["1233"])` и
`upsertProperty(...)` ровно один раз и возвращает `200`.

- [ ] **Step 8: Добавить failing-тест безопасного `502`**

Заставить `getEntities` выбросить ошибку с маркером
`private-topnlab-error-1233`. Проверить:

- HTTP `502`;
- response не содержит marker, ID, secret или query;
- `console.error` получает только
  `topnlab_webhook_processing_failed`.

Повторить для ошибки `upsertProperty`.

- [ ] **Step 9: Запустить route-тест и подтвердить красную фазу**

```bash
npx vitest run test/webhook.test.ts
```

Expected: новые проверки FAIL на текущем незащищённом route.

- [ ] **Step 10: Реализовать порядок guard clauses**

В `POST` использовать порядок:

```ts
const expectedSecret = readWebhookSecret();
const providedSecret = new URL(request.url).searchParams.get("secret");
if (!verifyWebhookSecret(providedSecret, expectedSecret)) {
  return errorResponse("unauthorized", 401);
}
if (!isWebhookFormContentType(request.headers.get("content-type"))) {
  return errorResponse("unsupported_media_type", 415);
}
const body = await readLimitedWebhookBody(request);
```

`WebhookConfigurationError` перехватывать отдельно, логировать стабильный код и
возвращать `503`. `WebhookBodyTooLargeError` преобразовывать в `413`.

- [ ] **Step 11: Реализовать строгий разбор полей**

Использовать `params.getAll("type")` и `params.getAll("id")`. Требовать ровно
одно значение `type`; для `realty` — ровно один `id`, соответствующий
`/^[1-9][0-9]{0,19}$/`.

- [ ] **Step 12: Изолировать processing error**

Обернуть только `getEntities`/`upsertProperty` в `try/catch`, записать
`topnlab_webhook_processing_failed` без объекта ошибки и вернуть стабильный
`502`.

- [ ] **Step 13: Запустить route и security тесты**

```bash
npx vitest run test/webhook.test.ts test/webhook-security.test.ts
```

Expected: PASS.

- [ ] **Step 14: Проверить изменённые файлы ESLint**

```bash
npx eslint src/app/api/webhook/route.ts \
  src/lib/topnlab/webhook-security.ts \
  test/webhook.test.ts \
  test/webhook-security.test.ts
```

Expected: 0 errors, 0 warnings.

- [ ] **Step 15: Зафиксировать отдельный будущий commit**

После пользовательского разрешения:

```bash
git add src/app/api/webhook/route.ts src/lib/topnlab/webhook-security.ts \
  test/webhook.test.ts test/webhook-security.test.ts
git commit -m "fix: authenticate Topnlab webhook requests"
```

---

### Task 4: Обновить конфигурацию и документацию Nginx

**Files:**
- Modify: `.env.example`
- Modify: `README.md`
- Modify: `PROJECT_CONTEXT.md`

**Interfaces:**
- Documents: `TOPNLAB_WEBHOOK_SECRET`, URL регистрации, Nginx rate limit,
  безопасный logging, rollout и rollback.

- [ ] **Step 1: Добавить пустую переменную в `.env.example`**

Рядом с Topnlab-настройками:

```dotenv
# Отдельный общий секрет для POST /api/webhook?secret=...
TOPNLAB_WEBHOOK_SECRET=""
```

Не добавлять пример реального значения.

- [ ] **Step 2: Документировать генерацию секрета без вывода**

В README описать интерактивную запись случайного секрета непосредственно в
защищённый `.env`, не передавая значение в argv и не печатая его. Сохранить
требования `umask 077` и `chmod 600 .env`.

- [ ] **Step 3: Документировать Nginx zone**

В `http` context добавить:

```nginx
limit_req_zone $binary_remote_addr zone=topnlab_webhook:10m rate=60r/m;
log_format webhook_safe '$remote_addr [$time_local] "$request_method $uri" '
                        '$status $body_bytes_sent $request_time';
```

- [ ] **Step 4: Документировать точный location**

Добавить exact-match location:

```nginx
location = /api/webhook {
    client_max_body_size 8k;
    limit_req zone=topnlab_webhook burst=30 nodelay;
    limit_req_status 429;
    access_log /var/log/nginx/vizual-webhook-access.log webhook_safe;

    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

Явно запретить `$request`, `$request_uri` и `$args` в формате webhook access log.

- [ ] **Step 5: Документировать регистрацию Topnlab**

Указать формат без реального значения:

```text
https://nedvizhimostdoneck.ru/api/webhook?secret=<TOPNLAB_WEBHOOK_SECRET>
```

Не вставлять production URL с заполненным секретом в README, issue, commit,
shell history или чат.

- [ ] **Step 6: Обновить `PROJECT_CONTEXT.md`**

Зафиксировать:

- обязательность `TOPNLAB_WEBHOOK_SECRET`;
- `401/503/415/413/429`;
- Nginx как единственное хранилище rate limit;
- безопасный webhook log без query string;
- необходимость отдельного подтверждения перед production rollout.

- [ ] **Step 7: Проверить документацию на утечки**

```bash
rg -n "TOPNLAB_WEBHOOK_SECRET|request_uri|\\$args|\\$request" \
  .env.example README.md PROJECT_CONTEXT.md
```

Проверить вручную, что присутствуют только имя переменной и шаблон, а не
production-значение.

- [ ] **Step 8: Зафиксировать отдельный будущий commit**

После пользовательского разрешения:

```bash
git add .env.example README.md PROJECT_CONTEXT.md
git commit -m "docs: document secure webhook deployment"
```

---

### Task 5: Полная локальная верификация

**Files:**
- Verify only; новых файлов проекта не создавать.

**Interfaces:**
- Consumes: реализация Tasks 1–4.
- Produces: проверенный candidate без публикации.

- [ ] **Step 1: Запустить webhook-тесты**

```bash
npx vitest run test/webhook.test.ts test/webhook-security.test.ts
```

Expected: PASS, 0 failed.

- [ ] **Step 2: Запустить полный тестовый набор**

```bash
npm test
```

Expected: все тесты PASS.

- [ ] **Step 3: Запустить typecheck**

```bash
npx tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 4: Запустить lint**

```bash
npm run lint
```

Expected: новые и изменённые файлы без ошибок; прежний документированный долг
Topnlab перечислить отдельно, если он остаётся.

- [ ] **Step 5: Запустить production build**

```bash
npm run build
```

Expected: exit 0.

- [ ] **Step 6: Проверить diff и отсутствие секретов**

```bash
git status --short --branch
git diff --check
git diff --stat
git diff -- .env.example README.md PROJECT_CONTEXT.md \
  src/app/api/webhook/route.ts src/lib/topnlab/webhook-security.ts \
  test/webhook.test.ts test/webhook-security.test.ts
```

Проверить, что diff не содержит production-секрет, query URL с реальным
значением, персональные данные или посторонние изменения.

---

### Task 6: Подготовить безопасный production rollout

**Files:**
- Production configuration only after separate user approval.

**Interfaces:**
- Consumes: проверенный commit и документированную Nginx-конфигурацию.
- Produces: защищённый production endpoint с обратимой процедурой выпуска.

- [ ] **Step 1: Получить отдельное подтверждение пользователя**

Не менять production, `.env`, Topnlab или Nginx до явного разрешения.

- [ ] **Step 2: Записать точку отката**

Сохранить текущий production commit и копию Nginx-конфигурации в timestamped
backup без вывода `.env`.

- [ ] **Step 3: Установить production-секрет**

Сгенерировать независимый секрет длиной не менее 32 байт и записать только в
`.env` с режимом `0600`, не выводя значение.

- [ ] **Step 4: Обновить URL в Topnlab**

Зарегистрировать полный HTTPS URL с query-секретом через защищённый интерфейс
Topnlab. Не копировать URL в логи, issue или чат.

- [ ] **Step 5: Применить Nginx-конфигурацию**

Добавить rate zone, безопасный log format и exact location. Проверить:

```bash
sudo nginx -t
```

Expected: syntax is ok; test is successful. Только затем выполнить reload.

- [ ] **Step 6: Выпустить приложение штатной процедурой проекта**

Использовать backup/build/restart порядок из README. Не выполнять миграции БД:
эта задача не меняет схему Prisma.

- [ ] **Step 7: Провести smoke test**

Проверить:

- без секрета — `401`;
- неверный секрет — `401`;
- JSON с верным секретом — `415`;
- тело больше 8 КиБ — `413`;
- превышение Nginx rate — `429`;
- корректный реальный webhook — `200` и обновление ожидаемого объекта.

- [ ] **Step 8: Проверить логи**

Просмотреть отдельный Nginx webhook access log, Nginx error log и PM2 log.
Подтвердить отсутствие query string, секрета, ID объекта, payload и
персональных данных.

- [ ] **Step 9: Выполнить rollback при ошибке**

Вернуть предыдущий commit и Nginx backup, проверить `nginx -t`, reload и
перезапустить PM2. Секрет не удалять до завершения диагностики; не публиковать
его значение.
