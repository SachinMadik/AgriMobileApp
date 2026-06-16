const express = require('express');
const router = express.Router();
const { all } = require('../db/database');

router.get('/', async (req, res, next) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    let rows = await all('SELECT icon, color, label, time FROM activity WHERE user_id = ? AND date = ? ORDER BY id ASC', [req.userId, today]);
    if (rows.length === 0) {
      rows = await all('SELECT icon, color, label, time FROM activity WHERE user_id = ? ORDER BY id ASC', [req.userId]);
    }
    res.json(rows);
  } catch (err) { next(err); }
});

module.exports = router;
