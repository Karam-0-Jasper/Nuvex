# Nuvex Attendance

An attendance register that works like a spreadsheet.

## How it works
1. **Create a class** and add the students. Type them or paste a whole list.
2. **Take attendance:** each student has a ✓ and a ✗ button. Tap one for each person, or tap
   **Mark the other … present** and only tap the ones who are missing. Use the arrows or tap the date to go to another day.
3. **Register:** the full table, a column per day, with **Attended** and **Missed** totals at the end of every row.
   Search, sort by most missed, copy it, or download it for Excel.
4. **Tap a student** to see their days attended, days missed, attendance % and the exact days they missed.

Removing a student or a class can be undone from the message at the bottom of the screen.
Everything is saved on the device you use. `supabase/schema.sql` is the database setup for a later version
where registers are shared and locked with a 4-digit passcode; the app does not use it yet.

## Deploy on Vercel
Add a new project from this repo and set **Root Directory** to `nuvex-attendance`. Vercel detects Vite on its own.

## Run it
```bash
npm install
npm run dev
```
