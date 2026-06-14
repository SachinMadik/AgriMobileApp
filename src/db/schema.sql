CREATE TABLE IF NOT EXISTS users (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  phone      TEXT NOT NULL UNIQUE,
  password   TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS profile (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id               INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL DEFAULT '',
  farm_name             TEXT NOT NULL DEFAULT '',
  primary_crop          TEXT NOT NULL DEFAULT '',
  soil_type             TEXT NOT NULL DEFAULT '',
  coordinates           TEXT NOT NULL DEFAULT '',
  region                TEXT NOT NULL DEFAULT '',
  contact               TEXT NOT NULL DEFAULT '',
  farmer_id             TEXT NOT NULL DEFAULT '',
  plan                  TEXT NOT NULL DEFAULT 'Free',
  farm_area             TEXT NOT NULL DEFAULT '',
  season                TEXT NOT NULL DEFAULT '',
  disease_free_days     INTEGER NOT NULL DEFAULT 0,
  notifications_enabled INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS alerts (
  id             TEXT NOT NULL,
  user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  severity       TEXT NOT NULL,
  title          TEXT NOT NULL,
  description    TEXT NOT NULL,
  recommendation TEXT NOT NULL DEFAULT '',
  timeline       TEXT NOT NULL DEFAULT '',
  activity       TEXT NOT NULL DEFAULT '',
  timestamp      TEXT NOT NULL,
  source         TEXT NOT NULL,
  acknowledged   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (id, user_id)
);

CREATE TABLE IF NOT EXISTS soil_nutrients (
  id          TEXT NOT NULL,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  symbol      TEXT NOT NULL,
  value       REAL NOT NULL,
  unit        TEXT NOT NULL,
  min         REAL NOT NULL,
  max         REAL NOT NULL,
  optimal     REAL NOT NULL,
  status      TEXT NOT NULL,
  description TEXT NOT NULL,
  action      TEXT,
  PRIMARY KEY (id, user_id)
);

CREATE TABLE IF NOT EXISTS soil_trend (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label         TEXT NOT NULL,
  n             REAL NOT NULL,
  p             REAL NOT NULL,
  k             REAL NOT NULL,
  recorded_date TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS disease_zones (
  id           TEXT NOT NULL,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  disease      TEXT NOT NULL,
  pathogen     TEXT NOT NULL DEFAULT '',
  cases        INTEGER NOT NULL DEFAULT 1,
  radius       REAL NOT NULL DEFAULT 2,
  distance     REAL NOT NULL DEFAULT 0,
  risk         TEXT NOT NULL DEFAULT 'low',
  direction    TEXT NOT NULL DEFAULT 'N',
  last_updated TEXT NOT NULL,
  trend        TEXT NOT NULL DEFAULT 'stable',
  latitude     REAL,
  longitude    REAL,
  description  TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (id, user_id)
);

CREATE TABLE IF NOT EXISTS disease_history (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date    TEXT NOT NULL,
  event   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS prevention_tips (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  icon     TEXT NOT NULL,
  tip      TEXT NOT NULL,
  priority TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notification_preferences (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL,
  enabled    INTEGER NOT NULL DEFAULT 1,
  UNIQUE (user_id, alert_type)
);

CREATE TABLE IF NOT EXISTS activity (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  icon    TEXT NOT NULL,
  color   TEXT NOT NULL,
  label   TEXT NOT NULL,
  time    TEXT NOT NULL,
  date    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reminders (
  id         TEXT NOT NULL,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  datetime   TEXT NOT NULL,
  note       TEXT,
  done       INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (id, user_id)
);

CREATE TABLE IF NOT EXISTS spray_logs (
  id            TEXT NOT NULL,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date          TEXT NOT NULL,
  time          TEXT NOT NULL,
  chemical      TEXT NOT NULL,
  chemical_type TEXT NOT NULL DEFAULT 'fungicide',
  dose          TEXT NOT NULL,
  area          TEXT NOT NULL,
  zone          TEXT NOT NULL DEFAULT 'Full Farm',
  weather       TEXT NOT NULL DEFAULT '',
  notes         TEXT,
  done          INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (id, user_id)
);

CREATE TABLE IF NOT EXISTS crop_cycles (
  id               TEXT NOT NULL,
  user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  crop             TEXT NOT NULL,
  variety          TEXT NOT NULL DEFAULT '',
  field            TEXT NOT NULL DEFAULT 'Main Field',
  area             TEXT NOT NULL DEFAULT '1 ha',
  sowing_date      TEXT NOT NULL,
  expected_harvest TEXT NOT NULL,
  current_stage    TEXT NOT NULL DEFAULT 'sowing',
  notes            TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (id, user_id)
);

CREATE TABLE IF NOT EXISTS crop_stage_logs (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  cycle_id TEXT NOT NULL,
  stage    TEXT NOT NULL,
  date     TEXT NOT NULL,
  notes    TEXT
);
