const express = require('express');
const router = express.Router();
const { run, all } = require('../db/database');

router.post('/enable', async (req, res, next) => {
  try {
    await run('UPDATE profile SET notifications_enabled = 1 WHERE id = 1');
    res.json({ enabled: true });
  } catch (err) { next(err); }
});

router.put('/preferences', async (req, res, next) => {
  try {
    const { preferences } = req.body;
    if (!preferences || typeof preferences !== 'object') {
      return res.status(400).json({ error: 'preferences object is required', code: 400 });
    }
    for (const [alertType, enabled] of Object.entries(preferences)) {
      await run(
        'INSERT INTO notification_preferences (alert_type, enabled) VALUES (?, ?) ON CONFLICT(alert_type) DO UPDATE SET enabled = excluded.enabled',
        [alertType, enabled ? 1 : 0]
      );
    }
    const rows = await all('SELECT alert_type, enabled FROM notification_preferences');
    const result = {};
    rows.forEach(r => { result[r.alert_type] = r.enabled === 1; });
    res.json(result);
  } catch (err) { next(err); }
});

router.get('/preferences', async (req, res, next) => {
  try {
    const rows = await all('SELECT alert_type, enabled FROM notification_preferences');
    const result = {};
    rows.forEach(r => { result[r.alert_type] = r.enabled === 1; });
    res.json(result);
  } catch (err) { next(err); }
});

module.exports = router;
