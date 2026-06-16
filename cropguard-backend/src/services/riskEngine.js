function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

// Crop-specific vulnerability rules
const CROP_RULES = {
  tomato: {
    fungalHumidityThreshold: 65,   // tomatoes are more sensitive
    droughtTempThreshold: 30,
    pestRiskSeasons: ['kharif'],
  },
  rice: {
    fungalHumidityThreshold: 75,
    droughtTempThreshold: 35,
    pestRiskSeasons: ['kharif'],
    floodTolerant: true,
  },
  wheat: {
    fungalHumidityThreshold: 70,
    droughtTempThreshold: 28,
    pestRiskSeasons: ['rabi'],
    frostSensitive: true,
  },
  cotton: {
    fungalHumidityThreshold: 70,
    droughtTempThreshold: 32,
    pestRiskSeasons: ['kharif'],
  },
  maize: {
    fungalHumidityThreshold: 70,
    droughtTempThreshold: 32,
    pestRiskSeasons: ['kharif', 'summer'],
  },
};

// Prevention recommendations per risk type and severity
const RECOMMENDATIONS = {
  fungal: {
    High: {
      action: 'Apply preventive fungicide (copper-based or mancozeb) immediately.',
      timeline: 'Within 24 hours',
      activity: 'Spray fungicide on all leaves, especially undersides.',
    },
    Medium: {
      action: 'Monitor crops daily for early fungal symptoms. Reduce overhead irrigation.',
      timeline: 'Within 48 hours',
      activity: 'Inspect leaves for spots or discolouration. Improve field drainage.',
    },
    Low: {
      action: 'Conditions are borderline. Maintain good air circulation between plants.',
      timeline: 'This week',
      activity: 'Routine field inspection. Ensure proper plant spacing.',
    },
  },
  drought: {
    High: {
      action: 'Irrigate immediately using drip or furrow method. Mulch soil to retain moisture.',
      timeline: 'Today',
      activity: 'Check soil moisture at 6-inch depth. Apply 2–3 cm of water.',
    },
    Medium: {
      action: 'Schedule irrigation within 24 hours. Avoid fertiliser application until moisture improves.',
      timeline: 'Within 24 hours',
      activity: 'Monitor wilting symptoms. Prepare irrigation equipment.',
    },
    Low: {
      action: 'Soil moisture is adequate. Continue normal irrigation schedule.',
      timeline: 'Routine',
      activity: 'Check weather forecast for next 3 days.',
    },
  },
  flood: {
    High: {
      action: 'Open drainage channels immediately. Do not apply fertiliser or pesticide.',
      timeline: 'Immediately',
      activity: 'Clear blocked drains. Raise seedling beds if possible.',
    },
    Medium: {
      action: 'Monitor field drainage. Avoid heavy machinery on waterlogged soil.',
      timeline: 'Within 12 hours',
      activity: 'Check drainage outlets. Delay any planned field operations.',
    },
    Low: {
      action: 'Rainfall is within safe range. Ensure drainage channels are clear.',
      timeline: 'Routine',
      activity: 'Inspect drainage infrastructure.',
    },
  },
  pest: {
    High: {
      action: 'Apply recommended pesticide. Set up pheromone traps for monitoring.',
      timeline: 'Within 24 hours',
      activity: 'Scout field for pest hotspots. Apply targeted spray.',
    },
    Medium: {
      action: 'Increase scouting frequency. Consider biological control agents.',
      timeline: 'Within 48 hours',
      activity: 'Check 20 plants per acre for pest presence.',
    },
    Low: {
      action: 'Pest pressure is low. Maintain regular scouting.',
      timeline: 'Weekly',
      activity: 'Routine pest monitoring.',
    },
  },
  frost: {
    High: {
      action: 'Cover sensitive crops with frost cloth. Apply light irrigation before nightfall.',
      timeline: 'Before sunset',
      activity: 'Deploy frost protection measures immediately.',
    },
    Medium: {
      action: 'Monitor overnight temperatures. Prepare frost protection materials.',
      timeline: 'This evening',
      activity: 'Check weather forecast. Have frost cloth ready.',
    },
    Low: {
      action: 'Frost risk is low. No immediate action needed.',
      timeline: 'Routine',
      activity: 'Monitor temperature trends.',
    },
  },
};

function getRiskLevel(value, highThreshold, mediumThreshold) {
  if (value >= highThreshold) return 'High';
  if (value >= mediumThreshold) return 'Medium';
  return 'Low';
}

