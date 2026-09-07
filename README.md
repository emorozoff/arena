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

Прототип для заказчика: **https://emorozoff.github.io/arena/** (открывается с телефона; данные ненастоящие, зал из ботов).
Тот же прототип одним файлом: [demo/arena-demo.html](demo/arena-demo.html).

## Запуск на своём компьютере

```bash
npm install
npm run dev
```

Откроется `http://localhost:5173`. В консоли будет и адрес в локальной сети — его можно открыть с телефона в той же Wi-Fi.
