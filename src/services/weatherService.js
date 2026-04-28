const fetch = require('node-fetch');
const NodeCache = require('node-cache');

const cache = new NodeCache({ stdTTL: 600 }); // 10 minutes

const ICON_MAP = {
  '01d': 'sunny', '01n': 'moon',
  '02d': 'partly-sunny', '02n': 'cloudy-night',
  '03d': 'cloudy', '03n': 'cloudy',
  '04d': 'cloudy', '04n': 'cloudy',
  '09d': 'rainy', '09n': 'rainy',
  '10d': 'rainy', '10n': 'rainy',
  '11d': 'thunderstorm', '11n': 'thunderstorm',
  '13d': 'snow', '13n': 'snow',
  '50d': 'partly-sunny', '50n': 'cloudy',
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

async function getCurrentWeather(lat, lon) {
  const key = `weather_${lat}_${lon}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const apiKey = process.env.OPENWEATHERMAP_API_KEY;
  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}`;
  const response = await fetch(url);

  if (!response.ok) {
    const err = new Error(`OpenWeatherMap error: ${response.statusText}`);
    err.status = 502;
    throw err;
  }

  const data = await response.json();
  const result = {
    temperature: data.main?.temp ?? 0,
    humidity: data.main?.humidity ?? 0,
    rainfall: data.rain?.['1h'] ?? 0,
    windSpeed: data.wind?.speed ?? 0,
    cloudCover: data.clouds?.all ?? 0,
  };

  cache.set(key, result);
  return result;
}

async function getForecast(lat, lon) {
  const key = `forecast_${lat}_${lon}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const apiKey = process.env.OPENWEATHERMAP_API_KEY;
  const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&cnt=40&appid=${apiKey}`;
  const response = await fetch(url);

  if (!response.ok) {
    const err = new Error(`OpenWeatherMap forecast error: ${response.statusText}`);
    err.status = 502;
    throw err;
  }

  const data = await response.json();
  const dailyMap = {};

  for (const item of data.list) {
    const date = new Date(item.dt * 1000);
    const dayKey = date.toISOString().split('T')[0];
    if (!dailyMap[dayKey]) {
      dailyMap[dayKey] = {
        day: DAYS[date.getDay()],
        icon: ICON_MAP[item.weather?.[0]?.icon] ?? 'partly-sunny',
        highs: [],
        lows: [],
      };
    }
    dailyMap[dayKey].highs.push(item.main.temp_max);
    dailyMap[dayKey].lows.push(item.main.temp_min);
  }

  const result = Object.values(dailyMap).slice(0, 7).map(d => ({
    day: d.day,
    icon: d.icon,
    high: Math.round(Math.max(...d.highs)),
    low: Math.round(Math.min(...d.lows)),
  }));

  cache.set(key, result);
  return result;
}

module.exports = { getCurrentWeather, getForecast };
