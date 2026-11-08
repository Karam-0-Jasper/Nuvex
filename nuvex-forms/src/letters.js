// Letters, laid out as a typed page. The fixed words are already there; the person only fills the blanks.
//
// A letter is a list of blocks, top to bottom. A block is a list of lines; a line is a list of pieces:
//   "text"                      fixed words, already typed
//   { k, ph }                   a blank to fill (k = key, ph = what shows while it's empty)
//   { k, ph, multi: true }      a blank that takes several lines (an address, the letter itself)
//   { k, ph, auto }             a blank that starts filled in (today's date, "Dear Sir/Madam,", "Yours faithfully,")
// side: "right" puts the block on the right, the way an address and date sit at the top of a letter.

export const todayLong = () => new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

const TITLE_WORDS = /^(mr|mrs|ms|miss|mx|dr|prof|professor|rev|reverend|hon|honourable|honorable|pastor|chief|madam|sir)\.?$/i;

/** "Mrs. Comfort Kollie" → "Dear Mrs. Kollie,". Nobody named → "Dear Sir/Madam,". */
export function formalGreeting(name) {
  const words = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "Dear Sir/Madam,";
  if (words.length > 1 && TITLE_WORDS.test(words[0])) {
    const t = words[0].replace(/\.$/, "");
    const title = t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
    return `Dear ${title}${/^(mr|mrs|ms|dr|mx)$/i.test(t) ? "." : ""} ${words[words.length - 1]},`;
  }
  return `Dear ${words.join(" ")},`;
}

/** After "Dear Sir/Madam," → "Yours faithfully,". After a name → "Yours sincerely,". */
export const formalClose = (greeting) => (/\b(sir|madam|whom)\b/i.test(greeting || "") ? "Yours faithfully," : "Yours sincerely,");

// ---------- Building blocks ----------

const blank = (k, ph, extra = {}) => ({ k, ph, ...extra });

const FROM = { side: "right", lines: [
  [blank("fromAddress", "Your address", { multi: true })],
  [blank("fromPhone", "Phone number", { optional: true })],
  [blank("fromEmail", "Email", { optional: true })],
  [],
  [blank("date", "Date", { auto: () => todayLong() })],
] };
const FROM_SHORT = { side: "right", lines: [
  [blank("fromAddress", "Your address", { multi: true })],
  [],
  [blank("date", "Date", { auto: () => todayLong() })],
] };
const TO = (title = "Their position", org = "Company or organisation") => ({ lines: [
  [blank("toName", "Their name", { optional: true })],
  [blank("toTitle", title)],
  [blank("toOrg", org)],
  [blank("toAddress", "Their address", { multi: true })],
] });
const GREETING = { lines: [[blank("greeting", "Dear Sir/Madam,", { auto: (v) => formalGreeting(v.toName) })]] };
const subject = (...pieces) => ({ role: "subject", lines: [pieces] });
const BODY = { role: "body", lines: [[blank("body", "Write your letter here.", { multi: true, big: true })]] };
const CLOSE = { side: "right", lines: [
  [blank("close", "Yours faithfully,", { auto: (v, eff) => formalClose(eff.greeting) })],
  [{ sign: true }],
  [blank("name", "Your full name", { profile: "name" })],
] };

// ---------- The letters ----------

