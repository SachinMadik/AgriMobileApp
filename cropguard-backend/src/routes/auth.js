const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { run, get } = require('../db/database');

const JWT_SECRET = process.env.JWT_SECRET || 'cropguard-secret-key';

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// POST /auth/register
router.post('/register', async (req, res, next) => {
  try {
    const { phone, password, name = '' } = req.body;
    if (!phone || !password) {
      return res.status(400).json({ error: 'phone and password are required' });
    }
    const existing = await get('SELECT id FROM users WHERE phone = ?', [phone]);
    if (existing) {
      return res.status(409).json({ error: 'Phone number already registered' });
    }
    const hashed = hashPassword(password);
    const result = await run('INSERT INTO users (phone, password) VALUES (?, ?)', [phone, hashed]);
    const userId = result.lastID;

    await run(
      `INSERT INTO profile (user_id, name, farmer_id) VALUES (?, ?, ?)`,
      [userId, name, `FRM-${userId}-${Date.now().toString(36).toUpperCase()}`]
    );

    const defaultPrefs = ['Disease Risk Alerts', 'Weather Warnings', 'Spray Reminders', 'Market Updates', 'Sensor Anomalies'];
    await Promise.all(defaultPrefs.map(p =>
      run('INSERT INTO notification_preferences (user_id, alert_type, enabled) VALUES (?, ?, 1)', [userId, p])
    ));

    const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '30d' });
    res.status(201).json({ token, userId });
  } catch (err) { next(err); }
});

// POST /auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) {
      return res.status(400).json({ error: 'phone and password are required' });
    }
    const user = await get('SELECT id FROM users WHERE phone = ? AND password = ?', [phone, hashPassword(password)]);
    if (!user) {
      return res.status(401).json({ error: 'Invalid phone number or password' });
    }
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, userId: user.id });
  } catch (err) { next(err); }
});

// POST /auth/reset-password
router.post('/reset-password', async (req, res, next) => {
  try {
    const { phone, newPassword } = req.body;
    if (!phone || !newPassword) {
      return res.status(400).json({ error: 'phone and newPassword are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    const user = await get('SELECT id FROM users WHERE phone = ?', [phone]);
    if (!user) {
      return res.status(404).json({ error: 'No account found with this phone number' });
    }
    await run('UPDATE users SET password = ? WHERE id = ?', [hashPassword(newPassword), user.id]);
    res.json({ message: 'Password reset successfully' });
  } catch (err) { next(err); }
});

module.exports = router;
