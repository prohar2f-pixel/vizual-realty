# Task 2 report: approved manager presentation profiles

## Delivered

- Added `src/lib/manager-profiles.ts` with the requested public types:
  `ManagerProfile`, `CrmAgent`, and `ResolvedManager`.
- Added the five approved Topnlab manager profiles, keyed by their supplied IDs.
- Added `getManagerProfile`, which returns an approved profile only for a known
  ID and returns `undefined` for missing or unknown IDs.
- Added `resolveManager`, which refuses missing or unapproved CRM agents. For
  approved agents it uses the approved public name, applies only supplied
  public phone/photo overrides, otherwise preserves CRM phone/photo, and adds
  Telegram only when approved.
- No catalog or object UI files were changed. The module makes no assignment
  decision and does not alter full-sync or webhook data paths.

## Tests

Created `test/manager-profiles.test.ts` with four Vitest cases required by the
brief:

1. verifies ID `296892` returns Аянот Елена;
2. verifies an unknown ID returns `undefined`;
3. verifies `297092` replaces the generic CRM name with Антонович Виталий,
   retains CRM contact data, and emits no Telegram URL;
4. verifies `296892` supplies the approved Telegram URL and portrait path.

### Red/green evidence

The focused test command initially failed because
`../src/lib/manager-profiles` did not exist. After adding the resolver module,
the same command passed all four tests.

### Verification command

```text
npm.cmd test -- test/manager-profiles.test.ts
```

Result: exit code 0; 1 test file passed; 4 tests passed; 0 failures.

## Self-review

- Unknown and missing IDs cannot be converted into a different manager because
  resolution returns `undefined` without an approved profile.
- The incomplete public profile for `297092` deliberately has no phone, photo,
  or Telegram fields, so CRM contact fields are retained and Telegram is
  omitted.
- The approved public phone/photo/Telegram overrides are explicit and do not
  depend on CRM display names.
- `git diff --check` completed without whitespace errors.

## Scope and concerns

Only the Task 2 source file, focused test file, and this report are intended
for the Task 2 commit. The working tree contains pre-existing/unrelated
untracked SDD files and a plan, which are intentionally excluded. Git also
emits a non-fatal warning that it cannot access the user global ignore file;
it does not affect the focused test or scoped files.
