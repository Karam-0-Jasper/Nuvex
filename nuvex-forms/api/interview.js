// Vercel serverless function: the AI interviewer's brain.
// POST /api/interview  { action: "followup" | "evaluate", ... }
// Requires ANTHROPIC_API_KEY in the Vercel project's environment variables. The key never reaches the browser.
import { createHmac, timingSafeEqual } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-opus-5-5";
// If a request is declined by a safety classifier, the API re-runs it on Anthropic's recommended fallback model.
const BETAS = ["server-side-fallback-2026-07-01"];

const LIMITS = { text: 4000, title: 200, questions: 20 };
const clip = (s, n) => String(s ?? "").slice(0, n);

const FAIRNESS = `Judge only what the candidate said: relevance, specificity, evidence, reasoning and structure.
Never consider or comment on accent, pronunciation, fluency, grammar, spelling, word choice that reflects a first language,
appearance, age, gender, ethnicity, nationality, disability, religion, or any other personal characteristic.
Answers are speech-to-text transcripts: ignore transcription errors, missing punctuation and filler words.`;

const FOLLOWUP_SCHEMA = {
  type: "object",
  properties: {
    ask: { type: "boolean" },
    question: { type: "string" },
  },
  required: ["ask", "question"],
  additionalProperties: false,
};

const EVALUATION_SCHEMA = {
  type: "object",
  properties: {
    overall: { type: "integer", minimum: 1, maximum: 5 },
    summary: { type: "string" },
    strengths: { type: "array", items: { type: "string" } },
    gaps: { type: "array", items: { type: "string" } },
    answers: {
      type: "array",
      items: {
        type: "object",
        properties: {
          index: { type: "integer" },
          score: { type: "integer", minimum: 1, maximum: 5 },
          note: { type: "string" },
        },
        required: ["index", "score", "note"],
        additionalProperties: false,
      },
    },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
  },
  required: ["overall", "summary", "strengths", "gaps", "answers", "confidence"],
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
  const text = response.content.find((b) => b.type === "text")?.text;
  return JSON.parse(text);
}

// Seals a finished interview so later edits to the shared results link are detectable.
const sealKey = () => process.env.INTERVIEW_SECRET || process.env.ANTHROPIC_API_KEY || "";
const sign = (payload) => createHmac("sha256", sealKey()).update(JSON.stringify(payload)).digest("base64url");

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  let body;
  try { body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {}; }
  catch { return res.status(400).json({ error: "Invalid JSON" }); }

  if (body.action === "seal" || body.action === "verify") {
    if (!sealKey()) return res.status(503).json({ error: "Sealing is not configured on this deployment." });
    if (JSON.stringify(body.payload ?? null).length > 200000) return res.status(413).json({ error: "Too large" });
    const sig = sign(body.payload ?? null);
    if (body.action === "seal") return res.status(200).json({ seal: sig });
    const given = Buffer.from(String(body.seal || ""));
    const want = Buffer.from(sig);
    return res.status(200).json({ valid: given.length === want.length && timingSafeEqual(given, want) });
  }

  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: "AI is not configured on this deployment." });
  const role = clip(body.title, LIMITS.title);
  const client = new Anthropic();

  try {
    if (body.action === "followup") {
      const result = await ask(client, {
        effort: "low",
        maxTokens: 2000,
        schema: FOLLOWUP_SCHEMA,
        system: `You are a fair, friendly interviewer running a timed screening interview for: ${role || "a role"}.
After each answer you may ask ONE short follow-up question (under 25 words) that asks for a concrete example, a result,
or the candidate's own part in something they mentioned. Set ask=false when the answer is already specific, is very short
or off-topic (move on rather than press), or when a follow-up would only repeat the question. Never ask about personal
characteristics, health, family, religion, nationality or anything unrelated to doing the job. ${FAIRNESS}`,
        user: `Question: ${clip(body.question, LIMITS.text)}\n\nCandidate's answer (transcript): ${clip(body.answer, LIMITS.text) || "(no answer)"}`,
      });
      return res.status(200).json({ ask: !!result.ask && !!result.question?.trim(), question: clip(result.question, 300) });
    }

    if (body.action === "evaluate") {
      const items = (Array.isArray(body.items) ? body.items : []).slice(0, LIMITS.questions);
      const transcript = items
        .map((it, i) => `[${i}] Q: ${clip(it.question, 600)}\n` +
          (it.expect ? `What the hiring team wants to hear: ${clip(it.expect, 1000)}\n` : "") +
          `A: ${clip(it.answer, LIMITS.text) || "(no answer)"}`)
        .join("\n\n");
      const result = await ask(client, {
        effort: "medium",
        maxTokens: 8000,
        schema: EVALUATION_SCHEMA,
        system: `You review screening-interview transcripts for a hiring team. The role: ${role || "not specified"}.
Where the hiring team wrote what they want to hear, score the answer against that: 5 = covers it with specifics,
3 = partly covers it or stays general, 1 = misses it. Where nothing was written (and for follow-ups), score 1-5 on relevance,
specificity and evidence. Give a one-sentence note saying what was covered or missing. Then give an overall 1-5, a two-sentence summary, up to
three strengths and up to three gaps worth exploring in a human interview. You are a decision aid, not the decision-maker:
do not recommend hiring or rejecting. Set confidence to low when answers are short or few. ${FAIRNESS}`,
        user: `Interview transcript:\n\n${transcript}`,
      });
      return res.status(200).json(result);
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
