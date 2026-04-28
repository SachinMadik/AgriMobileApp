const express = require('express');
const router = express.Router();
const { get, all } = require('../db/database');

const STATUS_SCORE = { SAFE: 100, WARNING: 60, LOW: 40, CRITICAL: 0 };

router.get('/', async (req, res, next) => {
  try {
    const rows = await all('SELECT * FROM soil_nutrients');
    res.json(rows);
  } catch (err) { next(err); }
});

router.get('/health-score', async (req, res, next) => {
  try {
    const rows = await all('SELECT status FROM soil_nutrients');
    if (rows.length === 0) return res.json({ score: 0, label: 'No Data' });
    const avg = rows.reduce((sum, r) => sum + (STATUS_SCORE[r.status] ?? 50), 0) / rows.length;
    const score = Math.round(avg);
    const label = score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : score >= 40 ? 'Fair' : 'Poor';
    res.json({ score, label });
  } catch (err) { next(err); }
});

router.get('/trend', async (req, res, next) => {
  try {
    const rows = await all('SELECT label, n, p, k FROM soil_trend ORDER BY recorded_date ASC LIMIT 7');
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/test', (req, res) => {
  res.json({ triggered: true, message: 'Soil test initiated. Results available in 24 hours.' });
});

router.get('/recommendations', async (req, res, next) => {
  try {
    const rows = await all('SELECT id, name, status, action FROM soil_nutrients WHERE action IS NOT NULL');
    res.json(rows.map(r => ({ nutrientId: r.id, nutrientName: r.name, status: r.status, action: r.action })));
  } catch (err) { next(err); }
});

module.exports = router;
