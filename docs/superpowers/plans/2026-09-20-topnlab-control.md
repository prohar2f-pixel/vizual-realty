# Topnlab Control Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a separate read-only control application that identifies verifiable Topnlab/site catalogue mismatches and data-quality gaps without changing production data.

**Architecture:** Add an independent Next.js application in `control/`, with its own PostgreSQL database and two PM2 processes: `control-web` and `control-worker`. Source adapters produce time-stamped snapshots; a canonical-ID layer and pure rule engine produce observations; only a complete covered run may resolve an existing issue.

**Tech Stack:** Next.js 16, React 19, TypeScript, Prisma 7, PostgreSQL 16, `pg`, Vitest, PM2, Nginx.

**Spec:** `docs/superpowers/specs/2026-09-20-topnlab-control-design.md`

## Global Constraints

- The application is available only on `control.nedvizhimostdoneck.ru`; it is a separate app and database from the production site.
- It must never make POST, PUT, PATCH, or DELETE requests to Topnlab.
- It must never write to the production site database; its site DB role has `CONNECT` and `SELECT` only.
- Do not print or commit secrets, database URLs, Topnlab keys, cookies, personal data, or production responses.
- Every source snapshot records its read window, record count, sorted-ID SHA-256 hash, status, and sanitized failure reason.
- Issues resolve only after a `success` run has full required-source coverage and the applicable rule no longer matches.
- A partial or failed run may not bulk-create source-absence issues and may not resolve existing issues.
- Keep the live site, its webhook, cron task, PM2 process, schema, and environment unchanged during the test rollout.

## Review Focus

- A source returns valid HTTP but no IDs: mark that source failed and do not treat all objects as missing; covered in Task 2.
- Topnlab changes an ID response shape: fail the contract check instead of silently comparing an arbitrary object; covered in Task 2.
- XML, API, and site DB are read at different moments: persist each timestamp and show the run as a time-window comparison; covered in Task 3.
- An API or DB outage happens after prior issues were found: retain them as `stale`/current rather than resolving them; covered in Task 3.
- The manual button is clicked during a scheduled run: return a conflict and preserve a single consistent run; covered in Task 4.

---

## File Structure

| Path | Responsibility |
| --- | --- |
| `control/package.json` | Standalone app scripts and pinned dependencies. |
| `control/prisma/schema.prisma` | Only the control database schema. |
| `control/src/lib/config.ts` | Strict environment parsing; returns safe typed config. |
| `control/src/lib/sources/*.ts` | Read-only XML, Topnlab API, and site-DB adapters. |
| `control/src/lib/audit/canonical.ts` | Canonical ID and source-ID mapping. |
| `control/src/lib/audit/rules.ts` | Pure mismatch and data-quality rules. |
| `control/src/lib/audit/run.ts` | Snapshot orchestration, coverage, persistence, issue lifecycle. |
| `control/src/lib/audit/lock.ts` | PostgreSQL advisory lock wrapper. |
| `control/src/worker.ts` | Hourly scheduler and manual-run entry point. |
| `control/src/lib/auth/*.ts` | Login, encrypted session, CSRF/Origin and IP policy. |
| `control/src/app/**` | Protected dashboard, run API, health/readiness routes. |
| `control/test/**` | Fixtures and unit/integration tests; no production credentials. |
| `control/deploy/*.conf` | PM2 ecosystem and Nginx virtual-host templates without secrets. |

### Task 1: Create the isolated control application and its data model

**Files:**
- Create: `control/package.json`
- Create: `control/tsconfig.json`
- Create: `control/prisma/schema.prisma`
- Create: `control/src/lib/config.ts`
- Create: `control/.env.example`
- Test: `control/test/config.test.ts`

**Interfaces:**
- Produces `readControlConfig(env): ControlConfig`.
- Produces Prisma models `AuditRun`, `SourceSnapshot`, `ObjectMapping`, `AuditIssue`, `AuditIssueObservation`, and `AuditAction`.

