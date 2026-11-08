// Letter formats. Each letter is a list of parts in the order they appear on the page.
// The writer fills in "Date: …", "Your address: …" and so on; the layout and the rules are ours.
//
// role decides where a part sits on the page:
//   from (your address and contacts) · date · to (who it goes to) · greeting · subject
//   body (paragraphs) · close ("Yours faithfully,") · sign (your name, under the signature) · enc
// kind: line | lines (several lines, e.g. an address) | para (a paragraph)
// optional parts are left off the letter when empty. auto() fills a part the writer leaves empty.

export const todayLong = () => new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

const TITLE_WORDS = /^(mr|mrs|ms|miss|mx|dr|prof|professor|rev|reverend|hon|honourable|honorable|pastor|chief|madam|sir)\.?$/i;

/** "Mrs. Comfort Kollie" → "Dear Mrs. Kollie,"; nobody named → "Dear Sir/Madam,". */
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

/** Dear Sir/Madam → Yours faithfully. A named person → Yours sincerely. */
export const formalClose = (greeting) => (/\b(sir|madam|whom)\b/i.test(greeting || "") ? "Yours faithfully," : "Yours sincerely,");

// ---------- Shared parts ----------

const ADDRESS = {
  key: "fromAddress", role: "from", kind: "lines", label: "Your address",
  hint: "Street, town or city, and country, one per line. Your name does not go here; it goes at the end.",
  placeholder: "12 Tubman Boulevard\nSinkor, Monrovia\nLiberia",
};
const PHONE = { key: "fromPhone", role: "from", kind: "line", label: "Your phone", optional: true, placeholder: "+231 77 000 0000", profile: "phone", prefix: "Tel: " };
const EMAIL = { key: "fromEmail", role: "from", kind: "line", label: "Your email", optional: true, placeholder: "you@example.com", profile: "email", prefix: "Email: " };
const DATE = {
  key: "date", role: "date", kind: "line", label: "Date",
  hint: "Write the date in full, like 8 November 2026, not 8/11/26.",
  auto: () => todayLong(), why: () => "Today's date. Type over it to change it.",
};

const TO = ({ name = "Mrs. Comfort Kollie", title = "Human Resources Manager", org = "Pace Kreatvy Studio", address = "Broad Street\nMonrovia, Liberia", titleOptional = true } = {}) => [
  { key: "toName", role: "to", kind: "line", label: "Their name", optional: true, placeholder: name || "Leave empty if you don't know it",
    hint: "Include their title: Mr., Mrs., Ms. or Dr. Leave it empty if you don't know their name." },
  { key: "toTitle", role: "to", kind: "line", label: "Their position", optional: titleOptional, placeholder: title },
  { key: "toOrg", role: "to", kind: "line", label: "Organisation", placeholder: org },
  { key: "toAddress", role: "to", kind: "lines", label: "Their address", placeholder: address },
];

const GREETING_FORMAL = {
  key: "greeting", role: "greeting", kind: "line", label: "Greeting",
  auto: (v) => formalGreeting(v.toName),
  why: (v) => (v.toName?.trim() ? "Made from their name: their title and surname." : "Nobody is named, so it starts “Dear Sir/Madam,”."),
  options: ["Dear Sir/Madam,", "Dear Sir,", "Dear Madam,"],
};
const CLOSE_FORMAL = {
  key: "close", role: "close", kind: "line", label: "Ending",
  auto: (v, eff) => formalClose(eff.greeting),
  why: (v, eff) => (/\b(sir|madam|whom)\b/i.test(eff.greeting || "")
    ? "You started with “Dear Sir/Madam”, so the right ending is “Yours faithfully,”."
    : "You started with a name, so the right ending is “Yours sincerely,”."),
  options: ["Yours faithfully,", "Yours sincerely,"],
};
const NAME = { key: "name", role: "sign", kind: "line", label: "Your full name", placeholder: "Karamba Zelany", profile: "name", hint: "Sign by hand in the space above your name after you print." };
const subject = (placeholder, hint = "One short line that says what the letter is about.") => ({ key: "subject", role: "subject", kind: "line", label: "Subject", placeholder, hint });
const para = (key, label, hint, placeholder, optional = false) => ({ key, role: "body", kind: "para", label, hint, placeholder, optional });

