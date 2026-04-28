const fetch = require('node-fetch');

// Free Hugging Face Inference API (no router, no billing required)
const HF_MODEL = 'mistralai/Mistral-7B-Instruct-v0.3';
const HF_URL   = `https://api-inference.huggingface.co/models/${HF_MODEL}`;

const SYSTEM_PROMPT = `You are CropGuard AI, a specialist agricultural assistant for Indian farmers.
Answer ONLY agriculture-related questions about crop diseases, pest control, soil health, fertilizers, irrigation, weather-based farming, harvest timing, and government schemes.
If a question is NOT related to agriculture, respond ONLY with: "I can only help with agriculture-related questions."
Give practical, actionable advice. Keep responses under 200 words. When recommending chemicals, mention safety precautions.`;

const AGRI_KEYWORDS = [
  'crop','plant','seed','harvest','yield','farm','field','tomato','rice','wheat',
  'cotton','maize','corn','potato','onion','vegetable','fruit','paddy','sugarcane',
  'soil','fertilizer','fertiliser','nitrogen','phosphorus','potassium','npk','urea',
  'compost','manure','organic','nutrient','pest','disease','fungal','blight','mildew',
  'rot','wilt','insect','aphid','spray','pesticide','fungicide','herbicide',
  'irrigation','water','rain','drought','flood','humidity','temperature','weather',
  'monsoon','season','kharif','rabi','farmer','agriculture','agri','cultivation',
  'grow','acre','hectare','market','mandi','scheme','subsidy',
];

function isAgricultureRelated(text) {
  const lower = text.toLowerCase();
  return AGRI_KEYWORDS.some((kw) => lower.includes(kw));
}

async function sendChat(messages) {
  const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
  const userText = lastUserMsg?.content ?? '';

  if (userText.length > 0 && !isAgricultureRelated(userText)) {
    return { reply: "I can only help with agriculture-related questions. Please ask me about crops, soil, pests, irrigation, or farming practices. 🌱" };
  }

  const token = process.env.HF_API_TOKEN;
  if (!token || token.length < 10) {
    return { reply: "The AI assistant is not configured. Please add HF_API_TOKEN to the backend environment variables." };
  }

  // Build prompt in Mistral instruct format
  const history = messages.map((m) =>
    m.role === 'user' ? `[INST] ${m.content} [/INST]` : m.content
  ).join('\n');

  const prompt = `${SYSTEM_PROMPT}\n\n${history}`;

  try {
    console.log(`[Chat] Calling HF Inference API (${HF_MODEL})`);

    const response = await fetch(HF_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          max_new_tokens: 300,
          temperature: 0.4,
          top_p: 0.9,
          return_full_text: false,
        },
        options: { wait_for_model: true },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[Chat] HF API error ${response.status}: ${errorBody}`);
      if (response.status === 401 || response.status === 403) {
        return { reply: "Invalid Hugging Face token. Please check HF_API_TOKEN in Render environment variables." };
      }
      if (response.status === 503) {
        return { reply: "The AI model is loading. Please try again in 20 seconds." };
      }
      if (response.status === 429) {
        return { reply: "AI service is rate-limited. Please wait a moment and try again." };
      }
      return { reply: "AI service is temporarily unavailable. Please try again shortly." };
    }

    const data = await response.json();
    const reply = (Array.isArray(data) ? data[0]?.generated_text : data?.generated_text)?.trim()
      ?? 'Sorry, I could not generate a response. Please try again.';

    console.log(`[Chat] Reply (${reply.length} chars)`);
    return { reply };

  } catch (err) {
    if (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED') {
      return { reply: "Cannot connect to the AI service. Please check your internet connection." };
    }
    console.error('[Chat] Error:', err.message);
    return { reply: "Something went wrong with the AI service. Please try again." };
  }
}

module.exports = { sendChat };
