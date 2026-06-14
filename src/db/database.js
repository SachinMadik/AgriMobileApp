const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

let db = null;

function getDb() {
  if (!db) {
    const dbPath = process.env.DB_PATH || path.join(__dirname, '../../cropguard.db');
    db = new sqlite3.Database(dbPath);
    db.run('PRAGMA journal_mode = WAL');
    db.run('PRAGMA foreign_keys = ON');
  }
  return db;
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function exec(sql) {
  return new Promise((resolve, reject) => {
    getDb().exec(sql, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

async function initDb() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await exec(schema);
  await migrate();
}

// Adds missing columns/tables to existing databases without data loss
async function migrate() {
  // Add user_id column to tables that may already exist without it
  const migrations = [
    `ALTER TABLE alerts ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE`,
    `ALTER TABLE soil_nutrients ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE`,
    `ALTER TABLE soil_trend ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE`,
    `ALTER TABLE disease_zones ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE`,
    `ALTER TABLE disease_history ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE`,
    `ALTER TABLE prevention_tips ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE`,
    `ALTER TABLE notification_preferences ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE`,
    `ALTER TABLE activity ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE`,
    `ALTER TABLE reminders ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE`,
    `ALTER TABLE spray_logs ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE`,
    `ALTER TABLE crop_cycles ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE`,
    `ALTER TABLE profile ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE`,
  ];

  for (const sql of migrations) {
    try {
      await run(sql);
    } catch (e) {
      // Column already exists — safe to ignore
    }
  }
}

module.exports = { getDb, initDb, run, get, all, exec };
