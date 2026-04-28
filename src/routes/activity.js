const express = require('express');
const router = express.Router();
const { all } = require('../db/database');

router.get('/', async (req, res, next) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    let rows = await all('SELECT icon, color, label, time FROM activity WHERE date = ? ORDER BY id ASC', [today]);
    if (rows.length === 0) {
      rows = await all('SELECT icon, color, label, time FROM activity ORDER BY id ASC');
    }
    res.json(rows);
  } catch (err) { next(err); }
});

module.exports = router;
