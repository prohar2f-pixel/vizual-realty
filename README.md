# Проект: сайт для агентства недвижимости «Визуал»

> **Продолжение работы в новом диалоге:** сначала прочитайте [PROJECT_CONTEXT.md](./PROJECT_CONTEXT.md). Там находятся актуальные данные о продакшене, Topnlab, менеджерах, командах проверки и безопасном деплое. Этот файл имеет приоритет над устаревшими заметками ниже.

Корпоративный сайт с живым каталогом объектов и интеграцией с CRM Topnlab.
Дизайн-референс: ndv.ru

## Стороны

**Заказчик** — ИП Антонович Виталий Сергеевич (АН «Визуал»)
- ИНН 234606935533, ОГРНИП 323237500296850
- Адрес: 352054, Краснодарский край, ст. Старолеушковская, ул. Украинская, д. 79
- Телефон: 8 918-173-88-52 · E-mail: AVS-rielt@mail.ru
- Банк: Филиал «Центральный» Банка ВТБ (ПАО), р/с 40802810606080006764, БИК 044525411

**Исполнитель** — самозанятая Жукова Анна Владимировна, ИНН 910609523008
- Контакт: Александр, Telegram @alex_prohar, prohar2f@gmail.com

## Условия (из КП)

- **Цена:** 35 000 ₽ (дизайн 8 000 + вёрстка 12 000 + интеграция 12 000 + деплой 3 000)
- **Оплата:** 50% аванс + 50% после сдачи
- **Срок:** 14 дней, 4 этапа (макеты → вёрстка → интеграция CRM → тесты/запуск)
- **Состав сайта:** главная, каталог с фильтрами, карточки объектов, форма заявки, «О компании», контакты, адаптив
- **Технологии:** PostgreSQL, деплой на Railway, синхронизация с CRM Topnlab в реальном времени
- **Гарантия:** 1 месяц поддержки, исходный код передаётся Заказчику

## Что в папках

- `КП/` — коммерческое предложение (`kp-realty.html`). Онлайн: https://prohar2f-pixel.github.io/kp-realty.html
- `Договор/` — договор на разработку сайта (`.docx`)
- `realty-project/` — документация по CRM Topnlab от Арины: конспект API `topnlab-api.md` + оригинальные PDF + свой `README.md` (данные с удалённого сервера)

## Статус разработки

### Готово ✅
- [x] КП готов
- [x] Договор готов
- [x] Документация по CRM Topnlab получена
- [x] Разработка сайта (основной функционал)
- [x] Интеграция с Topnlab XML-фид
- [x] Интерфейс каталога объектов
- [x] Полноэкранная галерея фотографий
- [x] Навигация между объектами
- [x] Форматирование описаний
- [x] Деплой на Beget VPS
- [x] Готово к демонстрации клиенту

### Предстоит
- [ ] Параллельная передача заявки из формы в Topnlab и назначенному менеджеру (канал менеджера ещё не выбран)
- [ ] Получить ID Topnlab для менеджеров, которые пока не привязаны к объектам
- [ ] Добавить реальные опыт и достижения в карточки команды после получения данных от заказчика

## Технологический стек

**Frontend:**
- Next.js 16.2.12 (Turbopack)
- React 19
- TypeScript
- Tailwind CSS
- Responsive Design

**Backend:**
- Node.js
- Prisma ORM
- PostgreSQL

**DevOps:**
- Beget VPS (Ubuntu 22.04)
- PM2 (процесс-менеджер)
- Nginx (реверс-прокси)
- ISR (60 сек) для статических страниц

**Интеграции:**
- Topnlab CRM (XML-фид)
- XML парсинг (xml2js)

## Как запустить локально

```bash
npm install
npm run dev -- -p 3100
```

Доступно на http://localhost:3100. На Windows используйте `npm.cmd` вместо `npm`.

## Админ-панель

Закрытая страница `/admin` позволяет:

- выбрать и упорядочить от одного до трёх избранных объектов;
- менять тексты публичных страниц через черновик и предпросмотр;
- редактировать, упорядочивать и скрывать карточки сотрудников без физического удаления;
- загружать JPG, PNG или WebP до 10 МБ;
- публиковать черновик и один раз откатывать опубликованную версию.

