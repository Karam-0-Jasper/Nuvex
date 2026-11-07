// "Describe your form" — turns one sentence into a ready form.
// Works offline from a built-in topic library; when the AI is switched on (api/assist.js), Claude drafts it instead
// and can handle any topic. Either way the result is ordinary questions the owner can edit.
import { guessAutofill, uid } from "./store.js";
import { norm } from "./voice.js";
import { HAS_OPTIONS, TYPES } from "./templates.js";

// ---------- The basics every form asks ----------

const BASICS = [
  { type: "short", text: "Full name", required: true },
  { type: "short", text: "Email", required: true },
  { type: "short", text: "Phone or WhatsApp number", required: true },
  { type: "short", text: "Which city or town do you live in?" },
];

const MINOR = [
  { type: "date", text: "Date of birth", required: true },
  { type: "short", text: "Parent or guardian's name", required: true },
  { type: "short", text: "Parent or guardian's phone number", required: true },
];

// ---------- Topic library ----------
// keywords: words that point to the topic. questions: what forms on this topic nearly always ask.

const YEARS = ["Less than 1 year", "1–2 years", "3–5 years", "More than 5 years"];
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export const TOPICS = [
  {
    id: "football",
    label: "Football",
    keywords: ["football", "soccer", "futbol", "footballer", "striker", "goalkeeper", "tryout", "tryouts", "academy", "fc", "league", "pitch"],
    intro: "Tell us about yourself as a player. It takes about five minutes.",
    questions: [
      { type: "date", text: "Date of birth", required: true },
      { type: "choice", text: "What is your position on the field?", required: true, options: ["Goalkeeper", "Defender", "Midfielder", "Forward"] },
      { type: "choice", text: "Which is your stronger foot?", options: ["Right", "Left", "Both"] },
      { type: "choice", text: "How long have you been playing?", options: YEARS },
      { type: "short", text: "Current or most recent club or team" },
      { type: "choice", text: "What level have you played at?", options: ["School / community", "Local league", "Regional / county", "National / professional"] },
      { type: "short", text: "Height (cm)" },
      { type: "long", text: "Tell us about your playing experience and achievements." },
      { type: "short", text: "Link to a highlight video (YouTube, TikTok, Drive…)" },
      { type: "multi", text: "Which days can you train?", options: DAYS },
      { type: "yesno", text: "Do you have any injuries or medical conditions we should know about?" },
    ],
  },
  {
    id: "basketball",
    label: "Basketball",
    keywords: ["basketball", "hoops", "nba", "point guard", "dunk", "court"],
    intro: "Tell us about your game. It takes about five minutes.",
    questions: [
      { type: "date", text: "Date of birth", required: true },
      { type: "choice", text: "What position do you play?", required: true, options: ["Point guard", "Shooting guard", "Small forward", "Power forward", "Center"] },
      { type: "short", text: "Height (cm)" },
      { type: "choice", text: "How long have you been playing?", options: YEARS },
      { type: "short", text: "Current or most recent team" },
      { type: "choice", text: "Which hand do you shoot with?", options: ["Right", "Left", "Both"] },
      { type: "long", text: "What are your strengths on the court?" },
      { type: "short", text: "Link to a highlight video" },
      { type: "multi", text: "Which days can you practise?", options: DAYS },
      { type: "yesno", text: "Do you have any injuries or medical conditions we should know about?" },
    ],
  },
  {
    id: "sport",
    label: "Sports",
    keywords: ["sport", "sports", "team", "athlete", "athletics", "volleyball", "tennis", "track", "running", "marathon", "boxing", "tournament", "player"],
    intro: "Tell us about yourself as an athlete.",
    questions: [
      { type: "date", text: "Date of birth", required: true },
      { type: "short", text: "Which sport or event?" },
      { type: "choice", text: "How long have you been competing?", options: YEARS },
      { type: "choice", text: "What level do you compete at?", options: ["Beginner", "Intermediate", "Advanced", "Professional"] },
      { type: "short", text: "Current club or team" },
      { type: "long", text: "Tell us about your achievements." },
      { type: "yesno", text: "Do you have any injuries or medical conditions we should know about?" },
    ],
  },
  {
    id: "job",
    label: "Job application",
    keywords: ["job", "jobs", "hiring", "hire", "vacancy", "position", "role", "career", "recruit", "recruitment", "employment", "apply", "applicant", "staff", "internship", "intern", "editor", "designer", "developer", "manager", "assistant", "cashier", "driver", "sales"],
    intro: "Thanks for your interest. This takes about five minutes.",
    questions: [
      { type: "short", text: "Which role are you applying for?", required: true },
      { type: "file", text: "Upload your CV", hint: "PDF, Word or image, up to 10 MB." },
      { type: "choice", text: "How much relevant experience do you have?", options: YEARS },
      { type: "long", text: "Tell us about your most recent job or project." },
      { type: "long", text: "Why do you want to work with us?" },
      { type: "short", text: "Link to your portfolio, LinkedIn or past work" },
      { type: "choice", text: "What kind of work are you looking for?", options: ["Full-time", "Part-time", "Contract / freelance", "Internship"] },
      { type: "date", text: "When could you start?" },
      { type: "short", text: "What pay are you expecting?" },
    ],
  },
  {
    id: "school",
    label: "School / scholarship",
    keywords: ["school", "scholarship", "admission", "admissions", "student", "students", "university", "college", "enrol", "enroll", "enrolment", "enrollment", "grant", "bursary", "class", "grade"],
    intro: "Take your time. You can type or speak each answer.",
    questions: [
      { type: "date", text: "Date of birth", required: true },
      { type: "short", text: "Current or most recent school", required: true },
      { type: "choice", text: "What level are you at?", options: ["Primary", "Junior high", "Senior high", "University", "Graduate"] },
      { type: "short", text: "What do you want to study?" },
      { type: "short", text: "Your most recent grades or GPA" },
      { type: "file", text: "Upload your latest report card or transcript" },
      { type: "long", text: "Why should we choose you?", required: true },
      { type: "long", text: "Tell us about a challenge you've overcome." },
    ],
  },
  {
    id: "event",
    label: "Event registration",
    keywords: ["event", "rsvp", "party", "wedding", "conference", "summit", "launch", "concert", "festival", "gala", "meetup", "registration", "register", "ticket", "dinner", "birthday", "graduation"],
    intro: "Register in under a minute.",
    questions: [
      { type: "yesno", text: "Will you attend?", required: true },
      { type: "choice", text: "How many people are coming with you?", options: ["Just me", "+1", "+2", "+3 or more"] },
      { type: "choice", text: "Any dietary needs?", options: ["None", "Vegetarian", "Vegan", "Halal", "Allergies (tell us below)"] },
      { type: "short", text: "Anything else we should know?" },
      { type: "choice", text: "How did you hear about this event?", options: ["Friend", "Instagram", "WhatsApp", "Facebook", "Other"] },
    ],
  },
  {
    id: "training",
    label: "Course / workshop",
    keywords: ["course", "workshop", "training", "bootcamp", "class", "lesson", "lessons", "masterclass", "seminar", "webinar", "tutorial", "coaching", "mentorship"],
    intro: "Sign up below. It takes two minutes.",
    questions: [
      { type: "choice", text: "What is your experience level?", options: ["Complete beginner", "Some experience", "Intermediate", "Advanced"] },
      { type: "long", text: "What do you hope to learn?" },
      { type: "yesno", text: "Do you have a laptop you can bring?" },
      { type: "choice", text: "Which session suits you?", options: ["Weekday mornings", "Weekday evenings", "Weekends"] },
      { type: "choice", text: "How did you hear about us?", options: ["Friend", "Instagram", "WhatsApp", "Facebook", "Other"] },
    ],
  },
  {
    id: "volunteer",
    label: "Volunteer sign-up",
    keywords: ["volunteer", "volunteers", "volunteering", "charity", "ngo", "outreach", "community", "donation", "cleanup", "help out"],
    intro: "Thank you for wanting to help.",
    questions: [
      { type: "multi", text: "Which areas would you like to help with?", options: ["Events", "Teaching / mentoring", "Logistics", "Social media", "Fundraising"] },
      { type: "multi", text: "Which days are you available?", options: DAYS },
      { type: "long", text: "What skills or experience can you bring?" },
      { type: "yesno", text: "Have you volunteered with us before?" },
      { type: "short", text: "Emergency contact name and phone number" },
    ],
  },
  {
    id: "creative",
    label: "Client brief",
    keywords: ["client", "brief", "brand", "branding", "logo", "photoshoot", "photography", "photo", "video", "videography", "shoot", "design", "marketing", "content", "campaign", "agency", "studio", "commercial"],
    intro: "Tell us about your brand and what you need.",
    questions: [
      { type: "short", text: "Business or brand name", required: true },
      { type: "multi", text: "What do you need?", required: true, options: ["Photos", "Video editing", "Brand story", "Social media", "Logo / design", "Ads"] },
      { type: "long", text: "Describe your brand and your customers." },
      { type: "short", text: "Links to work you like (any brand)" },
      { type: "choice", text: "What's your budget?", options: ["Under $100", "$100 – $300", "$300 – $1,000", "$1,000+", "Not sure yet"] },
      { type: "date", text: "When do you need it?" },
    ],
  },
  {
    id: "audition",
    label: "Audition",
    keywords: ["audition", "auditions", "talent", "singer", "singing", "dancer", "dance", "music", "musician", "band", "choir", "actor", "acting", "model", "modelling", "modeling", "artist", "rapper"],
    intro: "Show us what you can do.",
    questions: [
      { type: "date", text: "Date of birth", required: true },
      { type: "choice", text: "What are you auditioning as?", required: true, options: ["Singer", "Dancer", "Musician", "Actor", "Model", "Other"] },
      { type: "choice", text: "How long have you been performing?", options: YEARS },
      { type: "short", text: "Link to a video of your performance" },
      { type: "long", text: "Tell us about past performances or training." },
      { type: "multi", text: "Which days can you rehearse?", options: DAYS },
    ],
  },
  {
    id: "feedback",
    label: "Feedback survey",
    keywords: ["feedback", "survey", "review", "satisfaction", "opinion", "poll", "rate", "rating", "customers", "experience with"],
    intro: "Your feedback helps us improve. It takes a minute.",
    basics: false,
    questions: [
      { type: "rating", text: "How satisfied are you overall?", required: true },
      { type: "long", text: "What did you like most?" },
      { type: "long", text: "What could we do better?" },
      { type: "yesno", text: "Would you recommend us to a friend?" },
      { type: "short", text: "Your name (optional)" },
    ],
  },
  {
    id: "membership",
    label: "Membership",
    keywords: ["membership", "member", "members", "join", "club", "church", "association", "society", "union", "fellowship", "group", "gym"],
    intro: "Welcome. Fill this in to become a member.",
    questions: [
      { type: "date", text: "Date of birth" },
      { type: "choice", text: "Gender", options: ["Female", "Male", "Prefer not to say"] },
      { type: "short", text: "Occupation" },
      { type: "multi", text: "Which activities interest you?", options: ["Meetings", "Events", "Volunteering", "Leadership", "Social"] },
      { type: "choice", text: "How did you hear about us?", options: ["Friend or family", "Social media", "Event", "Other"] },
      { type: "short", text: "Emergency contact name and phone number" },
    ],
  },
];

