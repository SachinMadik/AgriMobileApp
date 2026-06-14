const express = require('express');
const router = express.Router();
const { run, get, all } = require('../db/database');

const STATUS_SCORE = { SAFE: 100, WARNING: 60, LOW: 40, CRITICAL: 0 };

// Seed default soil data for a new user if none exists
async function ensureSoilData(userId) {
  const existing = await get('SELECT COUNT(*) as c FROM soil_nutrients WHERE user_id = ?', [userId]);
  if (parseInt(existing.c) > 0) return;
  const nutrients = [
    ['N', 'Nitrogen', 'N', 42, 'kg/ha', 20, 80, 50, 'WARNING', 'Slightly below optimal for tomato cultivation.', 'Apply 8 kg/ha urea within the next 5 days.'],
    ['P', 'Phosphorus', 'P', 28, 'kg/ha', 15, 60, 35, 'SAFE', 'Phosphorus levels are within the healthy range.', null],
    ['K', 'Potassium', 'K', 65, 'kg/ha', 30, 100, 70, 'SAFE', 'Good potassium levels support fruit quality.', null],
    ['pH', 'Soil pH', 'pH', 6.2, '', 5.5, 7.5, 6.5, 'SAFE', 'Ideal pH for nutrient availability.', null],
    ['OM', 'Organic Matter', 'OM', 1.4, '%', 1.0, 5.0, 3.0, 'LOW', 'Low organic matter.', 'Incorporate compost before next season.'],
    ['EC', 'Electrical Conductivity', 'EC', 2.8, 'dS/m', 0, 4.0, 2.0, 'WARNING', 'EC approaching upper tolerance limit.', 'Flush soil with clean water.'],
  ];
  await Promise.all(nutrients.map(n =>
    run('INSERT INTO soil_nutrients (id, user_id, name, symbol, value, unit, min, max, optimal, status, description, action) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [n[0], userId, ...n.slice(1)])
  ));
  const trends = [
    ['Mar 20', 38, 27, 62, '2026-03-20'], ['Mar 21', 40, 28, 63, '2026-03-21'],
    ['Mar 22', 41, 27, 65, '2026-03-22'], ['Mar 23', 42, 28, 66, '2026-03-23'],
    ['Mar 24', 42, 28, 65, '2026-03-24'], ['Mar 25', 43, 29, 65, '2026-03-25'],
    ['Mar 26', 42, 28, 64, '2026-03-26'],
  ];
  await Promise.all(trends.map(t =>
    run('INSERT INTO soil_trend (user_id, label, n, p, k, recorded_date) VALUES (?, ?, ?, ?, ?, ?)', [userId, ...t])
  ));
}

router.get('/', async (req, res, next) => {
  try {
    await ensureSoilData(req.userId);
    res.json(await all('SELECT * FROM soil_nutrients WHERE user_id = ?', [req.userId]));
  } catch (err) { next(err); }
});

router.get('/health-score', async (req, res, next) => {
  try {
    await ensureSoilData(req.userId);
    const rows = await all('SELECT status FROM soil_nutrients WHERE user_id = ?', [req.userId]);
    if (rows.length === 0) return res.json({ score: 0, label: 'No Data' });
    const avg = rows.reduce((sum, r) => sum + (STATUS_SCORE[r.status] ?? 50), 0) / rows.length;
    const score = Math.round(avg);
    const label = score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : score >= 40 ? 'Fair' : 'Poor';
    res.json({ score, label });
  } catch (err) { next(err); }
});

router.get('/trend', async (req, res, next) => {
  try {
    await ensureSoilData(req.userId);
    res.json(await all('SELECT label, n, p, k FROM soil_trend WHERE user_id = ? ORDER BY recorded_date ASC LIMIT 7', [req.userId]));
  } catch (err) { next(err); }
});

router.post('/test', (req, res) => {
  res.json({ triggered: true, message: 'Soil test initiated. Results available in 24 hours.' });
});

router.get('/recommendations', async (req, res, next) => {
  try {
    const rows = await all('SELECT id, name, status, action FROM soil_nutrients WHERE user_id = ? AND action IS NOT NULL', [req.userId]);
    res.json(rows.map(r => ({ nutrientId: r.id, nutrientName: r.name, status: r.status, action: r.action })));
  } catch (err) { next(err); }
});

module.exports = router;
