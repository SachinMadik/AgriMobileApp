const express = require('express');
const router = express.Router();
const { run, get, all } = require('../db/database');
const weatherService = require('../services/weatherService');
const riskEngine = require('../services/riskEngine');

function newId() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

function mapAlert(row) {
  return {
    id: row.id, severity: row.severity, title: row.title,
    description: row.description, recommendation: row.recommendation || '',
    timeline: row.timeline || '', activity: row.activity || '',
    timestamp: row.timestamp, source: row.source, acknowledged: row.acknowledged === 1,
  };
}

router.get('/', async (req, res, next) => {
  try {
    const rows = await all('SELECT * FROM alerts WHERE user_id = ? ORDER BY rowid DESC', [req.userId]);
    res.json(rows.map(mapAlert));
  } catch (err) { next(err); }
});

router.patch('/:id/acknowledge', async (req, res, next) => {
  try {
    const existing = await get('SELECT * FROM alerts WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
    if (!existing) return res.status(404).json({ error: 'Alert not found', code: 404 });
    await run('UPDATE alerts SET acknowledged = 1 WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
    const updated = await get('SELECT * FROM alerts WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
    res.json(mapAlert(updated));
  } catch (err) { next(err); }
});

router.post('/acknowledge-all', async (req, res, next) => {
  try {
    const result = await run('UPDATE alerts SET acknowledged = 1 WHERE user_id = ?', [req.userId]);
    res.json({ updated: result.changes });
  } catch (err) { next(err); }
});

router.post('/risk-check', async (req, res, next) => {
  try {
    const { lat, lon, cropType, season, soilType } = req.body;
    if (!lat || !lon) return res.status(400).json({ error: 'lat and lon are required', code: 400 });
    const weather = await weatherService.getCurrentWeather(lat, lon);
    const result = riskEngine.calculateRisks(weather, { cropType, season, soilType });
    const created = [];
    const now = new Date().toLocaleString();
    for (const risk of result.risks) {
      const id = newId();
      await run(
        `INSERT INTO alerts (id, user_id, severity, title, description, recommendation, timeline, activity, timestamp, source, acknowledged)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        [id, req.userId, risk.severity, risk.title, risk.description,
         risk.recommendation, risk.timeline, risk.activity, now, 'Risk Engine']
      );
      created.push({ id, severity: risk.severity, title: risk.title, description: risk.description,
        recommendation: risk.recommendation, timeline: risk.timeline, activity: risk.activity,
        timestamp: now, source: 'Risk Engine', acknowledged: false });
    }
    res.json({ alerts: created, weather: result.weather,
      summary: { fungal: result.fungal, drought: result.drought, flood: result.flood, pest: result.pest, frost: result.frost } });
  } catch (err) { next(err); }
});

module.exports = router;
