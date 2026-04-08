// filepath: /Users/shalinikotha/Desktop/MyProjects/mini_project/disaster-management-system/backend/routes/chat.js
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const apiKey = process.env.GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

// Simple check: is this message about disasters / safety / emergency?
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

  return keywords.some(k => msg.includes(k));
}

// POST /api/chat/safety
router.post('/safety', authenticate, async (req, res) => {
  try {
    if (!genAI) {
      return res.status(500).json({ message: 'Gemini API key not configured' });
    }

    const { message } = req.body || {};
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ message: 'message is required' });
    }

    // Guard: reject non-safety questions BEFORE calling Gemini
    if (!isSafetyQuestion(message)) {
      return res.json({
        answer:
          'I am only allowed to answer questions about disaster safety, ' +
          'emergency preparedness, and what to do before/during/after events ' +
          'like earthquakes, floods, cyclones, fires, tsunamis, and landslides.\n\n' +
          'Try asking things like:\n' +
          '• What should I do during an earthquake?\n' +
          '• How to stay safe in a flood?\n' +
          '• What items should I keep in an emergency kit?'
      });
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

    const prompt = `
You are a disaster safety assistant in a disaster management web app.
User role: victim.

HARD RULES:
- Only answer questions related to disasters, emergencies, safety, preparedness,
  or what to do before/during/after events like earthquakes, floods, cyclones,
  fires, tsunamis, landslides, heatwaves, etc.
- If the question is not about disaster safety or emergencies, respond briefly:
  "I can only help with disaster safety and emergency preparedness questions."
- Do NOT give medical diagnosis or specific treatment.
- Do NOT give phone numbers or personal contacts. You may say "call local emergency services".
- Answer briefly, in 3–6 bullet points, using simple language.

User question:
${message}
`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    res.json({ answer: text });
  } catch (err) {
    console.error('Gemini chat error:', err);
    res.status(500).json({ message: 'Failed to get response from Gemini' });
  }
});

module.exports = router;