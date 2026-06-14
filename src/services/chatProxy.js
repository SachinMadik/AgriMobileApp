const fetch = require('node-fetch');

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.1-8b-instant'; // free, fast

const SYSTEM_PROMPT = `You are CropGuard AI, an agricultural assistant for Indian farmers.
Answer ONLY agriculture questions: crop diseases, pests, soil, fertilizers, irrigation, weather, harvest, government schemes.
If not agriculture-related, say: "I can only help with agriculture questions."
Be concise (under 150 words), practical, and actionable.`;

const AGRI_KEYWORDS = [
  'crop','plant','seed','harvest','yield','farm','field','tomato','rice','wheat',
  'cotton','maize','potato','onion','vegetable','fruit','soil','fertilizer','nitrogen',
  'phosphorus','potassium','npk','urea','compost','pest','disease','fungal','blight',
  'mildew','rot','spray','pesticide','fungicide','irrigation','water','rain','drought',
  'humidity','temperature','weather','monsoon','kharif','rabi','farmer','agriculture',
];

function isAgriRelated(text) {
  const lower = text.toLowerCase();
  return AGRI_KEYWORDS.some((kw) => lower.includes(kw));
}

async function sendChat(messages) {
  const lastUser = [...messages].reverse().find((m) => m.role === 'user');
  const userText = lastUser?.content ?? '';

  if (userText && !isAgriRelated(userText)) {
    return { reply: "I can only help with agriculture-related questions. Please ask about crops, soil, pests, irrigation, or farming. 🌱" };
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return { reply: "AI assistant not configured. Please add GROQ_API_KEY to environment variables." };
  }

  const res = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
      max_tokens: 250,
      temperature: 0.4,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('[Chat] Groq error:', res.status, err);
    throw new Error(`Groq API error: ${res.status}`);
  }

  const data = await res.json();
  const reply = data.choices?.[0]?.message?.content?.trim() ?? '';
  return { reply };
}

module.exports = { sendChat };