- [ ] **Step 1: Write failing configuration tests**

```ts
import { expect, test } from "vitest";
import { readControlConfig } from "../src/lib/config";

test("rejects a missing control database URL", () => {
  expect(() => readControlConfig({})).toThrow("CONTROL_DATABASE_URL");
});

test("accepts HTTPS origin and separate read-only site URL", () => {
  const config = readControlConfig({
    CONTROL_DATABASE_URL: "postgresql://control:pw@db/control",
    SITE_READONLY_DATABASE_URL: "postgresql://reader:pw@db/site",
    CONTROL_ORIGIN: "https://control.nedvizhimostdoneck.ru",
    TOPNLAB_BASE_URL: "https://agencies-p.topnlab.ru",
    TOPNLAB_KEY: "key",
    TOPNLAB_FEED_URL: "https://example.test/feed.xml",
    CONTROL_ADMIN_USERNAME: "owner",
    CONTROL_ADMIN_PASSWORD_HASH: "scrypt$16384$8$1$MTIzNDU2Nzg5MDEyMzQ1Ng==$MTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU=",
    CONTROL_SESSION_SECRET: "12345678901234567890123456789012",
  });
  expect(config.origin).toBe("https://control.nedvizhimostdoneck.ru");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd control && npm test -- config.test.ts`

Expected: FAIL because the control app and `readControlConfig` do not exist.

- [ ] **Step 3: Create the package, config, and schema**

Create a private `control` package using the same major versions as the site. `readControlConfig` must validate exact HTTPS origin, nonempty URLs, a session secret of at least 32 UTF-8 bytes, and an optional comma-separated `CONTROL_ALLOWED_IPS` using `node:net.isIP`. It returns no method that serializes secrets.

Use these schema relationships and enums:

```prisma
enum RunStatus { success partial failed }
enum SnapshotStatus { success partial failed skipped }
enum IssueStatus { open review ignored resolved stale }
enum ObservationState { seen not_seen skipped }

model AuditRun {
  id String @id @default(cuid())
  trigger String
  status RunStatus
  ruleVersion String
  startedAt DateTime
  finishedAt DateTime?
  snapshots SourceSnapshot[]
  observations AuditIssueObservation[]
}

model SourceSnapshot {
  id String @id @default(cuid())
  auditRunId String
  source String
  status SnapshotStatus
  readStartedAt DateTime
  readFinishedAt DateTime
  recordCount Int?
  idsSha256 String?
  errorCode String?
  auditRun AuditRun @relation(fields: [auditRunId], references: [id], onDelete: Cascade)
  @@unique([auditRunId, source])
}
```

Add the remaining models so `AuditIssue` has a unique `(ruleCode, canonicalId)`, `AuditIssueObservation` is unique per `(auditRunId, auditIssueId)`, mappings retain source and raw ID, and actions retain actor, action, optional comment, and timestamp. Keep raw field evidence in JSON on `AuditIssueObservation`, never in an error message.

- [ ] **Step 4: Run the test and generate the Prisma client**

Run: `cd control && npm test -- config.test.ts && npx prisma validate`

Expected: PASS; Prisma validates the isolated schema.

- [ ] **Step 5: Commit**

```bash
git add control/package.json control/tsconfig.json control/prisma/schema.prisma control/src/lib/config.ts control/.env.example control/test/config.test.ts
git commit -m "feat(control): scaffold isolated audit application"
```

### Task 2: Implement strict read-only source adapters and ID canonicalization

**Files:**
- Create: `control/src/lib/sources/types.ts`
- Create: `control/src/lib/sources/xml-feed.ts`
- Create: `control/src/lib/sources/topnlab-api.ts`
- Create: `control/src/lib/sources/site-db.ts`
- Create: `control/src/lib/audit/canonical.ts`
- Create: `control/test/fixtures/feed.xml`
- Create: `control/test/sources.test.ts`

