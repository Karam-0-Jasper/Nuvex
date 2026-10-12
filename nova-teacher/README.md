# Nova — whiteboard teacher

A black-and-white teacher who stands at a whiteboard and explains any question
step by step, out loud, in the simplest words. Type, speak, or send a picture
or text file.

- `index.html` — the whole page (board, Nova, message bar, voice).
- `api/teach.js` — Vercel serverless function that asks Claude for the lesson.

## Deploy on Vercel
1. New project → import this repo → set **Root Directory** to `nova-teacher`.
2. Settings → Environment Variables → add `ANTHROPIC_API_KEY`.
3. Deploy.

Nova's voice uses the browser's built-in speech. On iPhone, turn off silent
mode and tap once on the page before he speaks.