// ---------- The letters ----------

export const LETTERS = [
  {
    id: "job", name: "Job application letter", blurb: "Apply for a job or send with your CV (a cover letter).",
    layout: "modern", formal: true,
    keywords: /\b(job|cover|position|vacancy|employment|hire|hiring|work at|apply for|internship)\b/,
    rules: [
      "Keep it to one page and three or four short paragraphs.",
      "Name the exact job title, and say where you saw the advert.",
      "Use “Yours faithfully,” after “Dear Sir/Madam,”, and “Yours sincerely,” after a name.",
    ],
    parts: [
      ADDRESS, PHONE, EMAIL, DATE, ...TO(), GREETING_FORMAL,
      subject("Application for the Position of Video Editor"),
      para("p1", "Opening paragraph", "Say which job you are applying for and where you saw it.", "I am writing to apply for the position of Video Editor, which was advertised on your Facebook page on 3 November 2026."),
      para("p2", "Your experience", "Say why you are a good fit: your experience, skills and one result you are proud of.", "I have two years of experience editing promotional videos for small businesses. I am skilled in Premiere Pro and CapCut, and my edits for a local restaurant helped it grow to 10,000 followers."),
      para("p3", "Why this company", "Say what you like about them and how you would help.", "I admire the brand stories your studio tells, and I would bring fast, careful editing to your team.", true),
      para("p4", "Closing paragraph", "Mention your CV, ask for an interview and say thank you.", "I have attached my CV for your review. I would welcome the chance to discuss my application at an interview. Thank you for your time and consideration."),
      CLOSE_FORMAL, NAME,
      { key: "enc", role: "enc", kind: "line", label: "Enclosure", optional: true, placeholder: "CV", prefix: "Enclosure: ", hint: "What you are sending with the letter, like your CV or certificates." },
    ],
  },
  {
    id: "friendly", name: "Friendly letter", blurb: "An informal letter to a friend or family member.",
    layout: "classic", formal: false,
    keywords: /\b(friend|friendly|informal|pen ?pal|cousin|brother|sister|mother|father|mom|mum|dad|uncle|aunt|grandma|grandpa|family)\b/,
    rules: [
      "Put only your address and the date at the top. No address for your friend.",
      "Start with greetings and ask how they are before your news.",
      "End warmly and sign with your first name only.",
    ],
    parts: [
      ADDRESS, DATE,
      { key: "toName", role: "meta", kind: "line", label: "Your friend's name", placeholder: "Fatu", hint: "Only used in the greeting." },
      { key: "greeting", role: "greeting", kind: "line", label: "Greeting",
        auto: (v) => `Dear ${(v.toName || "").trim().split(/\s+/)[0] || "friend"},`, why: () => "Made from your friend's first name.",
        options: ["Dear Fatu,", "My dear Fatu,", "Hello Fatu,"] },
      para("p1", "Opening", "Greet them and ask how they and their family are.", "How are you and your family? I hope you are all doing well. We are all fine here in Monrovia."),
      para("p2", "Your news", "The main reason you are writing.", "I am writing to tell you that I finally started my own design project, and I would love your ideas for it."),
      para("p3", "More news", "Anything else you want to share.", "School closes next month, so maybe you can visit during the holidays.", true),
      para("p4", "Closing", "Send greetings to others and say you hope to hear from them.", "Please greet your parents for me. I look forward to hearing from you soon."),
      { key: "close", role: "close", kind: "line", label: "Ending", auto: () => "Your friend,", why: () => "A warm ending for a friend.",
        options: ["Your friend,", "With love,", "Your loving sister,", "Your loving brother,", "Best wishes,"] },
      { ...NAME, label: "Your first name", placeholder: "Karamba", hint: "Your first name only." },
    ],
  },
  {
    id: "scholarship", name: "Scholarship application letter", blurb: "Ask a committee or school to fund your studies.",
    layout: "modern", formal: true,
    keywords: /\b(scholarship|admission|bursary|grant|sponsorship|school fees|tuition)\b/,
    rules: [
      "Name the exact scholarship you are applying for.",
      "Show results with facts: grades, awards, positions held.",
      "Be honest about why you need it, and say what you will do with it.",
    ],
    parts: [
      ADDRESS, PHONE, EMAIL, DATE,
      ...TO({ name: "", title: "The Chairperson, Scholarship Committee", org: "Liberia Education Fund", address: "Capitol Hill\nMonrovia, Liberia", titleOptional: false }),
      GREETING_FORMAL,
      subject("Application for the 2027 Undergraduate Scholarship"),
      para("p1", "Who you are", "Your name, school, class or year, and which scholarship you are applying for.", "I am a twelfth-grade student at Monrovia Central High School, and I am applying for your 2027 Undergraduate Scholarship."),
      para("p2", "Your achievements", "Grades, awards, leadership and activities.", "I finished the last school year with an average of 89 percent and served as president of the science club."),
      para("p3", "Why you need it and your goals", "What you will study, why you need the support, and your plans after.", "I hope to study computer science at the University of Liberia. My family cannot cover the full tuition, and this scholarship would let me focus fully on my studies."),
      para("p4", "Closing paragraph", "Mention your documents and thank them.", "I have attached my transcript and two letters of recommendation. Thank you for considering my application."),
      CLOSE_FORMAL, NAME,
      { key: "enc", role: "enc", kind: "line", label: "Enclosures", optional: true, placeholder: "Transcript, two recommendation letters", prefix: "Enclosures: " },
    ],
  },
  {
    id: "request", name: "Formal request letter", blurb: "Ask an office, principal or company for something.",
    layout: "modern", formal: true,
    keywords: /\b(request|formal|official|principal|ministry|office|apply|application)\b/,
    rules: [
      "Say what you are asking for in the first paragraph.",
      "Stay polite and short. Give only the details they need to say yes.",
      "End by saying what you would like them to do next.",
    ],
    parts: [
      ADDRESS, PHONE, EMAIL, DATE,
      ...TO({ name: "Mr. Joseph Kollie", title: "Principal", org: "Monrovia Central High School", address: "Camp Johnson Road\nMonrovia, Liberia" }),
      GREETING_FORMAL,
      subject("Request to Use the School Hall for a Youth Workshop"),
      para("p1", "What you are asking for", "Say clearly what you want.", "I am writing to request the use of the school hall on Saturday, 22 November 2026, for a free photography workshop for students."),
      para("p2", "Details and reasons", "Why you need it, and any dates, numbers or conditions.", "The workshop will run from 10 a.m. to 2 p.m. for about 40 students. We will provide our own equipment and leave the hall clean."),
      para("p3", "Closing paragraph", "What you would like them to do, and thanks.", "I would be grateful for your approval. Please let me know if you need any further information. Thank you for your time."),
      CLOSE_FORMAL, NAME,
    ],
  },
  {
    id: "complaint", name: "Complaint letter", blurb: "Report a problem with a product or service and ask for a fix.",
    layout: "modern", formal: true,
    keywords: /\b(complain|complaint|refund|faulty|broken|bad service|poor service|damaged)\b/,
    rules: [
      "Stay calm and polite, even if you are upset.",
      "Give facts: what you bought, when, where, and any order or receipt number.",
      "Say exactly what you want: a refund, a repair or a replacement, and by when.",
    ],
    parts: [
      ADDRESS, PHONE, EMAIL, DATE,
      ...TO({ name: "", title: "Customer Service Manager", org: "Lonestar Electronics", address: "Randall Street\nMonrovia, Liberia" }),
      GREETING_FORMAL,
      subject("Complaint About a Faulty Phone (Receipt No. 20481)"),
      para("p1", "What happened", "What you bought or used, when, where, and any reference number.", "On 1 November 2026 I bought a Tecno Spark phone from your Randall Street shop (receipt no. 20481)."),
      para("p2", "The problem", "What went wrong and how it affected you.", "After three days the phone stopped charging. I returned to the shop twice, but the problem has not been fixed."),
      para("p3", "What you want done", "Refund, repair or replacement, and by when.", "I would like a full refund or a new phone by 20 November 2026."),
      para("p4", "Closing paragraph", "Thank them and say how to reach you.", "I have attached a copy of my receipt. I look forward to your quick reply."),
      CLOSE_FORMAL, NAME,
      { key: "enc", role: "enc", kind: "line", label: "Enclosure", optional: true, placeholder: "Copy of receipt", prefix: "Enclosure: " },
    ],
  },
  {
    id: "resignation", name: "Resignation letter", blurb: "Leave a job politely and give notice.",
    layout: "modern", formal: true,
    keywords: /\b(resign|resignation|quit|quitting|leaving my job|notice)\b/,
    rules: [
      "State your position and your last working day in the first paragraph.",
      "Keep it positive. You don't have to explain why you are leaving.",
      "Offer to help hand over your work.",
    ],
    parts: [
      ADDRESS, DATE,
      ...TO({ name: "Mr. Samuel Doe", title: "Managing Director", org: "Pace Kreatvy Studio", address: "Broad Street\nMonrovia, Liberia" }),
      GREETING_FORMAL,
      subject("Letter of Resignation"),
      para("p1", "Your resignation", "Your position, and your last working day (most jobs need two to four weeks' notice).", "Please accept this letter as formal notice of my resignation from my position as Video Editor. My last working day will be 5 December 2026."),
      para("p2", "Thank them", "Something you are grateful for.", "Thank you for the opportunities I have had here. I have learned a great deal from you and the team."),
      para("p3", "Handover", "Offer to help before you go.", "I will do everything I can to hand over my work smoothly, including training my replacement."),
      CLOSE_FORMAL, NAME,
    ],
  },
  {
    id: "leave", name: "Permission or leave letter", blurb: "Ask a school or boss for time off.",
    layout: "modern", formal: true,
    keywords: /\b(leave|absence|absent|permission|excuse|day off|time off|sick)\b/,
    rules: [
      "Give the exact dates you will be away and the date you will be back.",
      "Give a short, honest reason.",
      "Say how your work or lessons will be covered.",
    ],
    parts: [
      ADDRESS, DATE,
      ...TO({ name: "Mr. Joseph Kollie", title: "Principal", org: "Monrovia Central High School", address: "Camp Johnson Road\nMonrovia, Liberia" }),
      GREETING_FORMAL,
      subject("Request for Leave of Absence"),
      para("p1", "Your request", "Who is asking, and the dates.", "I am writing to ask permission for my son, James Zelany of grade 10B, to be absent from school from 17 to 19 November 2026."),
      para("p2", "The reason", "A short, honest reason.", "He will be travelling with the family to Gbarnga for his grandmother's funeral."),
      para("p3", "Catching up and return", "How work will be covered, and when you are back.", "He will collect his assignments before he leaves and return to class on 20 November. Thank you for your understanding."),
      CLOSE_FORMAL, NAME,
    ],
  },
  {
    id: "recommendation", name: "Recommendation letter", blurb: "Vouch for a student, worker or friend.",
    layout: "modern", formal: true,
    keywords: /\b(recommend|recommendation|reference|referee|vouch|testimonial)\b/,
    rules: [
      "Say who you are and how long you have known them.",
      "Give real examples of their skills, not just adjectives.",
      "End with a clear recommendation and how to contact you.",
    ],
    parts: [
      ADDRESS, PHONE, EMAIL, DATE,
      ...TO({ name: "", title: "Admissions Committee", org: "University of Liberia", address: "Capitol Hill\nMonrovia, Liberia", titleOptional: false }),
      { ...GREETING_FORMAL, options: ["To Whom It May Concern:", "Dear Sir/Madam,"] },
      subject("Recommendation for Mary Johnson"),
      para("p1", "Who you are and how you know them", "Your role, and how long and in what way you have known them.", "I have taught Mary Johnson English for three years at Monrovia Central High School."),
      para("p2", "Their strengths, with examples", "Skills and qualities, each with a real example.", "Mary is hardworking and a natural leader. As class president, she organised a reading club that now has over 30 members."),
      para("p3", "Your recommendation", "Recommend them clearly and offer to answer questions.", "I recommend Mary without hesitation. Please contact me if you need any further information."),
      CLOSE_FORMAL, NAME,
      { key: "position", role: "sign", kind: "line", label: "Your position", optional: true, placeholder: "English Teacher, Monrovia Central High School" },
    ],
  },
  {
    id: "thanks", name: "Thank-you letter", blurb: "Thank someone for a gift, help or an interview.",
    layout: "modern", formal: true,
    keywords: /\b(thank|thanks|thank you|gratitude|appreciation)\b/,
    rules: [
      "Say exactly what you are thanking them for.",
      "Say how it helped you.",
      "Keep it short, warm and sincere.",
    ],
    parts: [
      ADDRESS, DATE,
      { key: "toName", role: "meta", kind: "line", label: "Their name", placeholder: "Mrs. Comfort Kollie", hint: "With their title. Only used in the greeting." },
      GREETING_FORMAL,
      para("p1", "What you are thanking them for", "Be specific.", "Thank you for taking the time to interview me for the Video Editor position on Monday."),
      para("p2", "How it helped", "What it meant to you.", "I enjoyed learning about your studio's projects, and it made me even more excited about the role."),
      para("p3", "Closing", "A warm final line.", "Thank you again for your time. I look forward to hearing from you."),
      CLOSE_FORMAL, NAME,
    ],
  },
  {
    id: "invitation", name: "Invitation letter", blurb: "Invite a guest or speaker to an event.",
    layout: "modern", formal: true,
    keywords: /\b(invite|invitation|guest speaker|ceremony|launch|program|programme)\b/,
    rules: [
      "Say what the event is and why you are inviting them.",
      "Give the date, time and place clearly.",
      "Ask them to reply by a set date.",
    ],
    parts: [
      ADDRESS, PHONE, EMAIL, DATE,
      ...TO({ name: "Dr. Ellen Kamara", title: "Director", org: "Liberia Media Center", address: "Sinkor\nMonrovia, Liberia" }),
      GREETING_FORMAL,
      subject("Invitation to Speak at Our Youth Media Day"),
      para("p1", "The invitation", "The event, and why you are inviting them.", "On behalf of Pace Kreatvy Studio, I am pleased to invite you to speak at our Youth Media Day."),
      para("p2", "Date, time and place", "Every detail they need.", "The event will take place on Saturday, 6 December 2026, from 10 a.m. to 1 p.m. at the City Hall, Monrovia."),
      para("p3", "Reply", "When and how to reply.", "Kindly confirm your attendance by 25 November 2026. We would be honoured to have you with us."),
      CLOSE_FORMAL, NAME,
      { key: "position", role: "sign", kind: "line", label: "Your position", optional: true, placeholder: "Events Coordinator" },
    ],
  },
];

