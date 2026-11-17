# Nuvex Attendance

An attendance register that works like a spreadsheet.

## How it works
1. **Type the names** down the first column. Press Enter to go to the next row, or paste a whole list at once.
2. **Each day is a column.** Tap **+ Add day** for a new one.
3. **Tap a box** to mark it: once for ✓ (present), again for ✗ (absent), a third time to clear it.
4. **Totals are at the end of every row:** days attended and days missed, as numbers. The bottom row counts who was present each day.
5. **Each class is a tab** at the bottom. Tap **+** to add another class.

Tap a date to change it, fill the blanks with ✓, or delete that day. Tap a row number to delete that row.
**Copy table** pastes straight into Excel or Google Sheets; **Download** saves a spreadsheet file.

Everything is saved on the device you use. `supabase/schema.sql` is the database setup for a later version
where each register is shared and locked with a 4-digit passcode; the app does not use it yet.

## Deploy on Vercel
Add a new project from this repo and set **Root Directory** to `nuvex-attendance`. Vercel detects Vite on its own.

## Run it
```bash
npm install
npm run dev
```
