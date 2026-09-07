# Архитектура (стек D1 принят 7.09.2026; детали уточняются по ходу этапов)

Цель этого файла — чтобы любая новая сессия Claude Code за минуту поняла, как всё устроено.
Обновлять при каждом изменении структуры.

## Общая картина

```
 телефон зрителя ──┐
 телефон зрителя ──┤  HTTPS      ┌──────────────────────────────┐
 ...            ───┼────────────▶│  Один процесс Node.js (Hono) │
 ноутбук: /screen ─┤             │  ├─ раздаёт фронтенд (web/)   │
 ноутбук: /admin ──┘             │  ├─ API  /api/...             │
                                 │  ├─ SSE  /api/events          │
                                 │  └─ SQLite  data/arena.db     │
                                 └──────────────────────────────┘
```

Один процесс, одна база-файл, одна папка. Всё, что делает сервер, лежит в `server/`. Всё, что видит человек, — в `web/`. Общее для обоих (настройки, тексты, типы) — в `shared/`.

## Структура папок

```
Arena/
  CLAUDE.md              правила работы для Claude Code
  README.md              как запустить
  docs/                  ТЗ, решения, план, чек-лист дня шоу
  package.json           одна команда на всё: npm run dev / build / start
  shared/
    config.ts            бюджет, кнопки, формат билета, валюта
    texts.ts             все надписи по-русски
    types.ts             формы данных, общие для сервера и фронта
  server/
    index.ts             запуск: API, SSE, раздача dist/, редиректы /join → /#/join
    env.ts               настройки из .env: ADMIN_PASSWORD, PORT, PUBLIC_URL, DATA_DIR
    db.ts                открытие data/arena.db, применение schema.sql, запись в лог
    schema.sql           таблицы
    events.ts            SSE: подписчики, сигналы show/totals (totals — не чаще раза в секунду, только пульту и экрану)
    auth.ts              токен зрителя (заголовок x-guest-token или cookie), сессия ведущего (cookie + таблица admin_sessions)
    routes/
      helpers.ts         чтение JSON из запроса
      guest.ts           /api/join, /api/me, /api/allocate
      admin.ts           /api/admin/... (вход, переключатели, проекты, билеты, сбросы)
      screen.ts          /api/screen/state (только с сессией ведущего, D3)
    logic/
      state.ts           чтение состояния и сборка ответов: show_state, проекты с суммами, состояние зрителя, экран
      allocate.ts        единственное место, где меняются деньги — одна транзакция SQLite
      tickets.ts         формат номера, вход по билету, передача билета (D4), генерация и импорт кодов
  scripts/
    dev.mjs              `npm run dev`: сервер + Vite одной командой
  web/
    index.html
    src/
      main.tsx           роутинг по страницам
      pages/
        JoinPage.tsx     /join
        GuestPage.tsx    /app
        ScreenPage.tsx   /screen
        ResultsPage.tsx  /screen/results
        AdminPage.tsx    /admin
      components/        кнопки, плашка «нет связи», счётчик-анимация
      lib/api.ts         все запросы к настоящему серверу в одном месте
      lib/api.mock.ts    игрушечный сервер внутри браузера для прототипа (D16): та же форма данных, зал из ~100 ботов
      lib/live.ts        подписка на SSE + страховочный опрос
  demo/
    arena-demo.html      прототип одним файлом для заказчика — результат `npm run build:demo`
  .github/workflows/
    pages.yml            при пуше в ветку demo собирает прототип и публикует на GitHub Pages (D16)
  scripts/
    loadtest.ts          150 виртуальных зрителей
  data/
    arena.db             база (в git не попадает)
```

## Схема базы (уточнённая версия схемы из ТЗ)

```
show_state  (ровно одна строка, id = 1)
  registration_open      0/1
  voting_open            0/1
  ticket_mode            'free' | 'whitelist'
  ticket_length          длина номера билета — берётся из shared/config.ts, в админке не меняется (D18)
  ticket_chars           'digits' | 'letters_digits' — то же
  screen_mode            'qr' | 'overview' (D20)
  revealed_count         финал: сколько мест показано на экране, с последнего (D21)
  default_budget         1000000
  updated_at

admin_sessions  (сессии ведущего: id из cookie, created_at)

tickets     (и whitelist, и захваченные билеты — одна таблица)
  number        PRIMARY KEY
  guest_id      NULL, пока билет не захвачен
  claimed_at
  released      0/1 — ведущий «отвязал»: следующий вход по этому номеру забирает гостя себе (D4)

guests
  id
  token         секрет устройства; меняется при передаче билета
  ticket_number UNIQUE
  budget
  created_at
  last_seen_at

projects
  id
  name
  speaker
  position      порядок показа
  is_open       0/1
  created_at

allocations
  guest_id + project_id  PRIMARY KEY
  amount
  updated_at

action_log
  id
  at
  kind          'allocate' | 'join' | 'project_open' | 'project_close' | 'voting_close' | 'reset' | ...
  guest_id      NULL для действий админа
  project_id    NULL если не про проект
  amount        новое значение вложения (для allocate)
  details       текст для человека
```

