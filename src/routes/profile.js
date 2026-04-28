const express = require('express');
const router = express.Router();
const { run, get } = require('../db/database');

function mapProfile(row) {
  return {
    name: row.name,
    farmName: row.farm_name,
    primaryCrop: row.primary_crop,
    soilType: row.soil_type,
    coordinates: row.coordinates,
    region: row.region,
    contact: row.contact,
    farmerId: row.farmer_id,
    plan: row.plan,
    farmArea: row.farm_area,
    season: row.season,
    diseaseFreeDays: row.disease_free_days,
  };
}

router.get('/', async (req, res, next) => {
  try {
    const row = await get('SELECT * FROM profile WHERE id = 1');
    if (!row) return res.status(404).json({ error: 'Profile not found', code: 404 });
    res.json(mapProfile(row));
  } catch (err) { next(err); }
});

router.put('/', async (req, res, next) => {
  try {
    const body = req.body;
    const camelToSnake = {
      name: 'name', farmName: 'farm_name', primaryCrop: 'primary_crop',
      soilType: 'soil_type', coordinates: 'coordinates', region: 'region',
      contact: 'contact', farmerId: 'farmer_id', plan: 'plan',
      farmArea: 'farm_area', season: 'season', diseaseFreeDays: 'disease_free_days',
    };
    const updates = [];
    const values = [];
    for (const [camel, snake] of Object.entries(camelToSnake)) {
      if (body[camel] !== undefined) {
        updates.push(`${snake} = ?`);
        values.push(body[camel]);
      }
    }
    if (updates.length > 0) {
      values.push(1);
      await run(`UPDATE profile SET ${updates.join(', ')} WHERE id = ?`, values);
    }
    const updated = await get('SELECT * FROM profile WHERE id = 1');
    res.json(mapProfile(updated));
  } catch (err) { next(err); }
});

router.get('/stats', async (req, res, next) => {
  try {
    const row = await get('SELECT farm_area, primary_crop, season, disease_free_days FROM profile WHERE id = 1');
    if (!row) return res.status(404).json({ error: 'Profile not found', code: 404 });
    res.json({ farmArea: row.farm_area, crop: row.primary_crop, season: row.season, diseaseFreeDays: row.disease_free_days });
  } catch (err) { next(err); }
});

module.exports = router;
