# Why Vizual copy update

## Goal

Replace only the text content in the homepage section headed `Почему «Визуал»` while preserving its existing layout and visual styling.

## Approved introduction

> Мы поможем купить или продать недвижимость с заботой и вниманием к деталям. Каждый объект проверен юристами, а сопроводит вашу сделку опытный агент.

## Approved benefits

1. Title: `Большой каталог`
   Description: `более 200 проверенных объектов`
2. Title: `Опытный агент`
   Description: `на каждом этапе сделки, полное сопровождение`
3. Title: `Открытие ипотеки бесплатно`
   Description: none
4. Title: `Сопровождение сделки под ключ`
   Description: `от звонка до получения ключей`

## Implementation

Update the introduction and benefits list in `src/app/page.tsx`. Add the fourth list item using the same markup and styling as the existing benefit rows. For the third item, render only the title and do not add an empty description element.

## Verification

- Extend the homepage server-rendering test to assert the approved introduction and four benefit titles.
- Assert the three supplied descriptions and the absence of the replaced legacy copy.
- Run the focused test, full test suite, and production build.
- Visually verify the updated section on the live homepage after deployment.

## Scope

Do not change typography, spacing, colors, links, the adjacent `200+` panel, or any other homepage content.