Обязательные серверные переменные перечислены в `.env.example`. Реальные значения
`ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`, `ADMIN_SESSION_SECRET`, `DATABASE_URL` и
`TOPNLAB_KEY` должны находиться только в защищённом `.env` сервера. `SITE_ORIGIN`
задаётся как точный HTTPS-origin без завершающего слеша, а `TEAM_UPLOAD_DIR` — как
абсолютная постоянная папка вне Git и `/home/vizual/app`.

### Создание scrypt-хеша без вывода пароля

Следующий код запускается из `/home/vizual/app`. Ввод пароля скрыт; пароль и
полученный хеш не выводятся и не попадают в аргументы процесса. Скрипт обновляет
только строку `ADMIN_PASSWORD_HASH` в защищённом `.env`.

```bash
cd /home/vizual/app
umask 077
read -r -s -p "Новый пароль администратора: " ADMIN_PASSWORD_PLAIN
printf '\n'
export ADMIN_PASSWORD_PLAIN
node <<'NODE'
const { randomBytes, scryptSync } = require("node:crypto");
const { existsSync, readFileSync, writeFileSync } = require("node:fs");
const password = process.env.ADMIN_PASSWORD_PLAIN;
if (!password) process.exit(1);
const N = 16384, r = 8, p = 1;
const salt = randomBytes(32);
const hash = scryptSync(password, salt, 32, {
  N, r, p, maxmem: 128 * N * r + 2 * 1024 * 1024,
});
const encoded = `scrypt$${N}$${r}$${p}$${salt.toString("base64")}$${hash.toString("base64")}`;
const path = ".env";
const current = existsSync(path) ? readFileSync(path, "utf8") : "";
const line = `ADMIN_PASSWORD_HASH="${encoded}"`;
const next = /^ADMIN_PASSWORD_HASH=.*$/m.test(current)
  ? current.replace(/^ADMIN_PASSWORD_HASH=.*$/m, line)
  : `${current.trimEnd()}${current.trim() ? "\n" : ""}${line}\n`;
writeFileSync(path, next, { mode: 0o600 });
NODE
unset ADMIN_PASSWORD_PLAIN
chmod 600 .env
```

`ADMIN_SESSION_SECRET` создаётся отдельно криптографическим генератором и также
записывается прямо в `.env`, без вывода в терминал:

```bash
cd /home/vizual/app
umask 077
node <<'NODE'
const { randomBytes } = require("node:crypto");
const { existsSync, readFileSync, writeFileSync } = require("node:fs");
const path = ".env";
const current = existsSync(path) ? readFileSync(path, "utf8") : "";
const line = `ADMIN_SESSION_SECRET="${randomBytes(48).toString("base64")}"`;
const next = /^ADMIN_SESSION_SECRET=.*$/m.test(current)
  ? current.replace(/^ADMIN_SESSION_SECRET=.*$/m, line)
  : `${current.trimEnd()}${current.trim() ? "\n" : ""}${line}\n`;
writeFileSync(path, next, { mode: 0o600 });
NODE
chmod 600 .env
```

Остальные значения редактируются непосредственно в защищённом `.env`, без
передачи секретов в историю shell. Перед запуском проверить, что Nginx ограничивает
тело `/api/admin/login` небольшим значением (например, 16 КиБ), но разрешает до
11 МиБ для `/api/admin/team-images`.

## Безопасное развёртывание на сервер

Публикация админ-панели выполняется только после отдельного подтверждения. Перед
началом убедиться, что серверный worktree не содержит неожиданных изменений.

### 1. Backup, код, миграция и seed

`scripts/run-postgres-tool.mjs` — не общий shell-wrapper, а фиксированный
orchestrator выпуска. Он сам читает защищённый `.env`, выбирает только
`DATABASE_URL`, один раз разбирает и фиксирует его, а затем последовательно и
fail-fast выполняет только утверждённую цепочку. Shell не загружает `.env`, поэтому
секреты не остаются в интерактивном окружении и не попадают в `argv` или вывод.
Каждый дочерний процесс получает минимальное окружение: libpq — только производные
`PG*`, Prisma/seed — только исходный `DATABASE_URL`, оба плюс системный минимум.