**Interfaces:**
- Produces `readXmlFeed(config, fetcher): Promise<SourceResult>`.
- Produces `readTopnlabApi(config, fetcher): Promise<SourceResult>`.
- Produces `readSitePublishedIds(client): Promise<SourceResult>`.
- Produces `canonicalize(source, rawId): CanonicalId`.

- [ ] **Step 1: Write failing adapter tests**

```ts
test("rejects XML without nonempty offer internal-id values", async () => {
  await expect(readXmlFeed(config, async () => new Response("<offers />")))
    .rejects.toThrow("XML_FEED_EMPTY");
});

test("rejects an object-shaped get-ids response", async () => {
  await expect(readTopnlabApi(config, async () => Response.json({ ids: ["1"] })))
    .rejects.toThrow("TOPNLAB_IDS_SHAPE");
});

test("uses only published Property IDs from the site query", async () => {
  const result = await readSitePublishedIds({
    query: async () => ({ rows: [{ id: "140832382" }] }),
  });
  expect(result.ids).toEqual(["140832382"]);
});
```

- [ ] **Step 2: Run the adapter test to verify it fails**

Run: `cd control && npm test -- sources.test.ts`

Expected: FAIL because the adapters are not implemented.

- [ ] **Step 3: Implement the minimal read-only adapters**

Define a common result that never returns a secret:

```ts
export type SourceName = "xml" | "api" | "site";
export type SourceResult = {
  source: SourceName;
  ids: string[];
  rawEntities: Map<string, Record<string, unknown>>;
  startedAt: Date;
  finishedAt: Date;
  idsSha256: string;
};
```

The XML adapter performs one GET to `TOPNLAB_FEED_URL`, accepts only a parseable XML document with at least one trimmed `offer[internal-id]`, deduplicates IDs, sorts them, and hashes `ids.join("\n")` with SHA-256.

The API adapter calls the documented existing GET endpoints only. It first requires a JSON array from `get-ids`; it records the raw response shape in a test fixture, not the database. Before enabling production calls, configure batch size, delay, and retry count through validated environment values and run its contract test against a non-production sample; no default assumes pagination or a retry policy. Cards returned by `get-entities` must be associated only with their explicit string `id`.

The site adapter executes exactly:

```sql
BEGIN READ ONLY;
SELECT "id" FROM "Property" WHERE "isFeed" = true ORDER BY "id";
COMMIT;
```

Use a separate `pg` Pool built only from `SITE_READONLY_DATABASE_URL`. Do not import the production site's Prisma client.

- [ ] **Step 4: Add canonicalization tests and implementation**

```ts
test("does not silently join unequal source IDs", () => {
  expect(canonicalize("xml", " 140832382 ")).toEqual({ source: "xml", rawId: "140832382", canonicalId: "140832382" });
  expect(canonicalize("api", "offer-140832382").canonicalId).not.toBe("140832382");
});
```

Implement only trimmed nonempty string identity mapping in version `identity-v1`. Any nonidentity mapping throws `ID_MAPPING_UNCONFIRMED`; it cannot enter comparison until a later approved mapping version and fixture are added.

- [ ] **Step 5: Run the source tests**

Run: `cd control && npm test -- sources.test.ts`

Expected: PASS, including no fetch call with a non-GET method.

- [ ] **Step 6: Commit**

```bash
git add control/src/lib/sources control/src/lib/audit/canonical.ts control/test/fixtures/feed.xml control/test/sources.test.ts
git commit -m "feat(control): add read-only source adapters"
```

### Task 3: Build the audit engine, issue evidence, coverage, and lifecycle

**Files:**
- Create: `control/src/lib/audit/rules.ts`
- Create: `control/src/lib/audit/run.ts`
- Create: `control/src/lib/audit/repository.ts`
- Create: `control/test/audit-run.test.ts`
- Create: `control/test/fixtures/audit-ids.ts`

