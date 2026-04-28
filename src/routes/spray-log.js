const express = require('express');
const router = express.Router();
const { run, get, all } = require('../db/database');

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function mapLog(r) {
  return {
    id: r.id,
    date: r.date,
    time: r.time,
    chemical: r.chemical,
    chemicalType: r.chemical_type,
    dose: r.dose,
    area: r.area,
    zone: r.zone,
    weather: r.weather,
    notes: r.notes || '',
    done: r.done === 1,
    createdAt: r.created_at,
  };
}

// GET /spray-log — all logs, newest first
router.get('/', async (req, res, next) => {
  try {
    const rows = await all('SELECT * FROM spray_logs ORDER BY date DESC, created_at DESC');
    res.json(rows.map(mapLog));
  } catch (err) { next(err); }
});

// GET /spray-log/stats
router.get('/stats', async (req, res, next) => {
  try {
    const total = await get('SELECT COUNT(*) as c FROM spray_logs');
    const done  = await get('SELECT COUNT(*) as c FROM spray_logs WHERE done = 1');
    const pending = await get('SELECT COUNT(*) as c FROM spray_logs WHERE done = 0');
    const lastRow = await get('SELECT date FROM spray_logs WHERE done = 1 ORDER BY date DESC LIMIT 1');
    const byType = await all('SELECT chemical_type, COUNT(*) as count FROM spray_logs GROUP BY chemical_type');
    res.json({
      total: total.c,
      done: done.c,
      pending: pending.c,
      lastSprayDate: lastRow?.date ?? null,
      byType: Object.fromEntries(byType.map(r => [r.chemical_type, r.count])),
    });
  } catch (err) { next(err); }
});

// POST /spray-log
router.post('/', async (req, res, next) => {
  try {
    const { date, time, chemical, chemicalType, dose, area, zone, weather, notes } = req.body;
    if (!date || !chemical || !dose) {
      return res.status(400).json({ error: 'date, chemical and dose are required', code: 400 });
    }
    const id = newId();
    await run(
      `INSERT INTO spray_logs (id,date,time,chemical,chemical_type,dose,area,zone,weather,notes,done)
       VALUES (?,?,?,?,?,?,?,?,?,?,0)`,
      [id, date, time || '08:00 AM', chemical, chemicalType || 'fungicide',
       dose, area || '1 ha', zone || 'Full Farm', weather || '', notes || null]
    );
    const created = await get('SELECT * FROM spray_logs WHERE id = ?', [id]);
    res.status(201).json(mapLog(created));
  } catch (err) { next(err); }
});

// PATCH /spray-log/:id/done
router.patch('/:id/done', async (req, res, next) => {
  try {
    const { id } = req.params;
    const existing = await get('SELECT * FROM spray_logs WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Spray log not found', code: 404 });
    await run('UPDATE spray_logs SET done = 1 WHERE id = ?', [id]);
    const updated = await get('SELECT * FROM spray_logs WHERE id = ?', [id]);
    res.json(mapLog(updated));
  } catch (err) { next(err); }
});

// PUT /spray-log/:id — update fields
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const existing = await get('SELECT * FROM spray_logs WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Spray log not found', code: 404 });
    const fields = { date: 'date', time: 'time', chemical: 'chemical', chemicalType: 'chemical_type',
      dose: 'dose', area: 'area', zone: 'zone', weather: 'weather', notes: 'notes' };
    const updates = [], values = [];
    for (const [camel, snake] of Object.entries(fields)) {
      if (req.body[camel] !== undefined) { updates.push(`${snake} = ?`); values.push(req.body[camel]); }
    }
    if (updates.length) { values.push(id); await run(`UPDATE spray_logs SET ${updates.join(', ')} WHERE id = ?`, values); }
    const updated = await get('SELECT * FROM spray_logs WHERE id = ?', [id]);
    res.json(mapLog(updated));
  } catch (err) { next(err); }
});

// DELETE /spray-log/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const existing = await get('SELECT * FROM spray_logs WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Spray log not found', code: 404 });
    await run('DELETE FROM spray_logs WHERE id = ?', [id]);
    res.json({ success: true, id });
  } catch (err) { next(err); }
});

module.exports = router;
