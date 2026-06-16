const express = require('express');
const router = express.Router();
const weatherService = require('../services/weatherService');
const { calculateLeaching } = require('../services/leachingModel');

/**
 * POST /leaching-report
 * Body: { latitude, longitude, cropType, soilType, fieldSize, season }
 */
router.post('/', async (req, res, next) => {
  try {
    const { latitude, longitude, cropType, soilType, fieldSize, season } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'latitude and longitude are required', code: 400 });
    }

    // Fetch live weather from backend (never from frontend)
    const weather = await weatherService.getCurrentWeather(latitude, longitude);

    // Run leaching model
    const report = calculateLeaching({
      weather,
      cropType: cropType || 'tomato',
      soilType: soilType || 'loam',
      fieldSize: fieldSize || null,
      season: season || 'kharif',
    });

    res.json(report);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