**Interfaces:**
- Consumes three `SourceResult` values from Task 2.
- Produces `evaluateRun(input): EvaluatedRun` and `persistRun(input): Promise<AuditRun>`.

- [ ] **Step 1: Write failing mismatch and coverage tests**

```ts
test("reports the measured directional difference without claiming a source is wrong", () => {
  const result = evaluateRun(fixture({ apiOnly: 52, xmlOnly: 33 }));
  expect(result.issues.filter((x) => x.ruleCode === "api-not-in-xml")).toHaveLength(52);
  expect(result.issues.filter((x) => x.ruleCode === "xml-not-in-api")).toHaveLength(33);
});

test("does not resolve an open issue after a partial run", async () => {
  await repository.seedOpenIssue("xml-not-in-site", "140832382");
  await persistRun(partialRunMissing("site"), repository);
  expect(await repository.issueStatus("xml-not-in-site", "140832382")).toBe("stale");
});
```

- [ ] **Step 2: Run the audit test to verify it fails**

Run: `cd control && npm test -- audit-run.test.ts`

Expected: FAIL because evaluation and persistence do not exist.

- [ ] **Step 3: Implement pure rules before persistence**

Use stable rule codes: `xml-not-in-site`, `site-not-in-xml`, `api-not-in-xml`, `xml-not-in-api`, `api-card-missing`, `photo-missing`, `price-invalid`, `flat-details-missing`, `city-missing`, and `manager-missing`.

Define the output precisely:

```ts
export type CandidateIssue = {
  ruleCode: string;
  canonicalId: string;
  category: "exact" | "incomplete" | "review";
  requiredSources: SourceName[];
  evidence: Record<string, unknown>;
};

export type EvaluatedRun = {
  status: "success" | "partial" | "failed";
  issues: CandidateIssue[];
  coveredRuleCodes: Set<string>;
  skippedRuleCodes: Set<string>;
};
```

Run set-difference rules only when both required snapshots succeeded. Run field rules only when API cards have an explicitly mapped ID. `photo-missing`, `price-invalid`, and missing city/manager must be emitted only when their approved applicability predicate returns true; the initial predicate returns `false` for ambiguous policy cases and emits a `review` candidate instead.

- [ ] **Step 4: Implement persistence and resolution guard**

Persist each snapshot before evaluating rules. Upsert by `(ruleCode, canonicalId)`, write an observation for every evaluated issue/rule, and write evidence as JSON.

Resolution pseudocode must be implemented as one transaction:

```ts
if (run.status === "success" && ruleWasCovered && !currentIssueWasSeen) {
  updateIssue(issueId, { status: "resolved", lastSeenAt: now });
} else if (run.status !== "success" && issueDependsOnUnavailableSource) {
  updateIssue(issueId, { status: "stale" });
}
```

Never resolve `review` or `ignored` records automatically. Never delete issues or observations.

- [ ] **Step 5: Run tests for success, partial, and failed states**

Run: `cd control && npm test -- audit-run.test.ts`

Expected: PASS for zero differences, 52/33 directional differences, one XML-only ID, no false resolution after partial failure, and resolution after a complete successful run.

- [ ] **Step 6: Commit**

```bash
git add control/src/lib/audit control/test/audit-run.test.ts control/test/fixtures/audit-ids.ts
git commit -m "feat(control): persist covered audit issues"
```

### Task 4: Add exclusive worker execution and health endpoints

**Files:**
- Create: `control/src/lib/audit/lock.ts`
- Create: `control/src/worker.ts`
- Create: `control/src/app/api/runs/route.ts`
- Create: `control/src/app/health/route.ts`
- Create: `control/src/app/ready/route.ts`
- Test: `control/test/lock.test.ts`
- Test: `control/test/health.test.ts`

