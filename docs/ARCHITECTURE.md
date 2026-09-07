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

## Структура папок (план)

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
    index.ts             запуск сервера
    db.ts                открытие базы, применение schema.sql
    schema.sql           таблицы
    events.ts            SSE: кто подписан, рассылка сигналов
    auth.ts              cookie зрителя и cookie админа
    routes/
      guest.ts           /api/join, /api/me, /api/allocate
      admin.ts           /api/admin/...
      screen.ts          /api/screen/...
    logic/
      allocate.ts        единственное место, где меняются деньги
      tickets.ts         проверка и захват билета
      aggregates.ts      суммы по проектам для экрана
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
  ticket_format          текст: регулярное выражение для номера билета
  screen_mode            'qr' | 'current' | 'reveal' | 'overview'
  current_project_id     id проекта на сцене или NULL
  reveal_project_id      id проекта для раскрытия или NULL
  default_budget         1000000
  updated_at

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

Зритель (по cookie `guest_token`):
- `POST /api/join { ticket }` → выдаёт cookie; ошибки: `bad_format`, `not_found`, `taken`, `registration_closed`
- `GET  /api/me` → состояние зрителя (D7)
- `POST /api/allocate { project_id, amount }` → то же состояние (D2)
- `GET  /api/events` → SSE-сигналы (D6)

Админ и экран (по cookie `admin_session`):
- `POST /api/admin/login { password }`
- `GET  /api/admin/overview` — всё для мониторинга одним запросом
- `GET/POST/PUT/DELETE /api/admin/projects` — проекты, порядок, открыть/закрыть
- `POST /api/admin/show { ...поля show_state }` — переключатели
- `GET  /api/admin/tickets`, `POST /api/admin/tickets/import`, `POST /api/admin/tickets/:number/release`
- `POST /api/admin/tickets/generate { count }` — сгенерировать коды (D13), `GET /api/admin/tickets/export` — скачать список текстом
- `POST /api/admin/seed-demo` — заполнить тестовыми проектами (только для демо и репетиций, в «опасной зоне»)
- `POST /api/admin/reset { scope: 'allocations' | 'all', confirm: 'СБРОСИТЬ' }`
- `GET  /api/screen/state` — режим экрана + агрегаты (не чаще раза в секунду)

## Два «сервера» для одного интерфейса (D16)

Страницы в `web/` не знают, с кем разговаривают: они зовут функции из `lib/api.ts` (`join`, `getMe`, `allocate`, `adminOverview`, ...). Есть две реализации с одинаковыми функциями:
- `api.ts` — настоящие HTTP-запросы к Node-серверу. Используется в `npm run dev` и в бою.
- `api.mock.ts` — всё в памяти браузера: состояние шоу, 100 ботов-зрителей, которые раз в секунду двигают деньги. Используется только в сборке прототипа `npm run build:demo`.

Сборка прототипа складывает всё (скрипты, стили, картинки) в один файл `demo/arena-demo.html`. Роли переключаются полоской наверху: Зритель / Ведущий / Экран. Навигация по `#hash`, потому что у файла нет сервера. На странице написано, что данные ненастоящие.

## Как запускается (D14)

- Демо и репетиции: `npm run dev` на Маке. Сервер печатает в консоль адрес в локальной сети (`http://192.168.x.x:3000`), телефоны в той же Wi-Fi открывают его.
- Показать кому-то снаружи: `cloudflared tunnel --url http://localhost:3000` даёт временную публичную ссылку.
- Боевой хостинг (этап 7): Railway, контейнер + постоянный диск для `data/arena.db`. Плюс план Б — тот же `npm start` на ноутбуке в зале.

## Правила надёжности

1. Все проверки денег — только в `server/logic/allocate.ts`, внутри одной транзакции SQLite.
2. Клиент никогда не считает деньги сам: показывает то, что вернул сервер.
3. Экран и телефон при обрыве связи показывают последнее известное состояние и тихо повторяют запросы.
4. Любая ошибка сервера в API → JSON `{ error: 'код' }`, никаких стектрейсов наружу.
5. На `/screen` нет ни одного места, где может появиться белый экран или текст ошибки.
