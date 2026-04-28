const express = require('express');
const router = express.Router();
const weatherService = require('../services/weatherService');

router.get('/', async (req, res, next) => {
  try {
    const { lat, lon } = req.query;
    if (!lat || !lon) return res.status(400).json({ error: 'lat and lon are required', code: 400 });
    const data = await weatherService.getCurrentWeather(lat, lon);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.get('/forecast', async (req, res, next) => {
  try {
    const { lat, lon } = req.query;
    if (!lat || !lon) return res.status(400).json({ error: 'lat and lon are required', code: 400 });
    const data = await weatherService.getForecast(lat, lon);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