**Interfaces:**
- Consumes `persistRun` from Task 3.
- Produces `withAuditLock<T>(pool, callback): Promise<{ acquired: boolean; value?: T }>`.
- Produces POST `/api/runs` returning 202 or 409 without executing a second run.

- [ ] **Step 1: Write failing exclusive-run tests**

```ts
test("returns acquired false when PostgreSQL advisory lock is held", async () => {
  const result = await withAuditLock(lockedPool, async () => "run");
  expect(result).toEqual({ acquired: false });
});

test("manual run returns 409 when a worker owns the lock", async () => {
  const response = await POST(trustedPostRequest());
  expect(response.status).toBe(409);
});
```

- [ ] **Step 2: Run the worker test to verify it fails**

Run: `cd control && npm test -- lock.test.ts health.test.ts`

Expected: FAIL because lock and routes do not exist.

- [ ] **Step 3: Implement the worker and routes**

Use one fixed signed 64-bit PostgreSQL advisory lock key documented in `lock.ts`. Acquire it with `SELECT pg_try_advisory_lock($1)` on a dedicated checked-out connection and release it in `finally` with `pg_advisory_unlock`; do not use an in-memory boolean.

`worker.ts` schedules one run at minute 10 of each hour, records trigger `scheduled`, and exits nonzero only for process-level failures. A manual POST records trigger `manual`, requires auth from Task 5, and returns `409 {"ok":false,"error":"Проверка уже выполняется"}` if unavailable.

`GET /health` returns `200 {"ok":true}` without DB access. `GET /ready` runs `SELECT 1` against the control DB and returns 503 on failure without exposing the connection error.

- [ ] **Step 4: Run tests**

Run: `cd control && npm test -- lock.test.ts health.test.ts`

Expected: PASS; exactly one callback runs and readiness never exposes a database URL.

- [ ] **Step 5: Commit**

```bash
git add control/src/lib/audit/lock.ts control/src/worker.ts control/src/app/api/runs/route.ts control/src/app/health/route.ts control/src/app/ready/route.ts control/test/lock.test.ts control/test/health.test.ts
git commit -m "feat(control): add exclusive audit worker"
```

### Task 5: Implement protected control access and auditable review actions

**Files:**
- Create: `control/src/lib/auth/auth.ts`
- Create: `control/src/lib/auth/session.ts`
- Create: `control/src/lib/auth/request.ts`
- Create: `control/src/app/login/page.tsx`
- Create: `control/src/app/api/login/route.ts`
- Create: `control/src/app/api/issues/[id]/status/route.ts`
- Create: `control/src/middleware.ts`
- Test: `control/test/auth.test.ts`
- Test: `control/test/issue-status.test.ts`

**Interfaces:**
- Produces `requireSession(request)`, `assertStateChangingRequest(request)`, and `isAllowedClientIp(request)`.
- Produces POST `/api/issues/:id/status` accepting only `review` or `ignored` with a 1–1,000-character comment.

- [ ] **Step 1: Write failing security tests**

```ts
test("rejects state change without the matching CSRF token and Origin", async () => {
  const response = await updateIssueStatus(untrustedRequest());
  expect(response.status).toBe(403);
});

test("writes a control-only action when an issue is ignored", async () => {
  await updateIssueStatus(trustedRequest({ status: "ignored", comment: "Проверено в CRM" }));
  expect(await repository.lastAction()).toMatchObject({ action: "ignored", comment: "Проверено в CRM" });
});
```

- [ ] **Step 2: Run the security tests to verify they fail**

Run: `cd control && npm test -- auth.test.ts issue-status.test.ts`

Expected: FAIL because protected routes do not exist.

- [ ] **Step 3: Implement authenticated access**

Reuse the production site's tested scrypt and AES-256-GCM session design by copying it into the independent control app under new `CONTROL_*` variable names. Set the cookie `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/`, max age from config. Enforce the precise `CONTROL_ORIGIN` on login and all state-changing endpoints, plus a double-submit CSRF token. Rate-limit login to 5 attempts per IP/15 minutes and 50 global attempts/15 minutes.

