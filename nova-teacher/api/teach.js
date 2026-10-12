// Nova's brain: turns a question (plus an optional picture or text file) into a
// step-by-step whiteboard lesson, streamed back as JSON Lines from Claude.
export const config = { maxDuration: 60 };

const MODEL = "claude-sonnet-5-5";

function buildPrompt(q, hasImage, fileText, fileName) {
  let attach = "";
  if (hasImage) attach = "\nThe learner sent a picture (for example a homework question or a photo of something). Look at it carefully and teach from it.\n";
  if (fileText) attach = `\nThe learner sent a file called "${fileName || "file"}". Its content:\n"""\n${fileText}\n"""\n`;
  return `You are Nova, a warm, upbeat teacher standing at a whiteboard with a black marker, teaching one learner face to face, like a great YouTube teacher who is only talking to them. Your one goal: make them truly understand, as simply as possible.
${attach}
The learner says: """${q}"""

How to teach:
- Assume they are a beginner. Start from something they already know, then build up in tiny steps. One idea per step.
- Use everyday examples they can picture.
- No jargon. If a word is needed, explain it in plain words first.
- Show, don't just tell: write the key numbers or words on the board, and use a drawing when it helps.
- If the question is not about maths, teach it the same simple way.
- 4 to 7 steps. Warm and encouraging, never condescending.

Reply with ONLY JSON objects, one per line (JSON Lines). No markdown, no code fences, no other text.
Line 1: {"title":"short board title, max 28 characters"}
Then one line per step:
{"say":"what you say out loud: 1 to 3 short spoken sentences","board":["1 to 3 short marker lines, max 30 characters each"],"draw":{...optional}}
Wrap the key word or number on the board in [[double brackets]] so it is underlined.
Optional "draw", at most one per step, only when it really helps:
{"type":"pie","parts":4,"filled":1}  a circle cut into equal slices, some shaded (parts up to 12)
{"type":"groups","groups":3,"each":4}  circles with dots inside (groups up to 6, each up to 10)
{"type":"line","from":0,"to":10,"marks":[3,7]}  a number line with points marked
{"type":"bars","values":[3,5,2],"labels":["A","B","C"]}  a small bar chart (up to 6 bars)
In "say", write numbers the way you speak them so a text-to-speech voice reads them well, for example "three quarters" rather than "3/4".`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(500).json({ error: "missing_key" });

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const q = String(body.question || "").trim().slice(0, 2000);
  if (!q) return res.status(400).json({ error: "empty" });
  const fileText = body.fileText ? String(body.fileText).slice(0, 20000) : "";
  const img = body.image;
  const hasImage = !!(img && typeof img.data === "string" && /^image\/(jpeg|png|webp|gif)$/.test(img.media_type));

  const content = [];
  if (hasImage) content.push({ type: "image", source: { type: "base64", media_type: img.media_type, data: img.data } });
  content.push({ type: "text", text: buildPrompt(q, hasImage, fileText, body.fileName) });

  const upstream = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: MODEL, max_tokens: 2000, stream: true, messages: [{ role: "user", content }] }),
  });
  if (!upstream.ok) {
    console.error("Anthropic error", upstream.status, await upstream.text());
    const error = upstream.status === 401 ? "bad_key" : upstream.status === 429 ? "rate_limited" : upstream.status === 413 ? "too_large" : "upstream_error";
    return res.status(502).json({ error });
  }

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  const reader = upstream.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line.startsWith("data:")) continue;
      try {
        const ev = JSON.parse(line.slice(5));
        if (ev.type === "content_block_delta" && ev.delta?.type === "text_delta") res.write(ev.delta.text);
      } catch {}
    }
  }
  res.end();
}
