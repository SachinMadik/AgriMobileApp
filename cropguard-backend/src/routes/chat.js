const express = require('express');
const router = express.Router();
const chatProxy = require('../services/chatProxy');

router.post('/', async (req, res, next) => {
  try {
    const { messages, message } = req.body;

    // Support both { messages: [...] } array format and simple { message: "..." } format
    let chatMessages;

    if (Array.isArray(messages)) {
      chatMessages = messages;
    } else if (typeof message === 'string' && message.trim()) {
      // Simple single-message format
      chatMessages = [{ role: 'user', content: message.trim() }];
    } else {
      return res.status(400).json({
        error: 'Request must include either "messages" (array) or "message" (string)',
        code: 400,
      });
    }

    if (chatMessages.length === 0) {
      return res.status(400).json({ error: 'messages array is empty', code: 400 });
    }

    if (chatMessages.length > 50) {
      return res.status(400).json({ error: 'messages array exceeds 50 entries', code: 400 });
    }

    // Validate message structure
    for (const msg of chatMessages) {
      if (!msg.role || !msg.content) {
        return res.status(400).json({
          error: 'Each message must have "role" and "content" fields',
          code: 400,
        });
      }
      if (!['user', 'assistant'].includes(msg.role)) {
        return res.status(400).json({
          error: 'Message role must be "user" or "assistant"',
          code: 400,
        });
      }
    }

    const result = await chatProxy.sendChat(chatMessages);
    res.json(result);

  } catch (err) {
    console.error('[Chat Route] Error:', err.message);
    next(err);
  }
});

module.exports = router;
