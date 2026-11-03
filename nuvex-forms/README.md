# Nuvex Forms — forms you can just talk to

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

## How it works (no server yet)
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