export const letterType = (id) => LETTERS.find((l) => l.id === id) || LETTERS[0];

/** Which letter a description is asking for, e.g. "a letter to resign from my job" → resignation. */
export function matchLetter(text) {
  const t = String(text || "").toLowerCase();
  // Specific kinds first, so "job" in "resign from my job" doesn't win.
  for (const id of ["resignation", "leave", "recommendation", "complaint", "thanks", "invitation", "scholarship", "friendly", "job"]) {
    if (letterType(id).keywords.test(t)) return id;
  }
  return "request";
}

/** Is this description asking for a letter rather than a form? */
export const wantsLetter = (text) => /\bletters?\b/i.test(text || "");

// ---------- Working out the page ----------

/** The value each part will show: what was written, else the suggestion, else "". */
export function effectiveValues(type, values) {
  const eff = {};
  for (const p of type.parts) {
    const own = (values[p.key] || "").trim();
    eff[p.key] = own || (p.auto ? p.auto(values, eff) : "");
  }
  return eff;
}

export function missingParts(type, values) {
  const eff = effectiveValues(type, values);
  return type.parts.filter((p) => !p.optional && p.role !== "meta" && !eff[p.key]);
}

const lines = (s) => String(s || "").split("\n").map((l) => l.trim()).filter(Boolean);

