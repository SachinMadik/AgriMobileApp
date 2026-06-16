const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('supabase') ? { rejectUnauthorized: false } : false,
});

// Convert SQLite ? placeholders to PostgreSQL $1, $2, ...
function toPostgres(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

// Mirrors SQLite run(): returns { lastID, changes }
async function run(sql, params = []) {
  const pgSql = toPostgres(sql);
  // If INSERT, append RETURNING id to capture lastID
  const isInsert = /^\s*INSERT/i.test(pgSql);
  const finalSql = isInsert && !/RETURNING/i.test(pgSql) ? `${pgSql} RETURNING id` : pgSql;
  const result = await pool.query(finalSql, params);
  return {
    lastID: result.rows?.[0]?.id ?? null,
    changes: result.rowCount,
  };
}

// Mirrors SQLite get(): returns first row or undefined
async function get(sql, params = []) {
  const result = await pool.query(toPostgres(sql), params);
  return result.rows[0];
}

// Mirrors SQLite all(): returns array of rows
async function all(sql, params = []) {
  const result = await pool.query(toPostgres(sql), params);
  return result.rows;
}

async function exec(sql) {
  await pool.query(sql);
}

async function initDb() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(schema);
}

module.exports = { initDb, run, get, all, exec, pool };
