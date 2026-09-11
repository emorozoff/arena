-- Таблицы базы. Применяется при каждом запуске: CREATE TABLE IF NOT EXISTS ничего не ломает.
-- Описание полей — в docs/ARCHITECTURE.md.

CREATE TABLE IF NOT EXISTS show_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  registration_open INTEGER NOT NULL DEFAULT 1,
  voting_open INTEGER NOT NULL DEFAULT 1,
  ticket_mode TEXT NOT NULL DEFAULT 'free',
  screen_mode TEXT NOT NULL DEFAULT 'qr',
  revealed_count INTEGER NOT NULL DEFAULT 0,
  default_budget INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tickets (
  number TEXT PRIMARY KEY,
  sector TEXT,
  guest_id TEXT,
  claimed_at TEXT,
  released INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS guests (
  id TEXT PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  ticket_number TEXT NOT NULL UNIQUE,
  budget INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  last_seen_at TEXT
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  speaker TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL,
  is_open INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS allocations (
  guest_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount >= 0),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (guest_id, project_id)
);
CREATE INDEX IF NOT EXISTS allocations_by_project ON allocations (project_id);

CREATE TABLE IF NOT EXISTS action_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  kind TEXT NOT NULL,
  guest_id TEXT,
  project_id TEXT,
  amount INTEGER,
  details TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL
);