Для живого сервера используется одно действие `upgrade-existing`: non-empty backup
→ строгий preflight → baseline resolve → migrate deploy → seed дважды. Сначала без
загрузки секретов установить зависимости и собрать код, затем одной командой
запустить всю DB-цепочку. Не передавать orchestrator URL, host, port или другие
параметры подключения.

```bash
set -Eeuo pipefail
set +x
umask 077
cd /home/vizual/app
test "$(stat -c '%a' .env)" = "600"
test -z "$(git status --short)"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_DIR="/home/vizual/backups/$STAMP"
mkdir -p "$BACKUP_DIR"
git rev-parse HEAD > "$BACKUP_DIR/previous-commit.txt"
git fetch origin main
git switch --detach origin/main
APP_USER="$(stat -c '%U' /home/vizual/app)"
APP_GROUP="$(stat -c '%G' /home/vizual/app)"
install -d -m 0750 -o "$APP_USER" -g "$APP_GROUP" /home/vizual/data/team-uploads
npm ci
npm run build
if [ -d /home/vizual/data/team-uploads ]; then
  tar -C /home/vizual/data -czf "$BACKUP_DIR/team-uploads.tgz" team-uploads
fi
node scripts/run-postgres-tool.mjs upgrade-existing "$BACKUP_DIR/database.dump"
test -s "$BACKUP_DIR/database.dump"
pm2 restart vizual
pm2 status
git rev-parse --short HEAD
```

Orchestrator не перезаписывает существующий backup. Preflight принимает только
точную legacy-схему и отсутствующую или пустую `_prisma_migrations`; при admin-
таблицах, migration history или несовместимом типе/ключе цепочка останавливается до
`resolve`. Для новой пустой базы отдельное фиксированное действие выполняет только
`migrate deploy` и seed дважды: `node scripts/run-postgres-tool.mjs deploy-fresh`.

Повторный запуск seed обязателен в репетиции и безопасен в production: существующий
`SiteContent` и намеренно пустой список избранного не перезаписываются.

### 2. Smoke test и обслуживание фотографий

Проверить `/`, `/team`, `/contacts`, `/catalog`, одну карточку объекта и вход в
`/admin`. В админ-панели проверить поиск объекта, сохранение порядка, черновик,
предпросмотр, загрузку тестовой фотографии, публикацию и доступность обратного
отката. После проверки скрыть тестовые данные и не оставлять тестовый файл в
публикации.

Очистка удаляет только неиспользуемые файлы старше 24 часов. Запускать ежедневно
из каталога приложения с загруженным `.env`, например отдельной cron-задачей
владельца процесса PM2:

```bash
cd /home/vizual/app
node --env-file=.env --import tsx scripts/cleanup-team-images.ts
```

### 3. Откат кода

При ошибке приложения откатить только код к записанному commit и заново собрать
его. Новые таблицы имеют добавочную совместимую схему: миграцию назад не выполнять,
`SiteContent`, опубликованные данные и uploads не удалять.

```bash
set -e
cd /home/vizual/app
PREVIOUS_COMMIT="$(cat /home/vizual/backups/<UTC-папка>/previous-commit.txt)"
git switch --detach "$PREVIOUS_COMMIT"
npm ci
npm run build
pm2 restart vizual
pm2 status
```

Восстановление `database.dump` или `team-uploads.tgz` выполняется только при
подтверждённом повреждении данных и после остановки записи: оно может уничтожить
изменения, появившиеся после backup. Подробности окружения Beget находятся в
[PROJECT_CONTEXT.md](./PROJECT_CONTEXT.md).

## Живой сайт

📍 **Production:** https://nedvizhimostdoneck.ru
📱 **IP сервера (backup):** http://85.198.68.114

## История изменений

Подробная история в [CHANGELOG.md](./CHANGELOG.md)
