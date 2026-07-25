# Homepage hero copy update

## Goal

Replace the current homepage hero heading with the approved Russian copy and keep it on exactly two semantic lines.

## Approved copy

Line 1:

> Продажа квартир, домов, и земельных участков.

Line 2:

> Большой каталог проверенных объектов и личный агент сопровождающий всю сделку.

## Implementation

Update only the hero heading in `src/app/page.tsx`. Insert an explicit JSX line break between the two approved sentences so the intended split does not depend on viewport width. Preserve the existing heading styles, surrounding layout, and all other page content.

## Verification

- Add or update a focused homepage rendering test that asserts both exact lines and their order.
- Run the focused test and the production build.
- Visually verify the two-line heading on the live homepage after deployment.

## Scope

No typography, spacing, responsive layout, metadata, or other copy changes are included.
