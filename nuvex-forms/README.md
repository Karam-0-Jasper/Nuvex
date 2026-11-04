# Nuvex Forms

Application forms as simple as Google Forms, with an optional AI video interview.

## How it works
1. **Make a form.** Start blank or from a template. Add questions: short answer, paragraph, multiple choice, checkboxes, yes/no, scale or date.
2. **Add an interview (optional).** In the **Interview** tab, write the questions the AI should ask and, for each one,
   *what a good answer includes*. Only you see that part; it never goes into the applicant's link.
3. **Send.** Copy the link or share it on WhatsApp or email. Add your WhatsApp number or email so answers come back to you.
4. **People apply.** One simple page, with a mic on every written answer. If there's an interview, it follows the form:
   the AI asks each question out loud, the applicant answers on camera against a timer, and the AI may ask one follow-up.
5. **Read responses.** Applicants send you a link; open it and the response lands in the **Responses** tab — with the
   AI's score for each interview answer, judged against what you wrote. Download everything as a spreadsheet.

Applicants are never judged on appearance or accent. Integrity checks (face in view, one person, staying in the tab,
no copy/paste) run on their device; video is never recorded or uploaded. Interview results are sealed so edits are detected.

## Turning the AI on
In the Vercel project for `nuvex-forms`, add **Settings → Environment Variables**, then redeploy:

| Name | Value |
|---|---|
| `ANTHROPIC_API_KEY` | Your key from console.anthropic.com |
| `INTERVIEW_SECRET` | Any long random string |

Without them, everything works except AI follow-ups, AI scores and sealing. Model: Claude Opus 5.5, roughly $0.05–0.15 per interview.
Set a spending limit in the Anthropic Console — the API route is public.

## Run it
```bash
cd nuvex-forms
npm install
npm run dev
```