/**
 * The finished letter as blocks, top to bottom. Each block: { role, side, lines: [{ text, ph }] }.
 * side is "right" for the classic layout's address/date and ending. ph marks a part still to fill in.
 */
export function layoutLetter(type, values, layout = type.layout) {
  const eff = effectiveValues(type, values);
  const classic = layout === "classic";
  const show = (p) => {
    const v = eff[p.key];
    if (v) return (p.kind === "line" ? [v] : lines(v)).map((l, i) => ({ text: (i === 0 && p.prefix ? p.prefix : "") + l }));
    return p.optional ? [] : [{ text: `[${p.label}]`, ph: true }];
  };
  const take = (role) => type.parts.filter((p) => p.role === role);
  const blocks = [];
  const add = (role, ls, extra = {}) => { if (ls.length) blocks.push({ role, lines: ls, side: "left", ...extra }); };

  const from = take("from").flatMap(show);
  const date = take("date").flatMap(show);
  if (classic) add("from", [...from, { gap: true }, ...date], { side: "right" });
  else { add("from", from); add("date", date); }
  add("to", take("to").flatMap(show));
  add("greeting", take("greeting").flatMap(show));
  add("subject", take("subject").flatMap(show), { classic });
  for (const p of take("body")) add("body", show(p));
  const side = classic ? "right" : "left";
  add("close", take("close").flatMap(show), { side });
  add("sign", take("sign").flatMap(show), { side });
  add("enc", take("enc").flatMap(show));
  return blocks;
}

