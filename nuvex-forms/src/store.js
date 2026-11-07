// Saving things on the device, and packing forms/answers into shareable links.
import { norm } from "./voice.js";

const read = (key, fallback) => {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
};
const write = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage full or blocked */ }
};

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

// ---------- Links ----------
// The whole form travels inside the link, so no account or server is needed to share one.

export function pack(obj) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function unpack(str) {
  try {
    let s = decodeURIComponent(str).replace(/-/g, "+").replace(/_/g, "/");
    while (s.length % 4) s += "=";
    const bin = atob(s);
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
  } catch {
    return null;
  }
}

const base = () => location.origin + location.pathname;

/** Keep only what someone filling the form needs. */
export function publicForm(form) {
  return {
    v: 1,
    id: form.id,
    title: form.title,
    intro: form.intro || "",
    owner: form.owner || {},
    // Interview questions travel without the owner's expected answers, so applicants can't read them.
    ...(form.interview?.enabled && form.interview.questions?.some((q) => q.text?.trim())
      ? { interview: { enabled: true, seconds: form.interview.seconds || 120, questions: form.interview.questions.filter((q) => q.text?.trim()).map(({ id, text }) => ({ id, text: text.trim() })) } }
      : {}),
    questions: form.questions.map(({ id, type, text, hint, options, required, autofill, starters, other, shuffle }) => {
      const q = { id, type, text };
      if (other) q.other = true;
      if (shuffle) q.shuffle = true;
      if (hint) q.hint = hint;
      if (options?.length) q.options = options;
      if (required) q.required = true;
      if (autofill) q.autofill = autofill;
      if (starters?.length) q.starters = starters;
      return q;
    }),
  };
}

export const formLink = (form) => `${base()}#f=${pack(publicForm(form))}`;
export const responseLink = (response) => `${base()}#r=${pack(response)}`;

// ---------- My forms ----------

export const loadForms = () => read("nf.forms", []);
export const getForm = (id) => loadForms().find((f) => f.id === id);
export function saveForm(form) {
  const forms = loadForms().filter((f) => f.id !== form.id);
  write("nf.forms", [{ ...form, updated: Date.now() }, ...forms]);
}
export const deleteForm = (id) => write("nf.forms", loadForms().filter((f) => f.id !== id));

// ---------- Answers I received ----------

export const loadInbox = () => read("nf.inbox", []);
/** Returns true if it was new. */
export function addToInbox(response) {
  const inbox = loadInbox();
  if (inbox.some((r) => r.id === response.id)) return false;
  write("nf.inbox", [{ ...response, received: Date.now() }, ...inbox]);
  return true;
}
export function updateInbox(id, patch) {
  write("nf.inbox", loadInbox().map((r) => (r.id === id ? { ...r, ...patch } : r)));
}
export const removeFromInbox = (id) => write("nf.inbox", loadInbox().filter((r) => r.id !== id));

// ---------- My info (reused to fill forms for me) ----------

export const PROFILE_FIELDS = [
  { key: "name", label: "Full name", type: "text", auto: "name" },
  { key: "email", label: "Email", type: "email", auto: "email" },
  { key: "phone", label: "Phone / WhatsApp", type: "tel", auto: "tel" },
  { key: "location", label: "City / where you live", type: "text", auto: "address-level2" },
  { key: "link", label: "Website, portfolio or LinkedIn", type: "url", auto: "url" },
];

export const loadProfile = () => read("nf.profile", {});
export const saveProfile = (p) => write("nf.profile", p);

/** Guess if a question is asking for one of the "My info" fields. */
export function guessAutofill(text) {
  const t = norm(text);
  // Someone else's details (a parent, an emergency contact, a referee) must never be filled with the applicant's own.
  if (/\b(parent|guardian|emergency|reference|referee|next of kin|coach|manager s|employer s)\b/.test(t)) return "";
  if (/\b(e ?mail)\b/.test(t)) return "email";
  if (/\b(phone|whatsapp|mobile|cell|contact number)\b/.test(t)) return "phone";
  if (/\b(website|portfolio|linkedin|instagram|link)\b/.test(t)) return "link";
  if (/\b(city|location|where do you live|where are you based|address|town)\b/.test(t)) return "location";
  if (/\b(full name|your name|name)\b/.test(t) && !/\b(business|company|brand|school|reference|project)\b/.test(t)) return "name";
  return "";
}

// ---------- Answer bank (answers I gave before, to reuse) ----------

const STOP = new Set("a an the you your yours to of in on for and or is are do does did what why how when where who which with about tell us me we our this that it be can would will have has from at as".split(" "));
const keywords = (s) => new Set(norm(s).split(" ").filter((w) => w.length > 2 && !STOP.has(w)));

export const loadBank = () => read("nf.bank", []);
export const saveBank = (b) => write("nf.bank", b);

export function rememberAnswers(pairs) {
  let bank = loadBank();
  for (const { question, answer } of pairs) {
    if (!answer || answer.length < 15) continue;
    bank = bank.filter((b) => norm(b.question) !== norm(question));
    bank.unshift({ question, answer, at: Date.now() });
  }
  saveBank(bank.slice(0, 150));
}

/** The best earlier answer to a similar question, if any. */
export function findPastAnswer(question) {
  const q = keywords(question);
  if (!q.size) return null;
  let best = null;
  let bestScore = 0;
  for (const b of loadBank()) {
    const k = keywords(b.question);
    const shared = [...q].filter((w) => k.has(w)).length;
    const score = shared / Math.max(q.size, k.size);
    if (score > bestScore) { bestScore = score; best = b; }
  }
  return bestScore >= 0.5 ? best : null;
}

// ---------- Drafts (so nothing is lost if the page closes) ----------

export const loadDraft = (formId) => read("nf.draft." + formId, null);
export const saveDraft = (formId, answers) => write("nf.draft." + formId, answers);
export const clearDraft = (formId) => { try { localStorage.removeItem("nf.draft." + formId); } catch { /* ignore */ } };

// ---------- Exports ----------

export function toCSV(responses) {
  const questions = [];
  for (const r of responses) for (const [q] of r.answers) if (!questions.includes(q)) questions.push(q);
  const cell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = [["Sent", ...questions].map(cell).join(",")];
  for (const r of responses) {
    const map = new Map(r.answers);
    rows.push([new Date(r.at).toLocaleString(), ...questions.map((q) => map.get(q) ?? "")].map(cell).join(","));
  }
  return rows.join("\n");
}

export function download(filename, text, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function answersAsText(title, answers) {
  return `${title}\n\n` + answers.map(([q, a], i) => `${i + 1}. ${q}\n${a || "—"}`).join("\n\n");
}
