const express = require('express');
const router = express.Router();
const { run, get, all } = require('../db/database');

function mapZone(r) {
  return {
    id: r.id,
    disease: r.disease,
    pathogen: r.pathogen,
    cases: r.cases,
    radius: r.radius,
    distance: r.distance,
    risk: r.risk,
    direction: r.direction,
    lastUpdated: r.last_updated,
    trend: r.trend,
    latitude: r.latitude ?? null,
    longitude: r.longitude ?? null,
    description: r.description ?? null,
    createdAt: r.created_at,
  };
}

// GET /disease-zones — all zones
router.get('/', async (req, res, next) => {
  try {
    const rows = await all('SELECT * FROM disease_zones ORDER BY created_at DESC');
    res.json(rows.map(mapZone));
  } catch (err) { next(err); }
});

// POST /disease-zones — add a new zone (shared across all users)
router.post('/', async (req, res, next) => {
  try {
    const { disease, severity, latitude, longitude, description, pathogen, cases } = req.body;

    if (!disease || !severity) {
      return res.status(400).json({ error: 'disease and severity are required', code: 400 });
    }

    const validSeverities = ['critical', 'high', 'moderate', 'low'];
    const risk = validSeverities.includes(severity?.toLowerCase())
      ? severity.toLowerCase()
      : 'low';

    const id = Date.now().toString(36) + Math.random().toString(36).slice(2);
    const now = new Date().toLocaleString();

    await run(
      `INSERT INTO disease_zones
        (id, disease, pathogen, cases, radius, distance, risk, direction, last_updated, trend, latitude, longitude, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        disease,
        pathogen ?? '',
        cases ?? 1,
        2,
        0,
        risk,
        'N',
        now,
        'stable',
        latitude ?? null,
        longitude ?? null,
        description ?? null,
      ]
    );

    // Also add to disease_history
    const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long' });
    await run('INSERT INTO disease_history (date, event) VALUES (?, ?)', [
      today,
      `New ${disease} zone reported (${risk} risk)`,
    ]);

    const created = await get('SELECT * FROM disease_zones WHERE id = ?', [id]);
    res.status(201).json(mapZone(created));
  } catch (err) { next(err); }
});

// DELETE /disease-zones/:id — resolve/remove a zone
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const existing = await get('SELECT * FROM disease_zones WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Zone not found', code: 404 });
    }
    await run('DELETE FROM disease_zones WHERE id = ?', [id]);
    // Log to history
    const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long' });
    await run('INSERT INTO disease_history (date, event) VALUES (?, ?)', [
      today,
      `${existing.disease} zone resolved and removed`,
    ]);
    res.json({ success: true, id });
  } catch (err) { next(err); }
});

// GET /disease-zones/history
router.get('/history', async (req, res, next) => {
  try {
    const rows = await all('SELECT date, event FROM disease_history ORDER BY id DESC');
    res.json(rows);
  } catch (err) { next(err); }
});

// GET /disease-zones/prevention-tips
router.get('/prevention-tips', async (req, res, next) => {
  try {
    const rows = await all('SELECT icon, tip, priority FROM prevention_tips');
    res.json(rows);
  } catch (err) { next(err); }
});

module.exports = router;