If `CONTROL_ALLOWED_IPS` is nonempty, deny every request whose trusted reverse-proxy client IP is not listed. Configure Nginx to overwrite, not forward blindly, `X-Real-IP`.

The issue status route validates input, records an `AuditAction` in the control DB, and never calls Topnlab or the site database.

- [ ] **Step 4: Run security tests**

Run: `cd control && npm test -- auth.test.ts issue-status.test.ts`

Expected: PASS for valid login, bad password, rate limit, invalid cookie, missing Origin, invalid CSRF, allowlisted and blocked IP, and control-only audit action.

- [ ] **Step 5: Commit**

```bash
git add control/src/lib/auth control/src/app/login control/src/app/api/login control/src/app/api/issues control/src/middleware.ts control/test/auth.test.ts control/test/issue-status.test.ts
git commit -m "feat(control): protect control actions"
```

### Task 6: Build the evidence-first dashboard

**Files:**
- Create: `control/src/app/page.tsx`
- Create: `control/src/app/issues/page.tsx`
- Create: `control/src/app/runs/page.tsx`
- Create: `control/src/components/RunSummary.tsx`
- Create: `control/src/components/IssueTable.tsx`
- Create: `control/src/lib/dashboard.ts`
- Test: `control/test/dashboard.test.tsx`

**Interfaces:**
- Consumes `AuditRun`, `SourceSnapshot`, `AuditIssue`, and `AuditIssueObservation` persisted by Task 3.
- Produces server-side filtered rows with `id`, `rule`, `source`, `category`, `manager`, and `status` query parameters.

- [ ] **Step 1: Write failing dashboard tests**

```tsx
test("shows the snapshot time and source state next to every count", async () => {
  render(await DashboardPage({ searchParams: Promise.resolve({}) }));
  expect(screen.getByText("XML: 335")).toBeInTheDocument();
  expect(screen.getByText("Снимок: 18.09.2026 14:00")).toBeInTheDocument();
});

test("does not label an API-only object as a CRM error", () => {
  render(<IssueTable issues={[apiOnlyIssue]} />);
  expect(screen.getByText("Есть в API, отсутствует в XML")) .toBeInTheDocument();
  expect(screen.queryByText("Ошибка CRM")).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run the dashboard tests to verify they fail**

Run: `cd control && npm test -- dashboard.test.tsx`

Expected: FAIL because dashboard components do not exist.

- [ ] **Step 3: Implement the protected UI**

The home page shows last success and last failure, rule version, duration, and three source cards containing count, timestamp, hash prefix, and status. The issues page provides tabs for exact, incomplete, review, resolved/stale, and filters named in the spec. Every row shows raw/canonical ID, rule code, evidence, source state, responsible manager if present, first/last seen, and coverage.

Render external links only when constructed from a validated numeric/identity-mapped ID and an allowlisted `https://crm.topnlab.ru/` base. Render a site link only from `https://nedvizhimostdoneck.ru/object/` plus encoded ID. Do not use source text as a URL.

The runs page lists snapshots, statuses, durations, sanitized error codes, and no response body or credential.

- [ ] **Step 4: Run the dashboard tests**

Run: `cd control && npm test -- dashboard.test.tsx`

Expected: PASS for source timestamps, directional wording, filters, evidence, and safe external links.

- [ ] **Step 5: Commit**

```bash
git add control/src/app control/src/components control/src/lib/dashboard.ts control/test/dashboard.test.tsx
git commit -m "feat(control): add audit dashboard"
```

### Task 7: Provision the test contour and perform a non-invasive acceptance run

**Files:**
- Create: `control/deploy/ecosystem.config.cjs`
- Create: `control/deploy/nginx-control.conf`
- Create: `control/deploy/control.service.example`
- Create: `control/README.md`
- Modify: `README.md`
- Test: `control/test/deploy-config.test.ts`

