# Nuvex Attendance

Track who showed up. For each person: how many days they were here, how many they missed, and their attendance rate.

## How it works
1. **Make a group** (a team, a class, a crew) and add the people. Paste a whole list at once if you like.
2. **Take attendance.** Pick a day and tap **Present**, **Late**, **Absent** or **Excused** for each person,
   or tap **Mark the rest present**. You can go back to any earlier day and fill it in or fix it.
3. **Totals.** "Here" counts present and late. "Missed" counts absent and excused. Tap a name to see exactly which days they missed.
4. **Spreadsheet.** Download everything as a CSV that opens in Excel or Google Sheets.

Everything is saved on the device you use. There is no account or server.

## Deploy on Vercel
Add a new project from this repo and set **Root Directory** to `nuvex-attendance`. Vercel detects Vite on its own.

## Run it
```bash
npm install
npm run dev
```
