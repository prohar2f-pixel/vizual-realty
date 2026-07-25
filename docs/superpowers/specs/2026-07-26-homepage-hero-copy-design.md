# Homepage hero copy update

## Goal

Replace the current homepage hero heading with the approved Russian copy and keep it on exactly two semantic lines.

## Approved copy

Line 1:

> Продажа квартир, домов, и земельных участков.

Line 2:

> Большой каталог проверенных объектов и личный агент сопровождающий всю сделку.

## Implementation

Update only the hero heading in `src/app/page.tsx`. Insert an explicit JSX line break between the two approved sentences so the intended split does not depend on viewport width. Render both lines with the Tailwind `font-bold` weight. Preserve the existing size, color, spacing, surrounding layout, and all other page content.

## Verification

- Add or update a focused homepage rendering test that asserts both exact lines and their order.
- Assert that the hero copy uses the `font-bold` class.
- Run the focused test and the production build.
- Visually verify the two-line heading on the live homepage after deployment.

## Scope

No typography changes other than the approved bold weight are included. Spacing, responsive layout, metadata, and other copy remain unchanged.
