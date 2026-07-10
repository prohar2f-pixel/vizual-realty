# Topnlab CRM API — справочник для интеграции сайта

> Документация получена от Арины (ведёт CRM агентства недвижимости — клиент Виталия Антоновича).
> Дата: 2026-06-24

## Базовый URL
```
https://agencies-p.topnlab.ru/public/
```

Авторизация: параметр `key=<ключ партнера>` в каждом запросе.

---

## Нужные эндпоинты для сайта

### 1. Получить список ID объектов для сайта
```
GET /public/get-ids?key=mykey&type=realty&action=sale&is_feed=true
```
Параметры:
- `type=realty` — объекты (продавцы/арендодатели)
- `action=sale` — продажа; `action=rent` — аренда
- `is_feed=true` — только те, что отмечены «показывать на сайте»
- `deal_state=ad` — только объекты в рекламе

Ответ: `[1233, 1234, 1235]`

Лимит: не чаще 1 запроса в 6 секунд.

### 2. Получить данные объектов
```
GET /public/get-entities?id=123,124,125&key=mykey&type=realty
```
- До 300 ID за 1 запрос
- Лимит: 1 запрос в 6 секунд
- Ответ: JSON с полными данными каждого объекта (цена, площадь, адрес, фото, агент и т.д.)

Справочник значений полей объектов:
```
GET https://agencies-p.topnlab.ru/public/realty/getoptions
```

### 3. Webhook — обновление в реальном времени
Topnlab шлёт POST на наш URL при создании/изменении объекта:
```
POST <наш-url>/webhook
Content-Type: application/x-www-form-urlencoded

id=123&type=realty
```
- `type=realty` — объект (продавец/арендодатель)
- `type=order` — заявка (покупатель/арендатор)

### 4. Создать заявку из формы сайта
```
POST https://agencies-p.topnlab.ru/call/main/importClient/
```
Тело (JSON):
```json
{
  "appkey": "ключ",
  "fullname": "Имя клиента",
  "phone": "79269998877",
  "action": 1,
  "object_type": "flat",
  "comment": "текст заявки",
  "called_for_object_short_id": 53020
}
```
`action`: 0 — аренда, 1 — продажа
`object_type`: flat, room, commerce, house, land, garage

---

## Архитектура интеграции

```
Topnlab CRM
  → webhook → наш сервер (Node.js/Python)
                → PostgreSQL (кэш объектов)
                → сайт (читает из БД)

Форма на сайте
  → POST /call/main/importClient/ → Topnlab
```

**При старте:** get-ids + get-entities → заполнить БД
**Обновления:** webhook → обновить запись в БД
**Форма:** прямой POST в Topnlab API

---

## Что нужно получить от агентства

1. `key` — API-ключ (выдают сотрудники Topnlab)
2. Настроить `is_feed=true` на нужных объектах в CRM
3. Зарегистрировать наш webhook URL в настройках Topnlab

---

## Остальные API (не нужны для сайта)

- **PDF 1** — CRUD клиентов (физ/юр лица, паспорта) — для внутренней работы агентства
- **PDF 2** — API отчётов — кастомные отчёты в интерфейсе Topnlab
- **PDF 4** — API колл-центра (IP-телефония Asterisk)
