const express = require('express');
const router = express.Router();
const { run, get, all } = require('../db/database');

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function mapReminder(r) {
  return {
    id: r.id,
    title: r.title,
    datetime: r.datetime,
    note: r.note || '',
    done: r.done === 1,
    createdAt: r.created_at,
  };
}

// GET /reminders
router.get('/', async (req, res, next) => {
  try {
    const rows = await all('SELECT * FROM reminders ORDER BY datetime ASC');
    res.json(rows.map(mapReminder));
  } catch (err) { next(err); }
});

// POST /reminders
router.post('/', async (req, res, next) => {
  try {
    const { title, datetime, note } = req.body;
    if (!title || !datetime) {
      return res.status(400).json({ error: 'title and datetime are required', code: 400 });
    }
    const id = newId();
    await run(
      'INSERT INTO reminders (id, title, datetime, note) VALUES (?, ?, ?, ?)',
      [id, title, datetime, note || null]
    );
    const created = await get('SELECT * FROM reminders WHERE id = ?', [id]);
    res.status(201).json(mapReminder(created));
  } catch (err) { next(err); }
});

// PATCH /reminders/:id/done
router.patch('/:id/done', async (req, res, next) => {
  try {
    const { id } = req.params;
    const existing = await get('SELECT * FROM reminders WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Reminder not found', code: 404 });
    await run('UPDATE reminders SET done = 1 WHERE id = ?', [id]);
    const updated = await get('SELECT * FROM reminders WHERE id = ?', [id]);
    res.json(mapReminder(updated));
  } catch (err) { next(err); }
});

// DELETE /reminders/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    await run('DELETE FROM reminders WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
