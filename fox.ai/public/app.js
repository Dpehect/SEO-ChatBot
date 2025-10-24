const chatEl = document.getElementById('chat');
const form = document.getElementById('chat-form');
const input = document.getElementById('input');

let messages = [
  { role: 'system', content: 'You are a helpful assistant that speaks English.' }
];

function appendMessage(role, text) {
  const el = document.createElement('div');
  el.className = 'message ' + role;
  el.textContent = text;
  chatEl.appendChild(el);
  chatEl.scrollTop = chatEl.scrollHeight;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;

  appendMessage('user', text);
  messages.push({ role: 'user', content: text });
  input.value = '';

  appendMessage('assistant', 'Typing...');

  try {
    // Get selected AI model
    const model = document.getElementById('ai-select').value;
    // Always use mock mode, but send model to backend for personality
    const res = await fetch(`/api/chat?mock=1&model=${encodeURIComponent(model)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, model })
    });

    const data = await res.json();
    // remove the 'Typing...' placeholder
    const last = chatEl.querySelector('.message.assistant:last-child');
    if (last && last.textContent === 'Typing...') last.remove();

    if (!res.ok) {
      // Prefer a structured message if present
      const errMsg = data && data.error && (data.error.message || data.error) ? (data.error.message || JSON.stringify(data.error)) : 'Server error';
      appendMessage('assistant', 'Error: ' + errMsg);
      return;
    }

    const assistant = data.assistant;
    if (assistant && assistant.content) {
      appendMessage('assistant', assistant.content);
      messages.push({ role: 'assistant', content: assistant.content });
    } else {
      appendMessage('assistant', 'Sorry, no reply received.');
    }
  } catch (err) {
    console.error(err);
    appendMessage('assistant', 'Request failed: ' + err.message);
  }
});

// Fetch server status and update footer
async function updateServerStatus() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();
    const el = document.getElementById('status');
    const banner = document.getElementById('mode-banner');
    if (!el) return;
    if (res.ok && data.ok && data.mock === false) {
      el.textContent = 'Server live: will call OpenAI (ensure you want this)';
      el.style.color = 'var(--muted)';
      if (banner) banner.textContent = 'Mode: LIVE (server will call OpenAI)';
    } else {
      // Prefer friendly message from server if present
      const msg = data && (data.message || (data.error && (data.error.message || JSON.stringify(data.error)))) ? (data.message || (data.error && (data.error.message || JSON.stringify(data.error)))) : 'Server in mock/no-key mode';
      el.textContent = msg;
      el.style.color = '#fca5a5';
      if (banner) banner.textContent = 'Mode: MOCK (no credits used)';
    }
  } catch (err) {
    const el = document.getElementById('status');
    if (el) {
      el.textContent = 'Unable to reach server status';
      el.style.color = '#fca5a5';
    }
  }
}

updateServerStatus();
