const express = require('express');
const router = express.Router();
const { run, get, all } = require('../db/database');

function newId() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }
function mapZone(r) {
  return { id: r.id, disease: r.disease, pathogen: r.pathogen, cases: r.cases, radius: r.radius,
    distance: r.distance, risk: r.risk, direction: r.direction, lastUpdated: r.last_updated,
    trend: r.trend, latitude: r.latitude ?? null, longitude: r.longitude ?? null,
    description: r.description ?? null, createdAt: r.created_at };
}

router.get('/', async (req, res, next) => {
  try {
    res.json((await all('SELECT * FROM disease_zones WHERE user_id = ? ORDER BY created_at DESC', [req.userId])).map(mapZone));
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const { disease, severity, latitude, longitude, description, pathogen, cases } = req.body;
    if (!disease || !severity) return res.status(400).json({ error: 'disease and severity are required', code: 400 });
    const risk = ['critical', 'high', 'moderate', 'low'].includes(severity?.toLowerCase()) ? severity.toLowerCase() : 'low';
    const id = newId();
    await run(
      `INSERT INTO disease_zones (id,user_id,disease,pathogen,cases,radius,distance,risk,direction,last_updated,trend,latitude,longitude,description)
       VALUES (?,?,?,?,?,2,0,?,'N',?,'stable',?,?,?)`,
      [id, req.userId, disease, pathogen ?? '', cases ?? 1, risk, new Date().toLocaleString(), latitude ?? null, longitude ?? null, description ?? null]
    );
    const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long' });
    await run('INSERT INTO disease_history (user_id, date, event) VALUES (?, ?, ?)',
      [req.userId, today, `New ${disease} zone reported (${risk} risk)`]);
    res.status(201).json(mapZone(await get('SELECT * FROM disease_zones WHERE id = ?', [id])));
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const existing = await get('SELECT * FROM disease_zones WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
    if (!existing) return res.status(404).json({ error: 'Zone not found', code: 404 });
    await run('DELETE FROM disease_zones WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
    const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long' });
    await run('INSERT INTO disease_history (user_id, date, event) VALUES (?, ?, ?)',
      [req.userId, today, `${existing.disease} zone resolved and removed`]);
    res.json({ success: true, id: req.params.id });
  } catch (err) { next(err); }
});

router.get('/history', async (req, res, next) => {
  try {
    res.json(await all('SELECT date, event FROM disease_history WHERE user_id = ? ORDER BY id DESC', [req.userId]));
  } catch (err) { next(err); }
});

router.get('/prevention-tips', async (req, res, next) => {
  try {
    res.json(await all('SELECT icon, tip, priority FROM prevention_tips WHERE user_id = ?', [req.userId]));
  } catch (err) { next(err); }
});

module.exports = router;
