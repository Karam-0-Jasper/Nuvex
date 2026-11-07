// Starter forms. Every question can be edited.
// Question types: short, long, choice, multi, dropdown, file, rating, yesno, date — plus "section" items that start a new page.
// autofill: name | email | phone | location | link — filled in for people who have applied before on the same device.
// interview.questions[].expect: what a good answer includes. Only the form owner sees this; the AI uses it to score.

export const TYPES = [
  { id: "short", label: "Short answer" },
  { id: "long", label: "Paragraph" },
  { id: "choice", label: "Multiple choice" },
  { id: "multi", label: "Checkboxes" },
  { id: "dropdown", label: "Dropdown" },
  { id: "file", label: "File upload" },
  { id: "rating", label: "Linear scale" },
  { id: "yesno", label: "Yes or no" },
  { id: "date", label: "Date" },
];

/** Question types that have a list of options. */
export const HAS_OPTIONS = ["choice", "multi", "dropdown"];

const contact = [
  { type: "short", text: "Full name", required: true, autofill: "name" },
  { type: "short", text: "Email", required: true, autofill: "email" },
  { type: "short", text: "Phone or WhatsApp", autofill: "phone" },
];

export const TEMPLATES = [
  {
    id: "job",
    title: "Job application",
    intro: "Thanks for your interest. This takes about five minutes.",
    questions: [
      ...contact,
      { type: "choice", text: "Which position are you applying for?", required: true, options: ["Video editor", "Photographer", "Social media manager", "Graphic designer", "Other"] },
      { type: "file", text: "Upload your CV", hint: "PDF, Word or image, up to 10 MB." },
      { type: "short", text: "Link to your portfolio or past work", autofill: "link" },
      { type: "long", text: "Tell us about a project you're proud of." },
      { type: "date", text: "When can you start?" },
    ],
  },
  {
    id: "interview",
    title: "Application with interview",
    intro: "First a few details, then a short video interview. You'll need a camera and microphone.",
    questions: [
      ...contact,
      { type: "short", text: "Which role are you applying for?", required: true },
    ],
    interview: {
      enabled: true,
      seconds: 120,
      questions: [
        { text: "Tell us about yourself and your work so far.", expect: "Their current or most recent work, the skills they actually use, and why this kind of role suits them." },
        { text: "Describe a project you're proud of. What was your part in it?", expect: "A real, specific project. What they personally did, not just the team. A result, such as numbers, feedback or a deadline met." },
        { text: "Why do you want to work with us?", expect: "Something specific about our work or clients, and how their skills would help us. Not a general answer that fits any company." },
      ],
    },
  },
  {
    id: "scholarship",
    title: "Scholarship application",
    intro: "Take your time. You can type or speak each answer.",
    questions: [
      ...contact,
      { type: "short", text: "Current school", required: true },
      { type: "short", text: "What do you want to study?", required: true },
      { type: "long", text: "Why do you deserve this scholarship?", required: true },
      { type: "long", text: "Tell us about a challenge you've overcome." },
    ],
  },
  {
    id: "brief",
    title: "Client brief",
    intro: "Tell us about your brand and what you need.",
    questions: [
      { type: "short", text: "Your name", required: true, autofill: "name" },
      { type: "short", text: "Business or brand name", required: true },
      { type: "short", text: "Phone or WhatsApp", required: true, autofill: "phone" },
      { type: "multi", text: "What do you need?", required: true, options: ["Photos", "Video editing", "Brand story", "Social media", "Logo / design"] },
      { type: "long", text: "Describe your brand and your customers." },
      { type: "choice", text: "Budget", options: ["Under $100", "$100 – $300", "$300 – $1,000", "$1,000+", "Not sure yet"] },
      { type: "date", text: "When do you need it?" },
    ],
  },
  {
    id: "event",
    title: "Event registration",
    intro: "Register in under a minute.",
    questions: [
      ...contact.slice(0, 2),
      { type: "yesno", text: "Will you attend?", required: true },
      { type: "choice", text: "How many people are you bringing?", options: ["Just me", "+1", "+2", "+3 or more"] },
    ],
  },
];