**Interfaces:**
- Consumes the built `control-web` and `control-worker` from Tasks 1–6.
- Produces an operator runbook using only protected server variables and two PM2 process names.

- [ ] **Step 1: Write failing deployment configuration tests**

```ts
test("does not contain production credentials or a write-capable Topnlab method", async () => {
  const files = await readDeployFiles();
  expect(files).not.toMatch(/TOPNLAB_KEY=.\S+/);
  expect(files).not.toMatch(/curl\s+-X\s+(POST|PUT|PATCH|DELETE)/i);
});

test("proxies only the control host and keeps HSTS and frame protection", async () => {
  const nginx = await readFile("deploy/nginx-control.conf", "utf8");
  expect(nginx).toContain("server_name control.nedvizhimostdoneck.ru");
  expect(nginx).toContain("Strict-Transport-Security");
  expect(nginx).toContain("frame-ancestors 'none'");
});
```

- [ ] **Step 2: Run the deployment test to verify it fails**

Run: `cd control && npm test -- deploy-config.test.ts`

Expected: FAIL because deployment templates do not exist.

- [ ] **Step 3: Create deployment templates and operator runbook**

The PM2 ecosystem defines `control-web` with `next start -p 3101` and `control-worker` with `tsx src/worker.ts`; both use an absolute server-only environment file and restart on failure. Nginx proxies only `control.nedvizhimostdoneck.ru` to port 3101, redirects HTTP to HTTPS, sets HSTS, `X-Content-Type-Options`, `Referrer-Policy`, CSP frame protection, a 16 KiB login body limit, and a trusted `X-Real-IP` from Nginx.

The runbook instructs the operator to: create a new control PostgreSQL database; create a separate production-site read-only role; apply the control migration; set protected variables on the server; run `npm ci`, `npm run build`, Prisma migration, and PM2; verify `/health`, `/ready`, protected login, a manual run, and that no production table modification time changes. It must state that DNS/TLS setup and the approved allowed IPs are prerequisites, not commands that may be run against production without authorization.

- [ ] **Step 4: Run full local checks**

Run: `cd control && npm test && npm run build && npx prisma validate`

Expected: PASS; build does not require a production database connection.

- [ ] **Step 5: Conduct the test-contour acceptance run**

On the approved test host only: run a manual audit; compare saved snapshot counts against the UI; use fixtures to verify 0, 1, and 85 directional differences; simulate one unavailable source in a test environment; verify no issue resolves during the partial run. Capture only counts, timestamps, statuses, and hashes in the acceptance note.

- [ ] **Step 6: Commit**

```bash
git add control/deploy control/README.md control/test/deploy-config.test.ts README.md
git commit -m "docs(control): add safe test-contour deployment runbook"
```

## Plan Self-Review

**Spec coverage:** Tasks 1–3 implement isolated persistence, source contracts, canonical IDs, snapshots, rule evidence, and issue lifecycle. Task 4 implements scheduling, advisory locking, and health checks. Task 5 implements protected actions and audit history. Task 6 implements the specified evidence-first UI. Task 7 implements test-only deployment, non-invasive acceptance, and readiness checks. No requirement is left without an owning task.

**Placeholder scan:** The plan contains no `TODO`, `TBD`, “implement later”, or unspecified error-handling steps. Each task names files, interfaces, failing tests, commands, and an explicit commit.

**Type consistency:** `SourceResult` is produced in Task 2 and consumed in Task 3; `EvaluatedRun` is produced by Task 3 and invoked by Task 4; protected manual runs and issue actions use Task 5’s request guard; Task 6 only reads Task 3 persistence types.

**Review focus coverage:** Empty source/XML/API shapes are tested in Task 2; non-atomic timestamps in Task 3; partial failure lifecycle in Task 3; concurrent runs in Task 4; protected state changes in Task 5.
