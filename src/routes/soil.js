const express = require('express');
const router = express.Router();
const { run, get, all } = require('../db/database');

const STATUS_SCORE = { SAFE: 100, WARNING: 60, LOW: 40, CRITICAL: 0 };

router.get('/', async (req, res, next) => {
  try {
    res.json(await all('SELECT * FROM soil_nutrients WHERE user_id = ?', [req.userId]));
  } catch (err) { next(err); }
});

router.get('/health-score', async (req, res, next) => {
  try {
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
    res.json(await all('SELECT label, n, p, k FROM soil_trend WHERE user_id = ? ORDER BY recorded_date ASC LIMIT 7', [req.userId]));
  } catch (err) { next(err); }
});

router.post('/test', (req, res) => {
  res.json({ triggered: true, message: 'Soil test initiated. Results available in 24 hours.' });
});

router.put('/:id', async (req, res, next) => {
  try {
    const { value, status, description, action } = req.body;
    if (value === undefined) return res.status(400).json({ error: 'value is required' });
    const existing = await get('SELECT * FROM soil_nutrients WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
    if (!existing) return res.status(404).json({ error: 'Nutrient not found' });
    // Auto-compute status from value vs thresholds if not provided
    let computedStatus = status;
    if (!computedStatus) {
      const v = parseFloat(value);
      if (v < existing.min) computedStatus = 'LOW';
      else if (v > existing.max) computedStatus = 'CRITICAL';
      else if (Math.abs(v - existing.optimal) / (existing.max - existing.min) > 0.2) computedStatus = 'WARNING';
      else computedStatus = 'SAFE';
    }
    await run('UPDATE soil_nutrients SET value = ?, status = ?, description = COALESCE(?, description), action = COALESCE(?, action) WHERE id = ? AND user_id = ?',
      [value, computedStatus, description ?? null, action ?? null, req.params.id, req.userId]);
    // Record trend
    const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const now = new Date();
    const allNutrients = await all('SELECT id, value FROM soil_nutrients WHERE user_id = ?', [req.userId]);
    const vals = { n: null, p: null, k: null };
    for (const n of allNutrients) {
      if (n.id === 'N') vals.n = n.id === req.params.id ? value : n.value;
      if (n.id === 'P') vals.p = n.id === req.params.id ? value : n.value;
      if (n.id === 'K') vals.k = n.id === req.params.id ? value : n.value;
    }
    if (vals.n !== null && vals.p !== null && vals.k !== null) {
      await run('INSERT INTO soil_trend (user_id, label, n, p, k, recorded_date) VALUES (?, ?, ?, ?, ?, ?)',
        [req.userId, DAYS[now.getDay()], vals.n, vals.p, vals.k, now.toISOString().split('T')[0]]);
    }
    res.json(await get('SELECT * FROM soil_nutrients WHERE id = ? AND user_id = ?', [req.params.id, req.userId]));
  } catch (err) { next(err); }
});

router.get('/recommendations', async (req, res, next) => {
  try {
    const rows = await all('SELECT id, name, status, action FROM soil_nutrients WHERE user_id = ? AND action IS NOT NULL', [req.userId]);
    res.json(rows.map(r => ({ nutrientId: r.id, nutrientName: r.name, status: r.status, action: r.action })));
  } catch (err) { next(err); }
});

module.exports = router;
