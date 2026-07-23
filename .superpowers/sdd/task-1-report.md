# Task 1 report: Topnlab agent extraction

## Scope completed

- Inspected `src/lib/topnlab/map.ts` and confirmed the existing mapper preserves the canonical `e.agent.id` as `MappedProperty.agent.id` through `String(e.agent.id)`.
- Confirmed the existing `e.agent` mapping also preserves `name`, `phone`, and `photo` (as `photoUrl`) without guessing alternate source fields.
- Added a focused Vitest case that supplies employee ID `296892` as a number and verifies the resulting ID is the string `"296892"` and the source agent name is retained.

## Code-change decision

`src/lib/topnlab/map.ts` required no change: it already meets the stated mapping requirements. The test protects that behavior against regression.

## Verification

Ran `npm.cmd test -- test/map.test.ts` after the test change. The focused map test suite passed: one file and two tests.

## Follow-up correction

- Replaced the mojibake employee name in the regression test with the exact UTF-8 Cyrillic value, `Аянот Елена`.
- Reran the required focused test after the correction; it passed.

## Self-review

- The test asserts the canonical source shape (`agent.id`) only.
- No fallback manager or alternate field inference was introduced.
- No manual assignment, sync, or webhook behavior was modified.
