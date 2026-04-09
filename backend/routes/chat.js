const express = require('express');
const router  = express.Router();
const Anthropic = require('@anthropic-ai/sdk');
const { authenticate } = require('../middleware/auth');

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

const SYSTEM_PROMPT = `You are a disaster safety assistant helping victims during emergencies.
You ONLY answer questions related to:
- First aid and medical emergencies
- Disaster safety (earthquake, flood, fire, cyclone, tsunami)
- Evacuation procedures
- Emergency preparedness
- Survival tips during disasters

If asked anything unrelated to disasters or safety, politely redirect.
Keep answers short, clear, and practical. Use simple language.
Always prioritize life safety in your responses.`;

// POST /api/chat/safety
router.post('/safety', authenticate, async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || message.trim() === '') {
      return res.status(400).json({ message: 'Message is required' });
    }

    const response = await client.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 500,
      system:     SYSTEM_PROMPT,
      messages: [
        { role: 'user', content: message.trim() }
      ]
    });

    const answer = response.content[0]?.text || 'Sorry, I could not generate a response.';

    res.json({ answer });
  } catch (err) {
    console.error('Chatbot error:', err.message);
    res.status(500).json({
      message: 'Chatbot failed',
      error: err.message
    });
  }
});

module.exports = router;