export const LETTERS = [
  { id: "job", name: "Job application letter", blocks: [
    FROM, TO(), GREETING, subject("Application for the Position of ", blank("position", "Position")), BODY, CLOSE,
  ] },
  { id: "friendly", name: "Friendly letter", blocks: [
    FROM_SHORT,
    { lines: [["Dear ", blank("friend", "Name"), ","]] },
    BODY,
    { side: "right", lines: [[blank("close", "Your friend,", { auto: () => "Your friend," })], [blank("name", "Your first name")]] },
  ] },
  { id: "scholarship", name: "Scholarship application letter", blocks: [
    FROM, TO("The Chairperson, Scholarship Committee", "Organisation or school"), GREETING,
    subject("Application for the ", blank("scholarship", "Name of scholarship")), BODY, CLOSE,
  ] },
  { id: "request", name: "Formal request letter", blocks: [
    FROM, TO(), GREETING, subject("Request for ", blank("request", "What you are asking for")), BODY, CLOSE,
  ] },
  { id: "complaint", name: "Complaint letter", blocks: [
    FROM, TO("Customer Service Manager"), GREETING, subject("Complaint About ", blank("problem", "The problem")), BODY, CLOSE,
  ] },
  { id: "resignation", name: "Resignation letter", blocks: [
    FROM_SHORT, TO(), GREETING, subject("Letter of Resignation"), BODY, CLOSE,
  ] },
  { id: "leave", name: "Permission or leave letter", blocks: [
    FROM_SHORT, TO("Principal or manager", "School or company"), GREETING, subject("Request for Leave of Absence"), BODY, CLOSE,
  ] },
  { id: "recommendation", name: "Recommendation letter", blocks: [
    FROM, TO(), GREETING, subject("Recommendation for ", blank("person", "Their name")), BODY, CLOSE,
  ] },
  { id: "thanks", name: "Thank-you letter", blocks: [
    FROM_SHORT, { lines: [["Dear ", blank("thankName", "Name"), ","]] }, BODY,
    { side: "right", lines: [[blank("close", "Yours sincerely,", { auto: () => "Yours sincerely," })], [{ sign: true }], [blank("name", "Your full name", { profile: "name" })]] },
  ] },
  { id: "invitation", name: "Invitation letter", blocks: [
    FROM, TO(), GREETING, subject("Invitation to ", blank("event", "The event")), BODY, CLOSE,
  ] },
];

export const letterType = (id) => LETTERS.find((l) => l.id === id) || LETTERS[0];

const blanksOf = (type) => type.blocks.flatMap((b) => b.lines.flat()).filter((p) => p && typeof p === "object" && p.k);

/** What each blank shows: what was typed; a blank never touched shows its starting value. */
export function effectiveValues(type, values) {
  const eff = {};
  for (const p of blanksOf(type)) {
    if (eff[p.k] !== undefined) continue;
    eff[p.k] = values[p.k] !== undefined ? values[p.k] : p.auto ? p.auto(values, eff) : "";
  }
  return eff;
}

/** Name, phone and email from "My info", so they don't have to be typed again. */
export function prefill(type, profile) {
  const values = {};
  for (const p of blanksOf(type)) {
    if (p.k === "name" && profile.name && p.ph !== "Your first name") values.name = profile.name;
    if (p.k === "fromPhone" && profile.phone) values.fromPhone = profile.phone;
    if (p.k === "fromEmail" && profile.email) values.fromEmail = profile.email;
  }
  return values;
}

// ---------- The finished letter, for copying, Word and printing ----------

/** Lines of text for each block, leaving out blanks that are still empty. */
function finished(type, values) {
  const eff = effectiveValues(type, values);
  return type.blocks.map((b) => {
    const out = [];
    for (const line of b.lines) {
      if (!line.length) { out.push(""); continue; }
      if (line[0]?.sign) { out.push(""); continue; }
      const text = line.map((p) => (typeof p === "string" ? p : eff[p.k] || "")).join("");
      const hasBlank = line.some((p) => typeof p === "object");
      const filled = line.every((p) => typeof p === "string" || (eff[p.k] || "").trim());
      if (hasBlank && !filled && line.length === 1) continue;
      out.push(...text.split("\n"));
    }
    while (out.length && !out[out.length - 1].trim()) out.pop();
    while (out.length && !out[0].trim()) out.shift();
    return { ...b, text: out };
  }).filter((b) => b.text.length);
}

export const letterText = (type, values) => finished(type, values).map((b) => b.text.join("\n")).join("\n\n");

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/** A Word-compatible document (Word opens HTML saved as .doc). */
export function letterDoc(type, values) {
  const body = finished(type, values).map((b) => {
    const style = b.side === "right" ? ' style="margin-left:55%"' : "";
    const inner = b.text.map(esc).join("<br>");
    if (b.role === "subject") return `<p align="center"><b><u>${inner.toUpperCase()}</u></b></p>`;
    return `<p${style}>${inner}</p>`;
  }).join("\n");
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>${esc(type.name)}</title>
<style>@page{size:A4;margin:2.5cm}body{font-family:"Times New Roman",serif;font-size:12pt;line-height:1.4}p{margin:0 0 12pt}</style></head><body>
${body}
</body></html>`;
}
