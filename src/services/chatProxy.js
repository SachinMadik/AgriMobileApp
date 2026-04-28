const fetch = require('node-fetch');

// ── Model config ──────────────────────────────────────────────────────────────
const HF_MODEL = 'meta-llama/Llama-3.1-8B-Instruct';
const HF_URL   = 'https://router.huggingface.co/v1/chat/completions';

// ── System prompt ─────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are CropGuard AI, a specialist agricultural assistant for Indian farmers.

YOUR ROLE:
- Answer ONLY agriculture-related questions
- Topics: crop diseases, pest control, soil health, fertilizers, irrigation, weather-based farming, harvest timing, post-harvest management, crop varieties, organic farming, government schemes for farmers

STRICT RULES:
1. If a question is NOT related to agriculture or farming, respond ONLY with:
   "I can only help with agriculture-related questions. Please ask me about crops, soil, pests, irrigation, or farming practices."
2. Never discuss politics, entertainment, general knowledge, coding, or any non-farming topic
3. Give practical, actionable advice for small and medium Indian farmers
4. Keep responses under 200 words unless detail is genuinely needed
5. When recommending chemicals, always mention safety precautions

You are embedded in the CropGuard AI app used by farmers in India growing tomatoes, rice, wheat, cotton, and vegetables.`;

// ── Agriculture keyword filter ────────────────────────────────────────────────
const AGRI_KEYWORDS = [
  'crop', 'plant', 'seed', 'harvest', 'yield', 'farm', 'field', 'garden',
  'tomato', 'rice', 'wheat', 'cotton', 'maize', 'corn', 'potato', 'onion',
  'vegetable', 'fruit', 'paddy', 'sugarcane', 'groundnut', 'soybean', 'pulse',
  'soil', 'fertilizer', 'fertiliser', 'nitrogen', 'phosphorus', 'potassium',
  'npk', 'urea', 'compost', 'manure', 'organic', 'ph', 'nutrient', 'leaching',
  'pest', 'disease', 'fungal', 'blight', 'mildew', 'rot', 'wilt', 'virus',
  'insect', 'aphid', 'whitefly', 'nematode', 'weed', 'spray', 'pesticide',
  'fungicide', 'herbicide', 'insecticide',
  'irrigation', 'water', 'rain', 'drought', 'flood', 'humidity', 'temperature',
  'weather', 'monsoon', 'season', 'kharif', 'rabi', 'summer',
  'sow', 'transplant', 'prune', 'mulch', 'intercrop', 'rotation', 'tillage',
  'plough', 'plow', 'greenhouse', 'drip', 'sprinkler',
  'farmer', 'agriculture', 'agri', 'cultivation', 'grow', 'acre', 'hectare',
  'market', 'mandi', 'price', 'scheme', 'subsidy', 'loan',
];

function isAgricultureRelated(text) {
  const lower = text.toLowerCase();
  return AGRI_KEYWORDS.some((kw) => lower.includes(kw));
}

// ── Main chat function ────────────────────────────────────────────────────────
async function sendChat(messages) {
  const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
  const userText = lastUserMsg?.content ?? '';

  console.log(`[Chat] Incoming: "${userText.slice(0, 100)}"`);

  // Fast agriculture filter — reject before hitting API
  if (userText.length > 0 && !isAgricultureRelated(userText)) {
    console.log('[Chat] Rejected — non-agriculture query');
    return {
      reply: "I can only help with agriculture-related questions. Please ask me about crops, soil, pests, irrigation, or farming practices. 🌱",
    };
  }

  // Validate token
  const token = process.env.HF_API_TOKEN;
  if (!token || token.length < 10) {
    console.error('[Chat] HF_API_TOKEN is not configured in .env');
    return {
      reply: "The AI assistant is not configured. Please add your HF_API_TOKEN to the backend .env file.",
    };
  }

  try {
    console.log(`[Chat] Calling HF Router (${HF_MODEL}) with ${messages.length} message(s)`);

    const response = await fetch(HF_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: HF_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...messages,
        ],
        max_tokens: 512,
        temperature: 0.4,
        top_p: 0.9,
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[Chat] HF API error ${response.status}: ${errorBody}`);

      if (response.status === 401 || response.status === 403) {
        return { reply: "Invalid Hugging Face token. Please check your HF_API_TOKEN in the backend .env file." };
      }
      if (response.status === 429) {
        return { reply: "The AI service is rate-limited. Please wait a moment and try again." };
      }
      if (response.status === 503) {
        return { reply: "The AI model is warming up. Please try again in 20 seconds." };
      }

      const err = new Error(`HF API error: ${response.status}`);
      err.status = 502;
      throw err;
    }

    const data = await response.json();

    // OpenAI-compatible response
    const reply = data?.choices?.[0]?.message?.content?.trim()
      ?? 'Sorry, I could not generate a response. Please try again.';

    console.log(`[Chat] Reply (${reply.length} chars): "${reply.slice(0, 80)}..."`);
    return { reply };

  } catch (err) {
    if (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED') {
      console.error('[Chat] Network error:', err.message);
      return { reply: "Cannot connect to the AI service. Please check the backend's internet connection." };
    }
    console.error('[Chat] Unexpected error:', err.message);
    throw err;
  }
}

module.exports = { sendChat };
