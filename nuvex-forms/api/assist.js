// Vercel serverless function: drafts forms from a one-sentence description, and suggests options for a question.
// POST /api/assist { action: "draft", description } | { action: "options", question, context }
// Needs ANTHROPIC_API_KEY. Without it the app falls back to its built-in topic library.
import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-opus-5-5";
const BETAS = ["server-side-fallback-2026-07-01"];
const clip = (s, n) => String(s ?? "").slice(0, n);
const TYPES = ["short", "long", "choice", "multi", "dropdown", "file", "rating", "yesno", "date"];

const DRAFT_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    intro: { type: "string" },
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: { type: "string", enum: TYPES },
          text: { type: "string" },
          options: { type: "array", items: { type: "string" } },
          required: { type: "boolean" },
        },
        required: ["type", "text", "options", "required"],
        additionalProperties: false,
      },
    },
  },
  required: ["title", "intro", "questions"],
  additionalProperties: false,
};

const OPTIONS_SCHEMA = {
  type: "object",
  properties: { options: { type: "array", items: { type: "string" } } },
  required: ["options"],
  additionalProperties: false,
};

async function ask(client, { system, user, schema, effort, maxTokens }) {
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    betas: BETAS,
    fallbacks: "default",
    system,
    output_config: { effort, format: { type: "json_schema", schema } },
    messages: [{ role: "user", content: user }],
  });
  if (response.stop_reason === "refusal") throw Object.assign(new Error("declined"), { status: 422 });
  if (response.stop_reason === "max_tokens") throw Object.assign(new Error("truncated"), { status: 502 });
  return JSON.parse(response.content.find((b) => b.type === "text")?.text);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: "AI is not configured on this deployment." });
  let body;
  try { body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {}; }
  catch { return res.status(400).json({ error: "Invalid JSON" }); }
  const client = new Anthropic();

  try {
    if (body.action === "draft") {
      const description = clip(body.description, 600).trim();
      if (!description) return res.status(400).json({ error: "Describe the form first." });
      const result = await ask(client, {
        effort: "low",
        maxTokens: 8000,
        schema: DRAFT_SCHEMA,
        system: `You draft application and sign-up forms, like a Google Form, from a one-sentence description.
Write plain, friendly questions an ordinary person understands. Rules:
- Start with the basics people always ask: "Full name", "Email", "Phone or WhatsApp number" (all required), then
  "Which city or town do you live in?" when location matters. Skip the basics only for anonymous surveys or feedback.
- If the form is about children or under-18s, add "Date of birth" and a parent or guardian's name and phone number.
- Then 6 to 10 questions that anyone running this kind of form would expect to ask. For a football tryout that means
  position on the field, stronger foot, years playing, current club and so on. Order them from easy to thoughtful.
- Types: short (one line), long (paragraph), choice (pick one), multi (pick several), dropdown (pick one from a long
  list), file (upload, e.g. CV or transcript), rating (1-5), yesno, date. Use choice/multi/dropdown whenever the
  answers are predictable, and give 3-7 sensible options; use "options": [] for every other type.
- Mark required only what the organiser truly needs. Do not ask about religion, ethnicity, health or other sensitive
  details unless the description clearly needs it (e.g. medical conditions for a sports tryout).
- title: a short clear form title (not the whole description). intro: one welcoming sentence.`,
        user: `Describe: ${description}`,
      });
      return res.status(200).json({
        title: clip(result.title, 120),
        intro: clip(result.intro, 300),
        questions: (result.questions || []).slice(0, 25).map((q) => ({
          type: TYPES.includes(q.type) ? q.type : "short",
          text: clip(q.text, 300),
          options: (q.options || []).slice(0, 15).map((o) => clip(o, 120)),
          required: !!q.required,
        })),
      });
    }

    if (body.action === "options") {
      const result = await ask(client, {
        effort: "low",
        maxTokens: 2000,
        schema: OPTIONS_SCHEMA,
        system: `You suggest answer options for one multiple-choice question on a form. Give 3 to 8 short, distinct,
commonly expected options in a natural order. Include "Other" only when the list can't cover everyone.`,
        user: `Form: ${clip(body.context, 300)}\nQuestion: ${clip(body.question, 300)}`,
      });
      return res.status(200).json({ options: (result.options || []).slice(0, 12).map((o) => clip(o, 120)) });
    }

    return res.status(400).json({ error: "Unknown action" });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) return res.status(429).json({ error: "Busy, try again shortly." });
    if (err instanceof Anthropic.AuthenticationError) return res.status(503).json({ error: "AI key is invalid." });
    if (err instanceof Anthropic.APIError) return res.status(502).json({ error: "AI service error." });
    if (err instanceof SyntaxError) return res.status(502).json({ error: "Unexpected AI response." });
    return res.status(err.status || 500).json({ error: err.message || "Failed" });
  }
}