export function letterText(type, values, layout) {
  return layoutLetter(type, values, layout)
    .map((b) => b.lines.map((l) => (l.gap ? "" : b.role === "subject" && b.classic ? l.text.toUpperCase() : l.text)).join("\n"))
    .join("\n\n");
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/** A Word-compatible document (Word opens HTML saved as .doc). */
export function letterDoc(type, values, layout) {
  const body = layoutLetter(type, values, layout).map((b) => {
    const style = [b.side === "right" ? "margin-left:55%" : "", b.role === "sign" ? "margin-top:40pt" : ""].filter(Boolean).join(";");
    const inner = b.lines.map((l) => (l.gap ? "" : esc(l.text))).join("<br>");
    const content = b.role === "subject" ? (b.classic ? `<b><u>${inner.toUpperCase()}</u></b>` : `<b>${inner}</b>`) : inner;
    return `<p${style ? ` style="${style}"` : ""}${b.role === "subject" && b.classic ? ' align="center"' : ""}>${content}</p>`;
  }).join("\n");
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>${esc(type.name)}</title>
<style>@page{size:A4;margin:2.5cm}body{font-family:"Times New Roman",serif;font-size:12pt;line-height:1.4}p{margin:0 0 12pt}</style></head><body>
${body}
</body></html>`;
}
