const express = require('express');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve static frontend
app.use(express.static(path.join(__dirname, 'public')));

// Simple proxy endpoint to call OpenAI Chat Completions
app.post('/api/chat', async (req, res) => {
  try {
    const { messages } = req.body;

    // Default behavior: do NOT call the real OpenAI API unless USE_OPENAI=1 is set.
    // This prevents accidental usage/charges. To enable real OpenAI calls set USE_OPENAI=1
    // and ensure OPENAI_API_KEY is present. You can also force mock per-request with ?mock=1.
    const wantLive = process.env.USE_OPENAI === '1';
    const wantMock = process.env.MOCK_OPENAI === '1' || req.query.mock === '1' || !wantLive;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages (array) is required in request body' });
    }

    // If in mock mode, return a canned response and avoid calling OpenAI (no credits used)
    if (wantMock) {
      // Enhanced mock: pick AI model and generate varied, natural replies
      const model = req.query.model || (req.body.model || 'chatgpt');
      const lastUser = Array.isArray(messages) ? [...messages].reverse().find(m => m.role === 'user') : null;
      let replyText = '';
      if (lastUser && lastUser.content) {
        const txt = lastUser.content.toLowerCase();
        if (/^(hi|hello|hey|selam|merhaba)\b/.test(txt)) {
          if (model === 'gemini') replyText = '👋 Hi! Gemini here. How can I help you today?';
          else if (model === 'claude') replyText = 'Hello, I am Claude. What would you like to discuss?';
          else if (model === 'grok') replyText = 'Hey, Grok here! Ready for some fun Q&A?';
          else replyText = 'Hello! I am ChatGPT. How can I assist you?';
        } else if (txt.includes('?')) {
          if (model === 'gemini') replyText = 'Great question! Gemini suggests: let’s break it down together.';
          else if (model === 'claude') replyText = 'Claude says: That’s an interesting question. Here’s my take…';
          else if (model === 'grok') replyText = 'Grok: I like tough questions! Here’s a witty answer.';
          else replyText = 'ChatGPT: Here’s what I think…';
        } else if (txt.length < 40) {
          if (model === 'gemini') replyText = `Gemini echoes: "${lastUser.content}"`;
          else if (model === 'claude') replyText = `Claude heard: "${lastUser.content}"`;
          else if (model === 'grok') replyText = `Grok repeats: "${lastUser.content}"`;
          else replyText = `ChatGPT: "${lastUser.content}"`;
        } else {
          if (model === 'gemini') replyText = `Gemini received your message: "${lastUser.content.slice(0,200)}"`;
          else if (model === 'claude') replyText = `Claude received: "${lastUser.content.slice(0,200)}"`;
          else if (model === 'grok') replyText = `Grok got: "${lastUser.content.slice(0,200)}"`;
          else replyText = `ChatGPT received: "${lastUser.content.slice(0,200)}"`;
        }
      } else {
        if (model === 'gemini') replyText = 'Hi! Gemini here. Ask me anything.';
        else if (model === 'claude') replyText = 'Hello, I am Claude. Ready to chat.';
        else if (model === 'grok') replyText = 'Hey, Grok here! What’s up?';
        else replyText = 'Hello! I am ChatGPT. How can I assist you?';
      }

      const mockReply = {
        id: 'mock-1',
        object: 'chat.completion',
        choices: [{ index: 0, message: { role: 'assistant', content: replyText } }]
      };
      const assistantMessage = mockReply.choices[0].message;
      return res.json({ assistant: assistantMessage, raw: mockReply, model });
    }

    // From here on we are in live mode and thus require the API key
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: 'OPENAI_API_KEY not set in server environment (required when USE_OPENAI=1)' });
    }

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages (array) is required in request body' });
    }

    // Use global fetch available in Node 18+
    // Build Authorization header and check for non-ASCII chars (undici requires byte values)
    const authValue = `Bearer ${process.env.OPENAI_API_KEY}`;
    const nonAscii = [];
    for (let i = 0; i < authValue.length; i++) {
      const code = authValue.charCodeAt(i);
      if (code > 255) nonAscii.push({ index: i, ord: code });
    }
    if (nonAscii.length) {
      console.error('Non-ASCII characters found in auth header:', nonAscii);
      return res.status(500).json({ error: 'Non-ASCII characters found in OPENAI_API_KEY/Authorization header', details: nonAscii });
    }

    // (live-mode) Build Authorization header and check for non-ASCII chars (undici requires byte values)

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authValue
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: messages,
        max_tokens: 800,
        temperature: 0.7
      })
    });

    if (!openaiRes.ok) {
      // Try to parse JSON error body, fall back to text
      let errBody;
      try {
        errBody = await openaiRes.json();
      } catch (e) {
        const txt = await openaiRes.text();
        errBody = { message: txt };
      }

      console.error('OpenAI API error', openaiRes.status, errBody);

      // Give a friendlier message for insufficient_quota while preserving original details
      if (errBody && errBody.error && errBody.error.type === 'insufficient_quota') {
        const userMessage = 'Quota exceeded: please check your OpenAI billing and plan details.';
        return res.status(openaiRes.status).json({ error: { message: userMessage, type: errBody.error.type, original: errBody.error } });
      }

      return res.status(openaiRes.status).json({ error: errBody.error || errBody });
    }

    const data = await openaiRes.json();
    // Extract assistant reply
    const assistantMessage = data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message : null;

    res.json({ assistant: assistantMessage, raw: data });
  } catch (err) {
    console.error('Error in /api/chat:', err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

// Status endpoint to check OPENAI_API_KEY presence and ASCII-safety
app.get('/api/status', (req, res) => {
  // Indicate whether server will call real OpenAI or run in mock mode.
  const wantLive = process.env.USE_OPENAI === '1';
  const mockGlobally = process.env.MOCK_OPENAI === '1';

  if (!wantLive) {
    return res.status(200).json({ ok: false, message: 'Server running in mock mode (USE_OPENAI not set). No credits will be used.', mock: true, mockGlobally });
  }

  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return res.status(200).json({ ok: false, message: 'USE_OPENAI=1 but OPENAI_API_KEY is not set on server' });
  }

  const authValue = `Bearer ${key}`;
  const nonAscii = [];
  for (let i = 0; i < authValue.length; i++) {
    const code = authValue.charCodeAt(i);
    if (code > 255) nonAscii.push({ index: i, ord: code });
  }
  if (nonAscii.length) {
    return res.status(200).json({ ok: false, message: 'Non-ASCII characters found in OPENAI_API_KEY/Authorization header', details: nonAscii });
  }

  return res.status(200).json({ ok: true, message: 'OPENAI_API_KEY present and ASCII-safe', mock: false });
});

// Fallback to index.html for SPA routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  const wantLive = process.env.USE_OPENAI === '1';
  const mockGlobally = process.env.MOCK_OPENAI === '1';
  console.log(`Server listening on http://localhost:${PORT}`);
  console.log(`Mode: ${wantLive ? 'LIVE' : 'MOCK'}${mockGlobally ? ' (MOCK_OPENAI=1 set)' : ''}`);
  if (!wantLive) console.log('Default mock mode active — no OpenAI credits will be used unless you start with USE_OPENAI=1');
});
