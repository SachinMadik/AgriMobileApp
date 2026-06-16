/**
 * Nutrient Leaching Risk Model
 *
 * Formula:
 *   riskScore = (rainfallFactor * 0.4) + (soilPermeability * 0.3)
 *             + (cropSensitivity * 0.2) + (drainageFactor * 0.1)
 *
 * All factors are normalised to [0, 1] before weighting.
 * Final score is scaled to [0, 100].
 */

// ── Soil coefficient table ────────────────────────────────────────────────────
const SOIL_TABLE = {
  sandy:       { permeability: 1.0, drainageFactor: 0.9, label: 'Sandy' },
  'sandy loam':{ permeability: 0.8, drainageFactor: 0.75, label: 'Sandy Loam' },
  loam:        { permeability: 0.6, drainageFactor: 0.55, label: 'Loam' },
  'clay loam': { permeability: 0.4, drainageFactor: 0.35, label: 'Clay Loam' },
  clay:        { permeability: 0.2, drainageFactor: 0.2,  label: 'Clay' },
  silt:        { permeability: 0.5, drainageFactor: 0.45, label: 'Silt' },
  'silty loam':{ permeability: 0.55, drainageFactor: 0.5, label: 'Silty Loam' },
};

// ── Crop sensitivity table ────────────────────────────────────────────────────
const CROP_SENSITIVITY = {
  tomato:     { factor: 0.85, label: 'Tomato (Vegetable)', nitrogenDemand: 'High' },
  rice:       { factor: 0.3,  label: 'Rice',               nitrogenDemand: 'Medium' },
  wheat:      { factor: 0.55, label: 'Wheat',              nitrogenDemand: 'Medium' },
  cotton:     { factor: 0.65, label: 'Cotton',             nitrogenDemand: 'High' },
  maize:      { factor: 0.7,  label: 'Maize',              nitrogenDemand: 'High' },
  sugarcane:  { factor: 0.6,  label: 'Sugarcane',          nitrogenDemand: 'High' },
  groundnut:  { factor: 0.45, label: 'Groundnut',          nitrogenDemand: 'Low' },
  soybean:    { factor: 0.4,  label: 'Soybean',            nitrogenDemand: 'Low' },
};

// ── Season multiplier ─────────────────────────────────────────────────────────
const SEASON_MULTIPLIER = {
  kharif: 1.2,   // monsoon season — higher leaching risk
  rabi:   0.8,   // winter — lower rainfall
  summer: 1.0,
};

// ── Rainfall factor ───────────────────────────────────────────────────────────
function getRainfallFactor(rainfallMm) {
  if (rainfallMm >= 50) return 1.0;
  if (rainfallMm >= 20) return 0.3 + ((rainfallMm - 20) / 30) * 0.7; // linear 0.3→1.0
  if (rainfallMm >= 5)  return 0.1 + ((rainfallMm - 5) / 15) * 0.2;  // linear 0.1→0.3
  return 0.05;
}

// ── Temperature correction ────────────────────────────────────────────────────
// Higher temps increase microbial activity → faster N mineralisation → more leachable N
function getTemperatureCorrection(tempC) {
  if (tempC >= 35) return 1.15;
  if (tempC >= 25) return 1.0;
  if (tempC >= 15) return 0.85;
  return 0.7;
}

// ── Humidity correction ───────────────────────────────────────────────────────
function getHumidityCorrection(humidity) {
  if (humidity >= 80) return 1.1;
  if (humidity >= 60) return 1.0;
  return 0.9;
}

