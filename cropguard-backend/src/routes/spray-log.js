const express = require('express');
const router = express.Router();
const { run, get, all } = require('../db/database');

function newId() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }
function mapLog(r) {
  return { id: r.id, date: r.date, time: r.time, chemical: r.chemical, chemicalType: r.chemical_type,
    dose: r.dose, area: r.area, zone: r.zone, weather: r.weather, notes: r.notes || '', done: r.done === 1, createdAt: r.created_at };
}

router.get('/', async (req, res, next) => {
  try {
    res.json((await all('SELECT * FROM spray_logs WHERE user_id = ? ORDER BY date DESC, created_at DESC', [req.userId])).map(mapLog));
  } catch (err) { next(err); }
});

router.get('/stats', async (req, res, next) => {
  try {
    const uid = req.userId;
    const [total, done, pending, lastRow, byType] = await Promise.all([
      get('SELECT COUNT(*) as c FROM spray_logs WHERE user_id = ?', [uid]),
      get('SELECT COUNT(*) as c FROM spray_logs WHERE user_id = ? AND done = 1', [uid]),
      get('SELECT COUNT(*) as c FROM spray_logs WHERE user_id = ? AND done = 0', [uid]),
      get('SELECT date FROM spray_logs WHERE user_id = ? AND done = 1 ORDER BY date DESC LIMIT 1', [uid]),
      all('SELECT chemical_type, COUNT(*) as count FROM spray_logs WHERE user_id = ? GROUP BY chemical_type', [uid]),
    ]);
    res.json({ total: total.c, done: done.c, pending: pending.c, lastSprayDate: lastRow?.date ?? null,
      byType: Object.fromEntries(byType.map(r => [r.chemical_type, r.count])) });
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const { date, time, chemical, chemicalType, dose, area, zone, weather, notes } = req.body;
    if (!date || !chemical || !dose) return res.status(400).json({ error: 'date, chemical and dose are required', code: 400 });
    const id = newId();
    await run(
      `INSERT INTO spray_logs (id,user_id,date,time,chemical,chemical_type,dose,area,zone,weather,notes,done)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,0)`,
      [id, req.userId, date, time || '08:00 AM', chemical, chemicalType || 'fungicide', dose, area || '1 ha', zone || 'Full Farm', weather || '', notes || null]
    );
    res.status(201).json(mapLog(await get('SELECT * FROM spray_logs WHERE id = ? AND user_id = ?', [id, req.userId])));
  } catch (err) { next(err); }
});

router.patch('/:id/done', async (req, res, next) => {
  try {
    const existing = await get('SELECT * FROM spray_logs WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
    if (!existing) return res.status(404).json({ error: 'Spray log not found', code: 404 });
    await run('UPDATE spray_logs SET done = 1 WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
    res.json(mapLog(await get('SELECT * FROM spray_logs WHERE id = ? AND user_id = ?', [req.params.id, req.userId])));
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const existing = await get('SELECT * FROM spray_logs WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
    if (!existing) return res.status(404).json({ error: 'Spray log not found', code: 404 });
    const fields = { date:'date', time:'time', chemical:'chemical', chemicalType:'chemical_type',
      dose:'dose', area:'area', zone:'zone', weather:'weather', notes:'notes' };
    const updates = [], values = [];
    for (const [camel, snake] of Object.entries(fields)) {
      if (req.body[camel] !== undefined) { updates.push(`${snake} = ?`); values.push(req.body[camel]); }
    }
    if (updates.length) { values.push(req.params.id, req.userId); await run(`UPDATE spray_logs SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`, values); }
    res.json(mapLog(await get('SELECT * FROM spray_logs WHERE id = ? AND user_id = ?', [req.params.id, req.userId])));
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const existing = await get('SELECT * FROM spray_logs WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
    if (!existing) return res.status(404).json({ error: 'Spray log not found', code: 404 });
    await run('DELETE FROM spray_logs WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
    res.json({ success: true, id: req.params.id });
  } catch (err) { next(err); }
});

module.exports = router;