const GENERIC = [
  { type: "long", text: "Tell us a little about yourself." },
  { type: "long", text: "Why are you interested?" },
  { type: "choice", text: "How did you hear about us?", options: ["Friend", "Instagram", "WhatsApp", "Facebook", "Other"] },
  { type: "short", text: "Anything else you'd like us to know?" },
];

// ---------- Matching ----------

const words = (s) => ` ${norm(s)} `;

/** Topics that match a description, best first. */
export function matchTopics(description) {
  const d = words(description);
  return TOPICS
    .map((t) => ({ t, score: t.keywords.reduce((n, k) => n + (d.includes(` ${norm(k)} `) ? (k.includes(" ") ? 2 : 1) : 0), 0) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.t);
}

const isMinor = (description) => /\b(u ?1[0-9]|under ?1[0-9]|under 18|kids?|children|child|youth|junior|juniors|teen|teens|teenagers?|minors?|boys|girls)\b/.test(norm(description));

function titleFrom(description) {
  const t = String(description).trim().replace(/\s+/g, " ").replace(/[.!]+$/, "");
  const short = t.length > 70 ? t.slice(0, 67).replace(/\s+\S*$/, "") + "…" : t;
  return short.charAt(0).toUpperCase() + short.slice(1);
}

const same = (a, b) => {
  const x = norm(a), y = norm(b);
  if (x === y) return true;
  const ka = new Set(x.split(" ").filter((w) => w.length > 3));
  const kb = y.split(" ").filter((w) => w.length > 3);
  const shared = kb.filter((w) => ka.has(w)).length;
  return shared >= 2 && shared / Math.max(ka.size, kb.length) >= 0.6;
};

function dedupe(list) {
  const out = [];
  for (const q of list) if (!out.some((o) => same(o.text, q.text))) out.push(q);
  return out;
}

const VALID = new Set(TYPES.map((t) => t.id));

/** Turn plain question objects into editor questions (ids, autofill, safe types). */
export function toQuestions(list) {
  return list
    .filter((q) => q && q.text && VALID.has(q.type))
    .map((q) => {
      const auto = guessAutofill(q.text);
      return {
        id: uid(),
        type: q.type,
        text: String(q.text).trim(),
        ...(q.hint ? { hint: String(q.hint).trim() } : {}),
        options: HAS_OPTIONS.includes(q.type) ? (q.options || []).map((o) => String(o).trim()).filter(Boolean) : [],
        required: !!q.required,
        autofill: ["short", "long"].includes(q.type) ? auto : "",
        autofillTouched: true,
      };
    });
}

/** Offline draft from the topic library. */
export function localDraft(description) {
  const topics = matchTopics(description);
  const main = topics[0];
  const basics = main?.basics === false ? [] : BASICS;
  const minor = isMinor(description) ? MINOR : [];
  const topical = main ? main.questions : GENERIC;
  const all = dedupe([...basics, ...minor, ...topical]);
  return {
    title: titleFrom(description),
    intro: main?.intro || "",
    questions: toQuestions(all),
    source: main ? `Built from the ${main.label.toLowerCase()} library` : "Built from general questions",
  };
}

/** Questions that fit this form but aren't in it yet. */
export function suggestionsFor(form) {
  const text = `${form.description || ""} ${form.title || ""}`;
  const topics = matchTopics(text);
  // Main topic first, then a few from the next-best topic, so the owner can pick what fits.
  const main = topics[0];
  // A specific sport doesn't need the general sports questions ("Which sport or event?").
  const second = topics.find((t, i) => i > 0 && !(t.id === "sport" && ["football", "basketball"].includes(main?.id)));
  const pool = main ? [...main.questions, ...(second?.questions.slice(0, 3) || [])] : GENERIC;
  const basics = main?.basics === false ? [] : BASICS.slice(0, 3); // name, email, phone: offered back if removed
  const extras = isMinor(text) ? MINOR : [];
  return dedupe([...basics, ...extras, ...pool]).filter((s) => !form.questions.some((q) => same(q.text, s.text))).slice(0, 8);
}

// ---------- Options for a single question ----------

const OPTION_SETS = [
  [/\bposition\b.*\b(field|pitch|play|football|soccer)\b|\b(field|pitch)\b.*\bposition\b/, ["Goalkeeper", "Defender", "Midfielder", "Forward"]],
  [/\bposition\b.*\b(court|basketball)\b/, ["Point guard", "Shooting guard", "Small forward", "Power forward", "Center"]],
  [/\b(stronger|preferred|dominant) foot\b|\bwhich foot\b/, ["Right", "Left", "Both"]],
  [/\b(shoot|hand)\b.*\b(right|left|hand)\b|\bwhich hand\b/, ["Right", "Left", "Both"]],
  [/\bhow long\b|\byears of\b|\bexperience\b/, YEARS],
  [/\bgender\b|\bsex\b/, ["Female", "Male", "Prefer not to say"]],
  [/\bage\b|\bage group\b|\bhow old\b/, ["Under 18", "18–24", "25–34", "35–44", "45+"]],
  [/\bdays?\b|\bavailab/, DAYS],
  [/\b(time|session|shift)\b/, ["Morning", "Afternoon", "Evening", "Weekends"]],
  [/\bhear about\b|\bfind out about\b/, ["Friend or family", "Instagram", "WhatsApp", "Facebook", "TikTok", "Other"]],
  [/\bbudget\b|\bprice range\b/, ["Under $100", "$100 – $300", "$300 – $1,000", "$1,000+", "Not sure yet"]],
  [/\blevel\b/, ["Beginner", "Intermediate", "Advanced", "Expert"]],
  [/\b(education|qualification|degree)\b/, ["High school", "Diploma / certificate", "Bachelor's degree", "Master's degree", "Other"]],
  [/\b(full.?time|part.?time|type of work|kind of work|employment type)\b/, ["Full-time", "Part-time", "Contract / freelance", "Internship"]],
  [/\bsize\b|\bt.?shirt\b|\bjersey\b/, ["XS", "S", "M", "L", "XL", "XXL"]],
  [/\b(dietary|diet|food)\b/, ["None", "Vegetarian", "Vegan", "Halal", "Allergies"]],
  [/\bmarital\b/, ["Single", "Married", "Prefer not to say"]],
  [/\bhow (often|frequently)\b/, ["Daily", "Weekly", "Monthly", "Rarely"]],
  [/\b(satisf|happy|rate|rating)\b/, ["Very satisfied", "Satisfied", "Neutral", "Dissatisfied", "Very dissatisfied"]],
  [/\b(county|region)\b/, ["Montserrado", "Margibi", "Grand Bassa", "Bong", "Nimba", "Lofa", "Other"]],
];

/** Offline option suggestions for one question, or null. */
export function localOptions(questionText) {
  const t = norm(questionText);
  for (const [re, opts] of OPTION_SETS) if (re.test(t)) return [...opts];
  for (const topic of TOPICS) {
    const hit = topic.questions.find((q) => q.options?.length && same(q.text, questionText));
    if (hit) return [...hit.options];
  }
  return null;
}

// ---------- AI (when api/assist.js has a key), with offline fallback ----------

async function ai(body, ms) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch("/api/assist", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: ctl.signal });
    if (!r.ok) throw new Error(String(r.status));
    return await r.json();
  } finally {
    clearTimeout(timer);
  }
}

/** Draft a form from a description: Claude if available, else the built-in library. */
export async function draftForm(description) {
  try {
    const r = await ai({ action: "draft", description }, 25000);
    const questions = toQuestions(r.questions || []);
    if (questions.length >= 3) return { title: r.title || titleFrom(description), intro: r.intro || "", questions, source: "Drafted by AI" };
  } catch { /* fall back to the library */ }
  return localDraft(description);
}

/** Options for a choice question: the built-in library first (instant), then Claude. */
export async function suggestOptions(questionText, context) {
  const local = localOptions(questionText);
  if (local) return local;
  try {
    const r = await ai({ action: "options", question: questionText, context }, 15000);
    const opts = (r.options || []).map((o) => String(o).trim()).filter(Boolean);
    if (opts.length >= 2) return opts.slice(0, 12);
  } catch { /* nothing to suggest */ }
  return null;
}
