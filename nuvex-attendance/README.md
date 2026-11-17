# Nuvex Attendance

An attendance register that works like a spreadsheet.

## How it works
- **Home:** every class is a glass tile showing its students, the last 7 days of attendance and today's ✅ / ❌ count.
  Tap **New class** to start another one. Each class keeps its own register.
- **The sheet:** a plain register. **Name** down the side, one column per **date**, and in each date a ✅ and a ❌ box
  you tap. At the end of every row: **✅ 14 days** attended and **❌ 2 days** missed.
- **Names:** write one in the last row and press Enter, or paste a whole list. Tap a name to fix it, × removes it.
- **Dates:** **Add today** (then **Add day** for the next school day). Tap a date to change it, × removes the column.
- Removing anything can be undone. The ••• menu copies the sheet for Google Sheets or downloads it for Excel.
- **White / dark mode** with the sun / moon button. Dark mode is true black.

Everything is saved on the device you use. `supabase/schema.sql` is the database setup for a later version
where registers are shared and locked with a 4-digit passcode; the app does not use it yet.

## Deploy on Vercel
Add a new project from this repo and set **Root Directory** to `nuvex-attendance`. Vercel detects Vite on its own.

## Run it
```bash
npm install
npm run dev
```
