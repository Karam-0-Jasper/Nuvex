# Nuvex Attendance

An attendance register that works like a spreadsheet.

## How it works
**Home** works like a document list: start a new register (blank, class or staff), or open one from **Recent registers**.
Search finds a register by name; the ⋮ menu removes one. Each class is its own register.

**Every day:** open the class and tap ✅ or ❌ for each student. Names are saved, so they are typed only once.
On a school day (Mon–Fri) opening a register adds today's column by itself and selects the first student's box.
Tip: tap **Fill ✅** first, then only tap ❌ for the students who are absent.

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

## Logins (school version)
When a school database is connected (`src/config.js`), everyone logs in first:
- **Set up your school** (once): school name, a short **school code** (e.g. `st-mary`), your name, a username and a password.
  The person who does this is the **school admin**.
- The admin opens the account button (top right) → **Teachers** and adds each teacher with a name, username and password,
  then tells them in person. Teachers log in with the school code, their username and password, and stay logged in.
- **A teacher sees only their own registers.** The admin sees every register in the school, the staff register,
  and can **give** a register to a teacher from the ⋮ menu.
- Forgot password: the admin gives a new one (Teachers → New password). Removing a teacher keeps their registers (they move to the admin).
- 5 wrong passwords lock that account for 15 minutes.
- **Weak connection:** every tap is saved on the phone first and uploaded when there is signal. The title bar says
  *Saving…*, *Saved*, or *Offline · saved on this phone*. Only the changes are uploaded, not the whole register.
- **Log out** removes that account's registers from the phone, so the next person on a shared phone can't see them.
  It refuses while changes are still waiting to upload.
- Registers made on the phone before logins existed can be added to the account once (a banner offers it).

Without a database the app runs with no logins and saves everything on the device (this is what the preview link does).

### Connecting the database
1. In Supabase, open the project → **SQL Editor** → New query → paste all of `supabase/schema.sql` → **Run**.
2. Put the project URL and the **publishable** key in `src/config.js` (or set `VITE_SUPABASE_URL` and `VITE_SUPABASE_KEY`
   in Vercel). The publishable key is meant to be public: every table is locked and the only way in is the
   functions in `schema.sql`, which check the login on the server. Never put the `service_role`/secret key in the app.

## Deploy on Vercel
Add a new project from this repo and set **Root Directory** to `nuvex-attendance`. Vercel detects Vite on its own.

## Run it
```bash
npm install
npm run dev
```