// ── Main calculation ──────────────────────────────────────────────────────────
function calculateLeaching({ weather, cropType, soilType, fieldSize, season }) {
  const rainfall    = weather.rainfall    ?? 0;
  const temperature = weather.temperature ?? 25;
  const humidity    = weather.humidity    ?? 60;

  const soilKey = (soilType || 'loam').toLowerCase();
  const cropKey = (cropType || 'tomato').toLowerCase();
  const seasonKey = (season || 'kharif').toLowerCase();

  const soil = SOIL_TABLE[soilKey] || SOIL_TABLE['loam'];
  const crop = CROP_SENSITIVITY[cropKey] || CROP_SENSITIVITY['tomato'];
  const seasonMult = SEASON_MULTIPLIER[seasonKey] || 1.0;

  // Core factors (all 0–1)
  const rainfallFactor   = getRainfallFactor(rainfall);
  const soilPermeability = soil.permeability;
  const cropSensitivity  = crop.factor;
  const drainageFactor   = soil.drainageFactor;

  // Weighted score (0–1)
  const rawScore = (rainfallFactor * 0.4)
                 + (soilPermeability * 0.3)
                 + (cropSensitivity  * 0.2)
                 + (drainageFactor   * 0.1);

  // Apply environmental corrections
  const tempCorr     = getTemperatureCorrection(temperature);
  const humidCorr    = getHumidityCorrection(humidity);
  const correctedScore = rawScore * tempCorr * humidCorr * seasonMult;

  // Scale to 0–100 and clamp
  const riskScore = Math.min(100, Math.round(correctedScore * 100));

  // Risk level
  let riskLevel;
  if (riskScore >= 60) riskLevel = 'high';
  else if (riskScore >= 35) riskLevel = 'medium';
  else riskLevel = 'low';

  // Nitrogen loss estimate
  // N_loss (%) = rainfall(mm) × soilFactor × cropFactor × 0.1 × seasonMult
  const nitrogenLossPercent = Math.min(
    40,
    parseFloat((rainfall * soil.permeability * crop.factor * 0.1 * seasonMult).toFixed(1))
  );

  // Phosphorus loss (lower — P binds to soil particles)
  const phosphorusLossPercent = Math.min(
    15,
    parseFloat((rainfall * soil.permeability * 0.03 * seasonMult).toFixed(1))
  );

  // Potassium loss
  const potassiumLossPercent = Math.min(
    20,
    parseFloat((rainfall * soil.permeability * crop.factor * 0.06 * seasonMult).toFixed(1))
  );

  // ── Explanation ─────────────────────────────────────────────────────────────
  const factors = {
    rainfall: {
      value: `${rainfall} mm`,
      factor: parseFloat(rainfallFactor.toFixed(2)),
      weight: '40%',
      explanation: rainfall >= 50
        ? 'Heavy rainfall — high leaching potential'
        : rainfall >= 20
        ? 'Moderate rainfall — medium leaching risk'
        : 'Low rainfall — minimal leaching expected',
    },
    soilPermeability: {
      value: soil.label,
      factor: soilPermeability,
      weight: '30%',
      explanation: soilPermeability >= 0.8
        ? 'Highly permeable soil — nutrients drain quickly'
        : soilPermeability >= 0.5
        ? 'Moderately permeable — some nutrient retention'
        : 'Low permeability — good nutrient retention',
    },
    cropSensitivity: {
      value: crop.label,
      factor: cropSensitivity,
      weight: '20%',
      explanation: `${crop.label} has ${crop.nitrogenDemand.toLowerCase()} nitrogen demand. ${
        cropSensitivity >= 0.7
          ? 'High uptake crops reduce leaching when healthy.'
          : 'Lower uptake — more N remains in soil.'
      }`,
    },
    drainage: {
      value: `Factor ${drainageFactor}`,
      factor: drainageFactor,
      weight: '10%',
      explanation: drainageFactor >= 0.7
        ? 'Fast drainage — nutrients leave root zone quickly'
        : 'Slow drainage — nutrients stay longer in root zone',
    },
    corrections: {
      temperature: `${temperature}°C (×${tempCorr})`,
      humidity: `${humidity}% (×${humidCorr})`,
      season: `${seasonKey} (×${seasonMult})`,
    },
  };

  // ── Recommendations ──────────────────────────────────────────────────────────
  const recommendations = buildRecommendations(riskLevel, {
    rainfall, soilPermeability, nitrogenLossPercent, season: seasonKey, cropType: cropKey,
  });

  return {
    riskScore,
    riskLevel,
    nitrogenLossPercent,
    phosphorusLossPercent,
    potassiumLossPercent,
    factors,
    recommendations,
    weather: { rainfall, temperature, humidity },
    inputs: { cropType: crop.label, soilType: soil.label, season: seasonKey, fieldSize: fieldSize || 'N/A' },
    generatedAt: new Date().toISOString(),
  };
}

function buildRecommendations(riskLevel, ctx) {
  const recs = [];

  if (riskLevel === 'high') {
    recs.push({
      category: 'Fertilizer Management',
      icon: 'flask',
      priority: 'Urgent',
      action: 'Delay nitrogen fertilizer application by 3–5 days until rainfall subsides.',
      detail: `Estimated N loss of ${ctx.nitrogenLossPercent}% makes immediate application wasteful and polluting.`,
    });
    recs.push({
      category: 'Fertilizer Type',
      icon: 'leaf',
      priority: 'High',
      action: 'Switch to slow-release or coated urea fertilizers.',
      detail: 'Slow-release formulations reduce leaching by 30–50% compared to conventional urea.',
    });
    recs.push({
      category: 'Drainage',
      icon: 'water',
      priority: 'High',
      action: 'Inspect and clear field drainage channels immediately.',
      detail: 'Waterlogging accelerates anaerobic N loss (denitrification) in addition to leaching.',
    });
    recs.push({
      category: 'Soil Amendment',
      icon: 'layers',
      priority: 'Medium',
      action: 'Apply organic matter (compost) to improve soil structure and nutrient retention.',
      detail: 'Organic matter increases cation exchange capacity, binding nutrients against leaching.',
    });
  } else if (riskLevel === 'medium') {
    recs.push({
      category: 'Fertilizer Timing',
      icon: 'time',
      priority: 'Medium',
      action: 'Split fertilizer doses — apply 50% now, 50% after 7 days.',
      detail: 'Split application reduces peak N concentration in soil water, lowering leaching losses.',
    });
    recs.push({
      category: 'Monitoring',
      icon: 'eye',
      priority: 'Medium',
      action: 'Monitor rainfall forecast for next 48 hours before applying fertilizer.',
      detail: 'Avoid applying within 24 hours of predicted rainfall > 10mm.',
    });
    recs.push({
      category: 'Irrigation',
      icon: 'rainy',
      priority: 'Low',
      action: 'Reduce irrigation frequency by 20–30% this week.',
      detail: 'Combined rainfall and irrigation can push nutrients below the root zone.',
    });
  } else {
    recs.push({
      category: 'Fertilizer Application',
      icon: 'checkmark-circle',
      priority: 'Low',
      action: 'Conditions are safe for fertilizer application.',
      detail: 'Low leaching risk. Apply recommended dose as per crop growth stage.',
    });
    recs.push({
      category: 'Preventive',
      icon: 'shield-checkmark',
      priority: 'Low',
      action: 'Maintain soil organic matter levels above 2% for long-term nutrient retention.',
      detail: 'Regular compost application builds soil health and reduces future leaching risk.',
    });
  }

  return recs;
}

module.exports = { calculateLeaching };
