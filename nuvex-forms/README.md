# Nuvex Forms — applications people actually finish

A replacement for the Google Docs / Google Forms way of sending interview questions and applications.
You make the questions once and share a link. People answer by **talking, tapping, or reusing what they already said**, so nobody has to type an essay on their phone.

## What's inside

**For the person answering**
- **Talk the whole way (hands-free).** It reads each question out loud and listens for the answer. Say “next”, “back”, “repeat”, “clear”, “stop” or “submit”. You never need to touch the screen.
- **Mic on every answer.** Tap and speak. Spoken emails and links get cleaned up: “karamba at gmail dot com” becomes `karamba@gmail.com`.
- **Tap, don't type.** Pick-one, pick-several, yes/no, 1–5 stars and dates are big buttons. You can also say them out loud: “the second one”, “yeah I can”, “three to five years”, “next Monday”.
- **Fills itself.** Your name, email, phone, city and link are saved on your phone (only there). Every Nuvex form fills them in for you.
- **Reuse past answers.** If you answered a similar question before (“Tell us about yourself”), you get a “Use this answer” button.
- **Starter phrases** for long answers, so you're never stuck on a blank box.
- **Nothing gets lost.** A draft saves as you go. You check your answers before sending, and you can download a copy.
- When you're done, one tap sends the answers to the form owner on **WhatsApp** or **email**.

**For the person asking (you)**
- Templates: interview questions, job application, school/scholarship application, creative client brief, event sign-up. Or start blank.
- **Say all your questions at once.** Talk or paste them in, saying “next question” between each one. Each becomes its own question, with a sensible answer type picked for it.
- Every field in the builder has a mic too.
- Share by link or WhatsApp. No account needed, for you or for them.
- **Inbox.** Open the answers link someone sends you and the answers are saved. Read them neatly, or download a spreadsheet (CSV) for each form.

## Design

One deliberate system, no decoration:

- **Type:** Newsreader (editorial serif) for anything people read — questions, titles. Geist for the interface, Geist Mono for labels and counters.
- **Colour:** warm paper and ink, one forest-green accent for state, red only for recording. Full dark mode.
- **Form:** hairline rules instead of shadows and bubbles, one question per screen, keyboard shortcuts (Enter to continue, A–J to choose, Y/N, 1–5), a record button with a running timer.
- **Icons:** one line-icon set. No emoji anywhere.

## Video interviews

Any form can run as a timed video interview (editor → **Video interview**). The interviewer reads each written
question aloud, the applicant answers on camera against a countdown, and the answer is transcribed live.

- **Follow-ups:** Claude can ask one short follow-up per question when an answer is vague (`api/interview.js`).
- **AI review:** when the hiring team opens a result, Claude scores each answer 1–5 on what was said, with strengths and gaps.
  It is told never to judge accent, grammar, appearance or any personal characteristic, and it does not recommend hire/reject.
- **Integrity checks (on-device):** face visible, more than one person in view, leaving the tab or window, copy/paste,
  leaving full screen, repeat attempts on the same device. Face *detection* only — no recognition, no expression or emotion
  analysis, and no video is recorded or uploaded.
- **Sealed results:** the server signs each finished interview; edits to the results link show as "Edited after submission".

### Turning the AI on (Vercel)
In the Vercel project for `nuvex-forms`, add these under **Settings → Environment Variables**, then redeploy:

| Name | Value |
|---|---|
| `ANTHROPIC_API_KEY` | Your key from console.anthropic.com |
| `INTERVIEW_SECRET` | Any long random string (used to seal results) |

Without the key, interviews still run (questions, timer, transcript, integrity checks); follow-ups and AI review are skipped.
Model: Claude Opus 5.5. Rough cost: about $0.05–0.15 per interview.

**Known limits:** the API route is public, so set a spending limit in the Anthropic Console and consider Vercel's firewall
rate limiting. No browser check can stop a second phone or someone off-camera; results flag what can be detected.
Some places regulate AI video interviews (for example Illinois and the EU) — applicants are told what is checked and must consent.

## How it works
The whole form is packed into the link itself. The answers come back the same way, as a link in the WhatsApp or email message.
So it costs nothing to run and works on any free host. Voice uses the browser's built-in speech tools: Chrome, Edge and Safari (iPhone included). In other browsers people can still tap and type.

## Run it
```bash
cd nuvex-forms
npm install
npm run dev
```
Deploy: on Vercel, add a new project with **Root Directory** set to `nuvex-forms`.

## Next ideas
- Save forms and answers to Supabase, so answers land in your inbox automatically without anyone sending a message.
- AI help: turn a rambling spoken answer into a clean paragraph, or write the questions for you from “I'm hiring a video editor”.
- Record the voice answer itself, so you can hear how candidates speak.
