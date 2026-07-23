# Task 3 — Display the assigned manager

## Implementation

- Catalog queries now join each property's assigned agent and pass only `resolveManager(p.agent)` to `PropertyCard`.
- `PropertyCard` accepts an optional resolved manager and displays a compact green-bordered attribution row below the property facts, with an optional circular portrait, the label `Ваш менеджер`, and the approved manager name.
- The object page resolves the joined agent before rendering. Recognised manager IDs receive `AgentCard`; all other assignments show neutral copy and a Next `Link` to `/team`, without exposing an unapproved CRM contact.
- `AgentCard` now consumes resolved `name`, `phone`, `photo`, and optional `telegram` fields. It retains the call action and conditionally renders a public Telegram link that opens in a new tab.

## Scope and safety review

- No CRM mapping, Prisma schema, or manager-profile data was changed.
- Manager contact details are shown only after `resolveManager` approves the Topnlab ID.
- The catalog card remains one Link; no interactive element was nested inside it.
- All newly added Russian UI copy is UTF-8 Cyrillic.

## Verification

- `npm.cmd test` — passed: 5 files, 11 tests.
- `npm.cmd run build` — passed: Next.js production compilation, TypeScript, and static-page generation completed successfully.

## Commit

`feat: show assigned manager on property cards`

## Concerns

None. The first sandboxed build attempt could not open `.next/trace-build` (`EPERM`); rerunning the same build with the required permission completed successfully.
