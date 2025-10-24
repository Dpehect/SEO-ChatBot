# Simple Chatbot (ChatGPT-like example)

This project is a minimal ChatGPT-like web app. An Express server serves a static frontend and the `/api/chat` endpoint proxies requests to the OpenAI Chat Completions API.

Features
- Simple chat UI (HTML/JS/CSS)
- Express backend `/api/chat` proxy (requires `OPENAI_API_KEY`)

Installation
1. Node >= 18 must be installed.
2. From the project root:

```bash
npm install
```

3. Set your environment variable (copy `.env.example` to `.env` and add your real key, or set it in your environment):

**Important:** Never commit your `.env` file or API key to GitHub or any public repository. The `.env` file is already listed in `.gitignore` so it will not be uploaded.

See `.env.example` for the required format:
```
OPENAI_API_KEY=sk-xxxxxxx
```

4. Start the server:

```bash
npm start
```

5. Open your browser at http://localhost:3000.


Notes
- Do not share your API key. This example is for learning and small projects; for production you need robust authentication and quota controls.
- By default this project is configured to AVOID using the real OpenAI API so you don't accidentally consume credits. The server will run in mock mode unless you explicitly enable live mode.

Avoiding charges (default behavior)
- Default: mock mode (no credits used). You can start normally with:

```bash
npm start
```

- In mock mode the server returns canned responses and will not call OpenAI.

Enabling real OpenAI calls (only if you want to use credits)
- To enable live calls set `USE_OPENAI=1` and make sure `OPENAI_API_KEY` is set in your `.env` or environment. Example:

```bash
USE_OPENAI=1 OPENAI_API_KEY=sk-... npm start
```

- For development with automatic restarts:

```bash
npm run dev:live
```

For one-off mock requests you can also append `?mock=1` to `/api/chat` to force a canned response regardless of server mode.

Contributions
- You can improve error handling, add streaming responses, or add user authentication.
