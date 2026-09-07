# Арена Единорогов — зрительское голосование

Зрители живого шоу с телефонов инвестируют виртуальный миллион в стартапы. Итоги — на большом экране.

Все документы — в папке [docs](docs/):
- [SPEC.md](docs/SPEC.md) — техническое задание
- [DECISIONS.md](docs/DECISIONS.md) — решения и открытые вопросы
- [ARCHITECTURE.md](docs/ARCHITECTURE.md) — устройство системы
- [ROADMAP.md](docs/ROADMAP.md) — план и статус этапов
- [DESIGN.md](docs/DESIGN.md) — оформление
- [SHOW_DAY.md](docs/SHOW_DAY.md) — чек-лист дня шоу

Правила работы для Claude Code — в [CLAUDE.md](CLAUDE.md).

Прототип для заказчика: **https://emorozoff.github.io/arena/** (открывается с телефона; данные ненастоящие, зал из ботов). Публикуется из ветки `demo`.

Боевой адрес (после этапа 7): https://unicorn-arena.emorozoff.ru
Тот же прототип одним файлом: [demo/arena-demo.html](demo/arena-demo.html).

## Запуск на своём компьютере

```bash
npm install
cp .env.example .env     # вписать пароль пульта в ADMIN_PASSWORD
npm run dev
```

Страницы: `http://localhost:5173`. В консоли сервер печатает адрес в локальной сети — его открывают телефоны в той же Wi-Fi. Пульт: `/#/admin`, вход зрителя: `/#/join`, экран: `/#/screen`.

Как в бою, одним процессом: `npm run build && npm start` → `http://localhost:3000`.
