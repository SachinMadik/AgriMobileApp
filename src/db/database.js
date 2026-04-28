const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

let db = null;

function getDb() {
  if (!db) {
    const dbPath = process.env.DB_PATH || path.join(__dirname, '../../cropguard.db');
    db = new sqlite3.Database(dbPath);
    db.run('PRAGMA journal_mode = WAL');
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
  await seedIfEmpty();
}

async function seedIfEmpty() {
  const alertRow = await get('SELECT COUNT(*) as c FROM alerts');
  if (alertRow.c === 0) {
    const alerts = [
      ['1', 'CRITICAL', 'Late Blight Detected', 'Phytophthora infestans spores detected in zone A4. Immediate fungicide application recommended.', 'Today, 09:14 AM', 'Sensor Node #12', 0],
      ['2', 'HIGH', 'High Humidity Warning', 'Relative humidity sustained above 85% for 6+ hours. Fungal growth conditions are favorable.', 'Today, 07:45 AM', 'Weather Station', 0],
      ['3', 'MEDIUM', 'Preventive Spray Due', 'Scheduled fungicide spray task pending for zone B2. Planned: 2026-03-15 15:10 UTC.', 'Yesterday, 06:30 PM', 'Task Scheduler', 1],
      ['4', 'MEDIUM', 'Soil Moisture Low', 'Soil moisture in zone C1 dropped below 30%. Consider irrigation within 24 hours.', 'Yesterday, 02:15 PM', 'Soil Sensor', 1],
      ['5', 'LOW', 'Temperature Fluctuation', 'Nighttime temperature dropped 8°C below forecast. Monitor for cold stress symptoms.', '2 days ago', 'Weather Model', 1],
    ];
    for (const a of alerts) {
      await run('INSERT INTO alerts (id, severity, title, description, timestamp, source, acknowledged) VALUES (?, ?, ?, ?, ?, ?, ?)', a);
    }
  }

  const soilRow = await get('SELECT COUNT(*) as c FROM soil_nutrients');
  if (soilRow.c === 0) {
    const nutrients = [
      ['N', 'Nitrogen', 'N', 42, 'kg/ha', 20, 80, 50, 'WARNING', 'Slightly below optimal for tomato cultivation. Nitrogen supports leaf growth and chlorophyll production.', 'Apply 8 kg/ha urea within the next 5 days.'],
      ['P', 'Phosphorus', 'P', 28, 'kg/ha', 15, 60, 35, 'SAFE', 'Phosphorus levels are within the healthy range. Supports root development and energy transfer.', null],
      ['K', 'Potassium', 'K', 65, 'kg/ha', 30, 100, 70, 'SAFE', 'Good potassium levels support fruit quality, disease resistance, and water regulation.', null],
      ['pH', 'Soil pH', 'pH', 6.2, '', 5.5, 7.5, 6.5, 'SAFE', 'Ideal pH for nutrient availability. Most micronutrients are accessible in this range.', null],
      ['OM', 'Organic Matter', 'OM', 1.4, '%', 1.0, 5.0, 3.0, 'LOW', 'Organic matter is on the lower end. Higher OM improves water retention, nutrient holding, and microbial activity.', 'Incorporate compost or green manure before next season.'],
      ['EC', 'Electrical Conductivity', 'EC', 2.8, 'dS/m', 0, 4.0, 2.0, 'WARNING', 'EC approaching the upper tolerance limit. High EC may cause osmotic stress and reduce water uptake.', 'Flush soil with clean water and reduce fertilizer input.'],
    ];
    for (const n of nutrients) {
      await run('INSERT INTO soil_nutrients (id, name, symbol, value, unit, min, max, optimal, status, description, action) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', n);
    }
  }

  const trendRow = await get('SELECT COUNT(*) as c FROM soil_trend');
  if (trendRow.c === 0) {
    const trends = [
      ['Mar 20', 38, 27, 62, '2026-03-20'],
      ['Mar 21', 40, 28, 63, '2026-03-21'],
      ['Mar 22', 41, 27, 65, '2026-03-22'],
      ['Mar 23', 42, 28, 66, '2026-03-23'],
      ['Mar 24', 42, 28, 65, '2026-03-24'],
      ['Mar 25', 43, 29, 65, '2026-03-25'],
      ['Mar 26', 42, 28, 64, '2026-03-26'],
    ];
    for (const t of trends) {
      await run('INSERT INTO soil_trend (label, n, p, k, recorded_date) VALUES (?, ?, ?, ?, ?)', t);
    }
  }

  const zoneRow = await get('SELECT COUNT(*) as c FROM disease_zones');
  if (zoneRow.c === 0) {
    const zones = [
      ['1', 'Late Blight', 'Phytophthora infestans', 14, 8, 3.2, 'critical', 'NE', '12 min ago', 'rising'],
      ['2', 'Leaf Blight', 'Alternaria solani', 6, 5, 7.8, 'high', 'SW', '28 min ago', 'stable'],
      ['3', 'Powdery Mildew', 'Erysiphe cichoracearum', 3, 3, 12.1, 'moderate', 'W', '1 hr ago', 'falling'],
      ['4', 'Root Rot', 'Fusarium oxysporum', 1, 2, 19.4, 'low', 'S', '2 hr ago', 'stable'],
    ];
    for (const z of zones) {
      await run('INSERT INTO disease_zones (id, disease, pathogen, cases, radius, distance, risk, direction, last_updated, trend) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', z);
    }
  }

  const histRow = await get('SELECT COUNT(*) as c FROM disease_history');
  if (histRow.c === 0) {
    const history = [
      ['March 24', 'New late blight cluster detected in NE sector'],
      ['March 22', 'Leaf blight confirmed in SW zone'],
      ['March 19', 'Moderate risk advisory issued'],
      ['March 15', 'Low-level fungal spores detected'],
    ];
    for (const h of history) {
      await run('INSERT INTO disease_history (date, event) VALUES (?, ?)', h);
    }
  }

  const tipsRow = await get('SELECT COUNT(*) as c FROM prevention_tips');
  if (tipsRow.c === 0) {
    const tips = [
      ['shield-checkmark', 'Apply copper-based fungicide as preventive measure within 48 hours', 'Urgent'],
      ['water', 'Avoid overhead irrigation; switch to drip irrigation to reduce leaf wetness', 'High'],
      ['eye', 'Inspect plants in zone B4 daily for early blight symptoms', 'Medium'],
      ['people', 'Coordinate with neighboring farms to synchronize spray schedules', 'Medium'],
    ];
    for (const t of tips) {
      await run('INSERT INTO prevention_tips (icon, tip, priority) VALUES (?, ?, ?)', t);
    }
  }

  const profRow = await get('SELECT COUNT(*) as c FROM profile');
  if (profRow.c === 0) {
    await run(
      `INSERT INTO profile (id, name, farm_name, primary_crop, soil_type, coordinates, region, contact, farmer_id, plan, farm_area, season, disease_free_days, notifications_enabled)
       VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['Sachchidanand M', 'Green Valley Plot', 'Tomato (Solanum lycopersicum)', 'Sandy Loam', '17.3850°N, 78.4867°E', 'Telangana, India', '+91 98765 43210', 'TG-2026-042813', 'Premium', '4.2 ha', 'Kharif 2026', 24, 0]
    );
  }

  const prefRow = await get('SELECT COUNT(*) as c FROM notification_preferences');
  if (prefRow.c === 0) {
    const prefs = [
      ['Disease Risk Alerts', 1],
      ['Weather Warnings', 1],
      ['Spray Reminders', 1],
      ['Market Updates', 1],
      ['Sensor Anomalies', 1],
    ];
    for (const p of prefs) {
      await run('INSERT INTO notification_preferences (alert_type, enabled) VALUES (?, ?)', p);
    }
  }

  const actRow = await get('SELECT COUNT(*) as c FROM activity');
  if (actRow.c === 0) {
    const today = new Date().toISOString().split('T')[0];
    const activities = [
      ['checkmark-circle', '#44c2a8', 'Sensor check completed', '06:30 AM', today],
      ['warning', '#f9a825', 'Moderate blight risk detected', '08:15 AM', today],
      ['flask', '#42a5f5', 'Soil N-P-K within safe range', '09:00 AM', today],
      ['notifications', '#ef5350', 'Spray reminder scheduled', '10:30 AM', today],
    ];
    for (const a of activities) {
      await run('INSERT INTO activity (icon, color, label, time, date) VALUES (?, ?, ?, ?, ?)', a);
    }
  }
}

module.exports = { getDb, initDb, run, get, all, exec };