function calculateRisks(weather, farmContext = {}) {
  const { humidity, temperature, rainfall, windSpeed = 0 } = weather;
  const cropType = (farmContext.cropType || 'tomato').toLowerCase();
  const season = (farmContext.season || 'kharif').toLowerCase();
  const soilType = (farmContext.soilType || 'loam').toLowerCase();

  const cropRule = CROP_RULES[cropType] || CROP_RULES.tomato;

  // ── Fungal risk ──────────────────────────────────────────────────────────
  const fungalHumidityHigh = cropRule.fungalHumidityThreshold;
  const fungalHumidityMed = fungalHumidityHigh - 10;
  let fungal;
  if (humidity > fungalHumidityHigh && temperature >= 18 && temperature <= 32) {
    fungal = 'High';
  } else if (humidity >= fungalHumidityMed || (temperature >= 16 && temperature < 18)) {
    fungal = 'Medium';
  } else {
    fungal = 'Low';
  }

  // ── Drought risk ─────────────────────────────────────────────────────────
  const droughtTempHigh = cropRule.droughtTempThreshold;
  let drought;
  if (rainfall === 0 && temperature > droughtTempHigh) {
    drought = 'High';
  } else if (rainfall < 2 && temperature > droughtTempHigh - 2) {
    drought = 'Medium';
  } else {
    drought = 'Low';
  }

  // Sandy soil dries faster → elevate drought risk
  if (soilType.includes('sandy') && drought === 'Low' && rainfall < 5) {
    drought = 'Medium';
  }

  // ── Flood risk ───────────────────────────────────────────────────────────
  let flood;
  if (rainfall > 10) {
    flood = cropRule.floodTolerant ? 'Medium' : 'High';
  } else if (rainfall > 5) {
    flood = 'Medium';
  } else {
    flood = 'Low';
  }

  // ── Pest risk (season + crop based) ─────────────────────────────────────
  let pest = 'Low';
  if (cropRule.pestRiskSeasons.includes(season)) {
    if (temperature >= 25 && temperature <= 35 && humidity >= 50) {
      pest = humidity > 70 ? 'High' : 'Medium';
    }
  }

  // ── Frost risk (wheat in rabi, cold nights) ──────────────────────────────
  let frost = 'Low';
  if (cropRule.frostSensitive && season === 'rabi') {
    if (temperature < 5) frost = 'High';
    else if (temperature < 10) frost = 'Medium';
  }

  // ── Percentage indicators ────────────────────────────────────────────────
  const blight_pct = clamp(Math.round(((humidity - 50) / 50) * 100), 0, 100);
  const frost_pct = clamp(Math.round(((15 - temperature) / 15) * 100), 0, 100);
  const drought_pct = clamp(
    Math.round(((temperature - 25) / 15) * 100 + (rainfall === 0 ? 20 : 0)),
    0,
    100
  );

  // ── Build detailed risk list ─────────────────────────────────────────────
  const risks = [];

  function addRisk(type, level, title, description) {
    if (level === 'Low') return; // only surface Medium/High
    const rec = RECOMMENDATIONS[type]?.[level] || {};
    risks.push({
      type,
      severity: level === 'High' ? 'HIGH' : 'MEDIUM',
      title,
      description,
      recommendation: rec.action || '',
      timeline: rec.timeline || '',
      activity: rec.activity || '',
    });
  }

  addRisk('fungal', fungal,
    `${fungal} Fungal Disease Risk`,
    `Humidity ${humidity}% and temperature ${Math.round(temperature)}°C favour fungal growth on ${cropType}.`
  );
  addRisk('drought', drought,
    `${drought} Drought Risk`,
    `Rainfall ${rainfall}mm with temperature ${Math.round(temperature)}°C. ${soilType.includes('sandy') ? 'Sandy soil loses moisture quickly.' : ''}`
  );
  addRisk('flood', flood,
    `${flood} Flood / Waterlogging Risk`,
    `Rainfall ${rainfall}mm detected. Check field drainage.`
  );
  addRisk('pest', pest,
    `${pest} Pest Pressure`,
    `${season.charAt(0).toUpperCase() + season.slice(1)} season conditions favour pest activity on ${cropType}.`
  );
  addRisk('frost', frost,
    `${frost} Frost Risk`,
    `Temperature ${Math.round(temperature)}°C is dangerously low for ${cropType} in ${season} season.`
  );

  return {
    fungal, drought, flood, pest, frost,
    blight_pct, frost_pct, drought_pct,
    risks,
    weather: { temperature, humidity, rainfall, windSpeed },
    farmContext: { cropType, season, soilType },
  };
}

module.exports = { calculateRisks };
