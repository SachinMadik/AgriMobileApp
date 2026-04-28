const fetch = require('node-fetch');

// Use HF Inference API with a reliable, always-available model
const MODELS = [
  'HuggingFaceH4/zephyr-7b-beta',
  'mistralai/Mistral-7B-Instruct-v0.2',
  'tiiuae/falcon-7b-instruct',
];

const HF_BASE = 'https://api-inference.huggingface.co/models/';

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

function buildPrompt(messages) {
  const history = messages.map((m) =>
    m.role === 'user' ? `User: ${m.content}` : `Assistant: ${m.content}`
  ).join('\n');
  return `${SYSTEM_PROMPT}\n\n${history}\nAssistant:`;
}

async function tryModel(modelUrl, prompt, token) {
  const res = await fetch(modelUrl, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      inputs: prompt,
      parameters: { max_new_tokens: 250, temperature: 0.4, top_p: 0.9, return_full_text: false },
      options: { wait_for_model: true, use_cache: false },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status, body });
  }

  const data = await res.json();
  const text = (Array.isArray(data) ? data[0]?.generated_text : data?.generated_text) ?? '';
  // Clean up — stop at next "User:" if model continues the conversation
  return text.split(/\nUser:/i)[0].trim();
}

async function sendChat(messages) {
  const lastUser = [...messages].reverse().find((m) => m.role === 'user');
  const userText = lastUser?.content ?? '';

  if (userText && !isAgriRelated(userText)) {
    return { reply: "I can only help with agriculture-related questions. Please ask about crops, soil, pests, irrigation, or farming. 🌱" };
  }

  const token = process.env.HF_API_TOKEN;
  if (!token || token.length < 10) {
    return { reply: "AI assistant not configured. Please add HF_API_TOKEN to environment variables." };
  }

  const prompt = buildPrompt(messages);

  for (const model of MODELS) {
    try {
      console.log(`[Chat] Trying model: ${model}`);
      const reply = await tryModel(`${HF_BASE}${model}`, prompt, token);
      if (reply && reply.length > 10) {
        console.log(`[Chat] Success with ${model} (${reply.length} chars)`);
        return { reply };
      }
    } catch (err) {
      console.warn(`[Chat] ${model} failed: ${err.message}`);
      if (err.status === 401 || err.status === 403) {
        return { reply: "Invalid Hugging Face token. Please check HF_API_TOKEN in Render environment variables." };
      }
      // Try next model on 503/429/timeout
    }
  }

  // All models failed — return helpful offline response
  return {
    reply: "The AI service is currently busy. Here are quick tips:\n• Late blight: apply copper fungicide immediately\n• Low nitrogen: apply urea 8kg/ha\n• Pest control: use neem oil spray\n• Please try again in a moment.",
  };
}

module.exports = { sendChat };