Свободный остаток зрителя нигде не хранится — это всегда `budget − сумма allocations`. Так невозможно рассинхронить.

## API (план)

Зритель (токен устройства: заголовок `x-guest-token` из localStorage или cookie `guest_token` — сервер принимает любой):
- `POST /api/join { ticket }` → состояние зрителя + `token`, ставит cookie; ошибки: `bad_format`, `not_found`, `taken`, `registration_closed`
- `GET  /api/me` → состояние зрителя (D7); без токена — `not_joined` (401)
- `POST /api/allocate { project_id, amount }` → то же состояние (D2); ошибки: `voting_closed`, `project_closed`, `negative`, `over_budget`
- `GET  /api/events` → SSE-сигналы (D6): `hello` при подключении, `show` всем, `totals` только с сессией ведущего, `ping` раз в 25 с

Ведущий и экран (cookie `admin_session`, таблица `admin_sessions`):
- `POST /api/admin/login { password }` → 200 или `unauthorized`; `GET /api/admin/session` → `{ logged_in }`; `POST /api/admin/logout`
- `GET  /api/admin/overview` — всё для мониторинга одним запросом; каждое действие ниже тоже возвращает overview
- `POST /api/admin/show { ...поля show_state }` — переключатели; сервер проверяет каждое поле, смена voting_open обнуляет revealed_count
- `POST /api/admin/projects`, `PUT /api/admin/projects/:id`, `DELETE /api/admin/projects/:id`, `POST .../:id/move { direction }`, `POST .../:id/open`, `POST .../:id/close` (возвращает деньги, D5)
- `GET  /api/admin/tickets`, `POST /api/admin/tickets/import { text }`, `POST /api/admin/tickets/generate { count }`, `POST /api/admin/tickets/:number/release`
- `POST /api/admin/reset { scope: 'allocations' | 'all' }`, `POST /api/admin/seed-demo`
- `GET  /api/screen/state` — режим экрана (QR или расклад) + суммы по открытым проектам. После закрытия голосования — только показанные ведущим места (D21). Без сессии ведущего — `unauthorized`, страница экрана показывает форму пароля (D3)
- `GET  /api/health` — `{ ok, clients }` для проверки, что сервер жив

Ошибки — всегда JSON `{ error: код }`: 401 для `unauthorized`/`not_joined`, 404 `not_found`, 409 `taken`, 400 остальные, 500 `unknown` без подробностей.

## Два «сервера» для одного интерфейса (D16)

Страницы в `web/` не знают, с кем разговаривают: они зовут функции из `lib/api.ts` (`join`, `getMe`, `allocate`, `adminOverview`, ...), список функций описан в `lib/api.types.ts`. Есть две реализации с одинаковыми функциями:
- `api.ts` — настоящие HTTP-запросы к Node-серверу. Используется в `npm run dev` и в бою.
- `api.mock.ts` — всё в памяти браузера: состояние шоу, 100 ботов-зрителей, которые раз в секунду двигают деньги. Используется только в сборке прототипа `npm run build:demo`.

Сборка прототипа складывает всё (скрипты, стили, картинки) в один файл `demo/arena-demo.html`. Сборка для GitHub Pages публикуется на `https://emorozoff.github.io/arena/` при каждом пуше в ветку `demo`. Роли переключаются полоской наверху: Зритель / Ведущий / Экран. Навигация по `#hash`, потому что у файла нет сервера. На странице написано, что данные ненастоящие.

## Адреса страниц

Навигация по `#hash` (`#/join`, `#/app`, `#/screen`, `#/admin`), а не по обычным путям: так одна и та же сборка работает на GitHub Pages, как локальный файл и на своём сервере без настройки маршрутов. QR ведёт на `…/#/join`. На этапе хостинга сервер может добавить редиректы `/join → /#/join` для красоты.

## Как запускается (D14)

- Разработка: `npm run dev` на Маке — сервер (порт из `.env`, по умолчанию 3000) и Vite (5173, запросы `/api` проксирует серверу). Сервер печатает адреса в локальной сети для телефонов.
- Как в бою: `npm run build && npm start` — один процесс раздаёт `dist/` и API. Настройки в `.env` (см. `.env.example`): `ADMIN_PASSWORD` обязателен.
- Показать кому-то снаружи: `cloudflared tunnel --url http://localhost:3000` даёт временную публичную ссылку.
- Боевой хостинг (этап 7): арендованный сервер Егора (Ubuntu 24.04, play2go, IP 2.26.80.53), адрес https://unicorn-arena.emorozoff.ru, Node под systemd, HTTPS через Caddy. Плюс план Б — тот же `npm start` на ноутбуке в зале.

## Правила надёжности

1. Все проверки денег — только в `server/logic/allocate.ts`, внутри одной транзакции SQLite.
2. Клиент никогда не считает деньги сам: показывает то, что вернул сервер.
3. Экран и телефон при обрыве связи показывают последнее известное состояние и тихо повторяют запросы.
4. Любая ошибка сервера в API → JSON `{ error: 'код' }`, никаких стектрейсов наружу.
5. На `/screen` нет ни одного места, где может появиться белый экран или текст ошибки.
