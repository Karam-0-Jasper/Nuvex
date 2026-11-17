# Nuvex Attendance

An attendance register that works like a spreadsheet.

## How it works
**Home** works like a document list: start a new register (blank, class or staff), or open one from **Recent registers**.
Search finds a register by name; the ⋮ menu removes one. Each class is its own register.

**A register** works like a spreadsheet:
- Column **A** is the student name. Type a name in the empty row and press Enter (or paste a whole list).
  The keyboard closes and that student's box for today is selected, ready to mark. The first name adds today's column for you.
- Each **date** is a column. **Today** adds today; **+ Date** picks any date. Select the date at the top to change it in the cell bar.
- Every box has a **✅** and a **❌** button. Tap the one you mean; tap it again to clear it.
  Keyboard: arrows to move, **P** for ✅, **A** or **X** for ❌, **Delete** to clear, **Space** to cycle.
- The last two columns count for each student: **✅ 14 days** attended and **❌ 2 days** missed.
- **Fill ✅** marks everyone not yet marked as present for the selected date. The bin deletes the selected student or date.
- **Undo / Redo** (Ctrl+Z / Ctrl+Shift+Z) for any change. The status line shows the selected student's or date's totals.
- Tabs along the bottom switch between classes. Copy pastes the whole sheet into Excel or Google Sheets; the download button saves a .csv.
- Light and dark theme from the moon / sun button.

Everything is saved on the device you use. `supabase/schema.sql` is the database setup for a later version
where registers are shared and locked with a 4-digit passcode; the app does not use it yet.

## Deploy on Vercel
Add a new project from this repo and set **Root Directory** to `nuvex-attendance`. Vercel detects Vite on its own.

## Run it
```bash
npm install
npm run dev
```
