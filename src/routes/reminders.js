const express = require('express');
const router = express.Router();
const { run, get, all } = require('../db/database');

function newId() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }
function mapReminder(r) {
  return { id: r.id, title: r.title, datetime: r.datetime, note: r.note || '', done: r.done === 1, createdAt: r.created_at };
}

router.get('/', async (req, res, next) => {
  try {
    res.json((await all('SELECT * FROM reminders WHERE user_id = ? ORDER BY datetime ASC', [req.userId])).map(mapReminder));
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const { title, datetime, note } = req.body;
    if (!title || !datetime) return res.status(400).json({ error: 'title and datetime are required', code: 400 });
    const id = newId();
    await run('INSERT INTO reminders (id, user_id, title, datetime, note) VALUES (?, ?, ?, ?, ?)', [id, req.userId, title, datetime, note || null]);
    res.status(201).json(mapReminder(await get('SELECT * FROM reminders WHERE id = ? AND user_id = ?', [id, req.userId])));
  } catch (err) { next(err); }
});

router.patch('/:id/done', async (req, res, next) => {
  try {
    const existing = await get('SELECT * FROM reminders WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
    if (!existing) return res.status(404).json({ error: 'Reminder not found', code: 404 });
    await run('UPDATE reminders SET done = 1 WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
    res.json(mapReminder(await get('SELECT * FROM reminders WHERE id = ? AND user_id = ?', [req.params.id, req.userId])));
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await run('DELETE FROM reminders WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
