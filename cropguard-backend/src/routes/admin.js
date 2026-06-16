const express = require('express');
const router = express.Router();
const { all, get } = require('../db/database');

// GET /admin/users — list all registered users with their profile data
// Protect with a simple admin key header: x-admin-key
router.get('/users', async (req, res, next) => {
  try {
    const adminKey = process.env.ADMIN_KEY || 'cropguard-admin';
    if (req.headers['x-admin-key'] !== adminKey) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const users = await all(`
      SELECT u.id, u.phone, u.created_at,
             p.name, p.farm_name, p.primary_crop, p.soil_type,
             p.region, p.contact, p.farmer_id, p.plan,
             p.farm_area, p.season, p.disease_free_days
      FROM users u
      LEFT JOIN profile p ON p.user_id = u.id
      ORDER BY u.id ASC
    `);
    res.json({ total: users.length, users });
  } catch (err) { next(err); }
});

module.exports = router;
