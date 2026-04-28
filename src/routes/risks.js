const express = require('express');
const router = express.Router();
const weatherService = require('../services/weatherService');
const riskEngine = require('../services/riskEngine');

router.get('/', async (req, res, next) => {
  try {
    const { lat, lon } = req.query;
    if (!lat || !lon) return res.status(400).json({ error: 'lat and lon are required', code: 400 });
    const weather = await weatherService.getCurrentWeather(lat, lon);
    const risks = riskEngine.calculateRisks(weather);
    res.json(risks);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
