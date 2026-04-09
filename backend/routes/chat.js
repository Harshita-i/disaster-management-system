// const express = require('express');
// const router  = express.Router();
// const Anthropic = require('@anthropic-ai/sdk');
// const { authenticate } = require('../middleware/auth');

// const client = new Anthropic({
//   apiKey: process.env.ANTHROPIC_API_KEY
// });

// const SYSTEM_PROMPT = `You are a disaster safety assistant helping victims during emergencies.
// You ONLY answer questions related to:
// - First aid and medical emergencies
// - Disaster safety (earthquake, flood, fire, cyclone, tsunami)
// - Evacuation procedures
// - Emergency preparedness
// - Survival tips during disasters

// If asked anything unrelated to disasters or safety, politely redirect.
// Keep answers short, clear, and practical. Use simple language.
// Always prioritize life safety in your responses.`;

// // POST /api/chat/safety
// router.post('/safety', authenticate, async (req, res) => {
//   try {
//     const { message } = req.body;

//     if (!message || message.trim() === '') {
//       return res.status(400).json({ message: 'Message is required' });
//     }

//     const response = await client.messages.create({
//       model:      'claude-haiku-4-5-20251001',
//       max_tokens: 500,
//       system:     SYSTEM_PROMPT,
//       messages: [
//         { role: 'user', content: message.trim() }
//       ]
//     });

//     const answer = response.content[0]?.text || 'Sorry, I could not generate a response.';

//     res.json({ answer });
//   } catch (err) {
//     console.error('Chatbot error:', err.message);
//     res.status(500).json({
//       message: 'Chatbot failed',
//       error: err.message
//     });
//   }
// });

// module.exports = router;



const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const apiKey = process.env.GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

function isSafetyQuestion(message = '') {
  const msg = message.toLowerCase();

  const keywords = [
    'earthquake', 'quake', 'tremor',
    'flood', 'flooding', 'heavy rain',
    'cyclone', 'storm', 'hurricane', 'typhoon',
    'tsunami',
    'landslide', 'land slide',
    'fire', 'wildfire', 'forest fire',
    'disaster', 'emergency',
    'evacuate', 'evacuation',
    'safety', 'safe', 'danger',
    'sos', 'rescue',
    'first aid',
    'emergency kit', 'emergency bag', 'go bag',
    'heatwave', 'heat wave'
  ];

  return keywords.some((k) => msg.includes(k));
}

router.post('/safety', authenticate, async (req, res) => {
  try {
    if (!genAI) {
      return res.status(500).json({ message: 'Gemini API key not configured' });
    }

    const { message } = req.body || {};
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ message: 'message is required' });
    }

    if (!isSafetyQuestion(message)) {
      return res.json({
        answer:
          'I am only allowed to answer questions about disaster safety, emergency preparedness, and what to do before, during, or after events like earthquakes, floods, cyclones, fires, tsunamis, and landslides.\n\nTry asking:\n• What should I do during an earthquake?\n• How do I stay safe in a flood?\n• What should I keep in an emergency kit?'
      });
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `
You are a disaster safety assistant in a disaster management web app.

Hard rules:
- Only answer questions related to disasters, emergencies, safety, preparedness, or what to do before/during/after events like earthquakes, floods, cyclones, fires, tsunamis, landslides, heatwaves, etc.
- If the question is not about disaster safety or emergencies, respond briefly:
  "I can only help with disaster safety and emergency preparedness questions."
- Do not give medical diagnosis or specific treatment.
- Do not give phone numbers or personal contacts. You may say "call local emergency services".
- Answer briefly in 3 to 6 bullet points using simple language.

User question:
${message}
`;

    const result = await model.generateContent(prompt);
    const answer = result?.response?.text?.() || 'Sorry, I could not generate an answer.';

    return res.json({ answer });
  } catch (err) {
    console.error('Gemini chat error:', err);
    return res.status(500).json({ message: 'Failed to get response from Gemini' });
  }
});

module.exports = router;