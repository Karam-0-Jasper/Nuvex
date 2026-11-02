// Ready-made forms. Edit or add your own here.
// Question types: short, long, choice (pick one), multi (pick several), yesno, rating, date.
// autofill: name | email | phone | location | link — filled in from the person's saved "My info".
// starters: tap-to-start phrases for long answers, so nobody stares at an empty box.

export const TYPES = [
  { id: "short", label: "Short answer", icon: "✏️" },
  { id: "long", label: "Long answer", icon: "📝" },
  { id: "choice", label: "Pick one", icon: "🔘" },
  { id: "multi", label: "Pick several", icon: "☑️" },
  { id: "yesno", label: "Yes / No", icon: "👍" },
  { id: "rating", label: "Rating 1–5", icon: "⭐" },
  { id: "date", label: "Date", icon: "📅" },
];

const contact = [
  { type: "short", text: "What's your full name?", required: true, autofill: "name" },
  { type: "short", text: "Your email address", required: true, autofill: "email" },
  { type: "short", text: "Phone or WhatsApp number", autofill: "phone" },
];

export const TEMPLATES = [
  {
    id: "interview",
    icon: "🎤",
    title: "Interview questions",
    blurb: "Screen candidates before you meet them. They just talk.",
    intro: "Answer like you're talking to us in person — tap the mic and speak. There are no trick questions.",
    questions: [
      ...contact,
      { type: "short", text: "Which role are you interviewing for?", required: true },
      { type: "long", text: "Tell us about yourself.", required: true, starters: ["My name is … and I'm from …", "Right now I work as …", "What I'm really good at is …"] },
      { type: "long", text: "Why do you want to work with us?", required: true, starters: ["I first heard about you when …", "What I like about your work is …", "I can help you with …"] },
      { type: "long", text: "What is your biggest strength?", starters: ["People always tell me I'm good at …", "One example is when …"] },
      { type: "long", text: "Tell us about a hard situation at work or school and how you handled it.", hint: "What happened, what you did, how it ended.", starters: ["The situation was …", "What I did was …", "In the end …"] },
      { type: "choice", text: "How much experience do you have in this kind of work?", options: ["Just starting out", "1–2 years", "3–5 years", "More than 5 years"] },
      { type: "yesno", text: "Are you comfortable working some weekends?" },
      { type: "date", text: "When could you start?" },
      { type: "short", text: "What pay are you expecting?", hint: "A range is fine." },
      { type: "long", text: "Anything else you want us to know?" },
    ],
  },
  {
    id: "job",
    icon: "💼",
    title: "Job application",
    blurb: "Collect applications without making people type an essay.",
    intro: "Apply in a few minutes. Speak your answers or tap — your info can fill itself in.",
    questions: [
      ...contact,
      { type: "short", text: "Which city do you live in?", autofill: "location" },
      { type: "choice", text: "Which position are you applying for?", required: true, options: ["Video editor", "Photographer", "Social media manager", "Graphic designer", "Other"] },
      { type: "multi", text: "Which tools can you use?", options: ["Premiere Pro", "CapCut", "Photoshop", "Canva", "Lightroom", "Final Cut", "Figma"] },
      { type: "short", text: "Link to your portfolio or past work", autofill: "link" },
      { type: "long", text: "Describe a project you're proud of.", starters: ["The project was …", "My part was …", "The result was …"] },
      { type: "choice", text: "What type of work are you looking for?", options: ["Full-time", "Part-time", "Freelance / per project", "Internship"] },
      { type: "date", text: "When can you start?" },
    ],
  },
  {
    id: "scholarship",
    icon: "🎓",
    title: "School / scholarship application",
    blurb: "Personal statements spoken, not typed.",
    intro: "Take your time. You can speak each answer and fix any words after.",
    questions: [
      ...contact,
      { type: "short", text: "Name of your current school", required: true },
      { type: "choice", text: "What level are you at?", options: ["High school", "University – year 1–2", "University – year 3+", "Graduate"] },
      { type: "short", text: "What do you want to study?", required: true },
      { type: "long", text: "Why do you deserve this opportunity?", required: true, starters: ["Growing up, I …", "My goal is to …", "This would help me …"] },
      { type: "long", text: "Tell us about a challenge you've overcome.", starters: ["A hard time in my life was …", "What helped me get through it was …"] },
      { type: "long", text: "How will you give back to your community?" },
      { type: "yesno", text: "Do you have a recommendation letter?" },
    ],
  },
  {
    id: "brief",
    icon: "🎬",
    title: "Creative client brief",
    blurb: "For studios: clients describe their project out loud.",
    intro: "Tell us about your brand and what you need. Just talk — we'll handle the rest.",
    questions: [
      { type: "short", text: "Your name", required: true, autofill: "name" },
      { type: "short", text: "Business or brand name", required: true },
      { type: "short", text: "Phone or WhatsApp", required: true, autofill: "phone" },
      { type: "multi", text: "What do you need from us?", required: true, options: ["Photos", "Video editing", "Brand story", "Social media marketing", "Logo / design", "Ads"] },
      { type: "long", text: "Describe your brand in your own words.", starters: ["We sell / we do …", "Our customers love us because …", "We started because …"] },
      { type: "long", text: "Who are your customers?", hint: "Age, where they are, what they like." },
      { type: "short", text: "Links to work you like (any brand)", hint: "Instagram, TikTok, YouTube…" },
      { type: "choice", text: "What's your budget?", options: ["Under $100", "$100 – $300", "$300 – $1,000", "$1,000+", "Not sure yet"] },
      { type: "date", text: "When do you need it done?" },
    ],
  },
  {
    id: "event",
    icon: "🎟️",
    title: "Event sign-up",
    blurb: "Quick RSVP with tap answers.",
    intro: "Sign up in under a minute.",
    questions: [
      ...contact.slice(0, 2),
      { type: "yesno", text: "Will you attend?", required: true },
      { type: "choice", text: "How many people are you bringing?", options: ["Just me", "+1", "+2", "+3 or more"] },
      { type: "multi", text: "Which sessions interest you?", options: ["Talks", "Workshop", "Networking", "Showcase"] },
      { type: "rating", text: "How excited are you? (1–5)" },
      { type: "short", text: "Any food allergies or needs?" },
    ],
  },
];
