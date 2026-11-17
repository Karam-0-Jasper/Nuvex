// Nuvex Attendance
// Home: a document list of registers. A register: a spreadsheet.
// Column A is the name, one column per date (click a cell: ✅ → ❌ → blank), then Attended and Missed.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { copyText, dayKey, download, fromKey, loadSheets, newSheet, saveSheets, uid } from "./store.js";
import {
  ONLINE, adopt, diff, forget, infoOf, loadCache, loadQueue, loadSession, pushQueue, rpc, saveCache, sheetsOf, shiftQueue,
} from "./sync.js";
import Auth from "./Auth.jsx";
import Account from "./Account.jsx";

const IS_ARTIFACT = import.meta.env.VITE_ARTIFACT === "1";
const k = (pid, day) => `${pid}|${day}`;
const today = () => dayKey(new Date());
const fmt = (day, o) => fromKey(day).toLocaleDateString(undefined, o);
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
const letter = (i) => { let s = ""; i += 1; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
const when = (t) => {
  if (!t) return "";
  const d = new Date(t), now = new Date();
  return d.toDateString() === now.toDateString() ? d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: d.getFullYear() === now.getFullYear() ? undefined : "numeric" });
};

// ---------- data ----------
function daysOf(sheet) {
  const set = new Set(sheet.cols || []);
  for (const key of Object.keys(sheet.marks)) set.add(key.slice(key.indexOf("|") + 1));
  return [...set].sort();
}
function totals(sheet, pid) {
  let here = 0, missed = 0;
  for (const [key, v] of Object.entries(sheet.marks)) {
    if (!key.startsWith(pid + "|")) continue;
    if (v === "p") here++; else if (v === "a") missed++;
  }
  return { here, missed, rate: here + missed ? Math.round((here / (here + missed)) * 100) : null };
}
function tableOf(sheet, sep) {
  const days = daysOf(sheet);
  const cell = (v) => (sep === "," ? `"${String(v ?? "").replace(/"/g, '""')}"` : String(v ?? "").replace(/[\t\n]/g, " "));
  const rows = [["Name", ...days, "Days attended", "Days missed"]];
  for (const p of sheet.people) {
    const t = totals(sheet, p.id);
    rows.push([p.name, ...days.map((d) => ({ p: "✅", a: "❌" })[sheet.marks[k(p.id, d)]] || ""), t.here, t.missed]);
  }
  return rows.map((r) => r.map(cell).join(sep)).join("\n");
}

// ---------- theme ----------
function useTheme() {
  const [mode, setMode] = useState(() => {
    try { return localStorage.getItem("na.theme") || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"); } catch { return "light"; }
  });
  useEffect(() => {
    document.documentElement.dataset.theme = mode;
    try { localStorage.setItem("na.theme", mode); } catch { /* ignore */ }
  }, [mode]);
  return [mode, () => setMode((m) => (m === "dark" ? "light" : "dark"))];
}

// ---------- icons (Material-style outlines) ----------
const P = {
  undo: "M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11",
  redo: "M15 14l5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13",
  addcol: "M12 5v14M5 12h14",
  person: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 20a8 8 0 0 1 16 0",
  fill: "M5 12.5l4.5 4.5L19 7.5",
  clear: "M7 7l10 10M17 7L7 17",
  delrow: "M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3",
  copy: "M9 9h11v11H9zM5 15V4h11",
  down: "M12 4v11M7 10l5 5 5-5M5 20h14",
  moon: "M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z",
  sun: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4",
  search: "M11 17.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM16 16l4.5 4.5",
  more: "M12 5.5v.01M12 12v.01M12 18.5v.01",
  back: "M15 5l-7 7 7 7",
  plus: "M12 5v14M5 12h14",
  cal: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",
};
const Icon = ({ n, size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={n === "more" ? 3 : 1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={P[n]} /></svg>
);
function Logo({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden="true" className="logo">
      <rect x="4" y="2" width="20" height="24" rx="2.5" fill="var(--brand)" />
      <path d="M8 9h12M8 13.5h12M8 18h12M13 9v9" stroke="var(--on-brand)" strokeWidth="1.3" />
    </svg>
  );
}
const Btn = ({ icon, label, onClick, disabled, active, text }) => (
  <button className={`tb ${active ? "is-on" : ""} ${text ? "has-text" : ""}`} onClick={onClick} disabled={disabled} title={label} aria-label={label}>
    <Icon n={icon} />{text && <span>{text}</span>}
  </button>
);

// ---------- logins ----------
// With a school database set up (config.js), everyone logs in first. Without one, the app runs on this device only.
export default function Root() {
  const [session, setSession] = useState(() => (ONLINE ? loadSession() : null));
  const [note, setNote] = useState("");
  if (!ONLINE) return <App />;
  if (!session) return <Auth Logo={Logo} note={note} onSignedIn={(s) => { setNote(""); setSession(s); }} />;
  return (
    <App key={session.id} session={session} onSignOut={(expired) => {
      if (expired) { try { localStorage.removeItem("na.session"); } catch { /* ignore */ } setNote("You were logged out. Please log in again."); }
      setSession(null);
    }} />
  );
}

const SYNC_TEXT = { saved: "Saved", saving: "Saving…", offline: "Offline · saved on this phone", error: "Not uploaded yet · will retry" };

// ---------- app with history ----------
function App({ session, onSignOut }) {
  const cloud = !!session;
  const [sheets, setSheetsRaw] = useState(() => (cloud ? loadCache(session.id).sheets : loadSheets()));
  const [info, setInfo] = useState(() => (cloud ? loadCache(session.id).info : null));
  const [sync, setSync] = useState("saved");
  const [openId, setOpenId] = useState(null);
  const [mode, toggle] = useTheme();
  const hist = useRef({ past: [], future: [], last: 0, tag: "" });
  const [, bump] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => (cloud ? saveCache(session.id, { info, sheets }) : saveSheets(sheets)), 150);
    return () => clearTimeout(t);
  }, [sheets, info]); // eslint-disable-line react-hooks/exhaustive-deps

  // ----- keeping the school database in step (logins only) -----
  // Each change is compared with the version before it; only the difference is queued and uploaded.
  const prev = useRef(sheets);
  const fromServer = useRef(false);
  const version = useRef(0);
  const busy = useRef(false);
  const timer = useRef(null);
  const lastPull = useRef(0);

  const flush = useCallback(async () => {
    if (!cloud || busy.current) return false;
    busy.current = true;
    clearTimeout(timer.current);
    try {
      for (;;) {
        const queue = loadQueue(session.id);
        if (!queue.length) { setSync("saved"); return true; }
        setSync("saving");
        const batch = queue.slice(0, 500);
        await rpc("apply_ops", { p_token: session.token, p_ops: batch });
        shiftQueue(session.id, batch.length);
      }
    } catch (e) {
      if (e.code === "signed_out") { onSignOut(true); return false; }
      setSync(e.network ? "offline" : "error");
      timer.current = setTimeout(() => flush(), 20000);
      return false;
    } finally { busy.current = false; }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /** Uploads what is waiting, then downloads the latest (other phones, or the admin, may have changed things). */
  const pull = useCallback(async () => {
    if (!(await flush())) return;
    const v = version.current;
    try {
      const data = await rpc("get_data", { p_token: session.token });
      lastPull.current = Date.now();
      if (v !== version.current || loadQueue(session.id).length) return; // edited meanwhile: keep the phone's version
      fromServer.current = true;
      setSheetsRaw((cur) => sheetsOf(data, cur));
      hist.current = { past: [], future: [], last: 0, tag: "" };
      setInfo(infoOf(data));
      bump((n) => n + 1);
    } catch (e) {
      if (e.code === "signed_out") onSignOut(true); else setSync(e.network ? "offline" : "error");
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!cloud) return;
    if (fromServer.current) { fromServer.current = false; prev.current = sheets; return; }
    const ops = diff(prev.current, sheets, info?.me.id);
    prev.current = sheets;
    if (!ops.length) return;
    version.current++;
    pushQueue(session.id, ops);
    setSync("saving");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => flush(), 600);
  }, [sheets]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!cloud) return undefined;
    pull();
    const onVis = () => {
      if (document.visibilityState === "hidden") flush();
      else if (Date.now() - lastPull.current > 60000) pull();
    };
    const onOnline = () => pull();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("online", onOnline);
    return () => { document.removeEventListener("visibilitychange", onVis); window.removeEventListener("online", onOnline); clearTimeout(timer.current); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const logout = async () => {
    if (!(await flush())) return "Some changes haven't uploaded yet. Connect to the internet, then log out.";
    try { await rpc("logout", { p_token: session.token }); } catch { /* the login ends on this phone either way */ }
    forget(session.id);
    onSignOut(false);
    return "";
  };

  /** Every change goes through here so it can be undone. Typing in one cell counts as one step. */
  const commit = useCallback((fn, tag = "") => {
    setSheetsRaw((cur) => {
      const h = hist.current, now = Date.now();
      if (!(tag && tag === h.tag && now - h.last < 1500)) { h.past.push(cur); if (h.past.length > 200) h.past.shift(); }
      h.future = []; h.last = now; h.tag = tag;
      return fn(cur);
    });
    bump((n) => n + 1);
  }, []);
  const undo = () => setSheetsRaw((cur) => { const h = hist.current; if (!h.past.length) return cur; h.future.push(cur); h.tag = ""; bump((n) => n + 1); return h.past.pop(); });
  const redo = () => setSheetsRaw((cur) => { const h = hist.current; if (!h.future.length) return cur; h.past.push(cur); h.tag = ""; bump((n) => n + 1); return h.future.pop(); });

  const open = (id) => { setOpenId(id); if (id) commit((all) => all.map((s) => (s.id === id ? { ...s, opened: Date.now() } : s)), "open"); };
  const create = (name, people = []) => {
    const s = { ...newSheet(name), cols: [], people: people.map((n) => ({ id: uid(), name: n })), opened: Date.now(),
      ...(cloud ? { owner: info.me.id, ownerName: info.me.name } : {}) };
    commit((all) => [...all, s]); setOpenId(s.id);
  };
  const sheet = sheets.find((s) => s.id === openId);
  const account = cloud && info ? (
    <Account session={session} info={info} onLogout={logout}
      onTeam={(team, moved) => { setInfo((x) => ({ ...x, team })); if (moved) pull(); }} />
  ) : null;

  return sheet ? (
    <Workbook sheets={sheets} sheet={sheet} commit={commit} undo={undo} redo={redo}
      canUndo={hist.current.past.length > 0} canRedo={hist.current.future.length > 0}
      saveText={cloud ? SYNC_TEXT[sync] : "Saved to this device"} saveState={cloud ? sync : "saved"}
      mode={mode} toggle={toggle} onHome={() => setOpenId(null)} onOpen={open} onCreate={() => create(`Class ${sheets.length + 1}`)} />
  ) : (
    <Home sheets={sheets} mode={mode} toggle={toggle} onOpen={open} onCreate={create} info={cloud ? info : null} account={account}
      syncText={cloud && sync !== "saved" ? SYNC_TEXT[sync] : ""}
      onGive={(id, t) => commit((all) => all.map((s) => (s.id === id ? { ...s, owner: t.id, ownerName: t.name } : s)))}
      onImport={cloud && info ? (old) => commit((all) => [...all, ...adopt(old, info.me)]) : null}
      onDelete={(id) => commit((all) => all.filter((s) => s.id !== id))} undo={undo} canUndo={hist.current.past.length > 0} />
  );
}

// ---------- home (document list) ----------
function Thumb({ sheet }) {
  const days = sheet ? daysOf(sheet).slice(-6) : [];
  const rows = sheet ? sheet.people.slice(0, 9) : [];
  return (
    <span className="thumb" aria-hidden="true">
      <span className="thumb-row is-head"><i className="t-name" />{Array.from({ length: 6 }, (_, j) => <i key={j} />)}</span>
      {Array.from({ length: 9 }, (_, i) => (
        <span className="thumb-row" key={i}>
          <i className={`t-name ${!sheet || rows[i] ? "is-ink" : ""}`} />
          {Array.from({ length: 6 }, (_, j) => {
            const m = sheet ? (rows[i] && days[j] ? sheet.marks[k(rows[i].id, days[j])] : null) : (i * 7 + j * 3) % 11 === 0 ? "a" : (i + j) % 5 === 4 ? null : "p";
            return <i key={j} className={m === "p" ? "is-p" : m === "a" ? "is-a" : ""} />;
          })}
        </span>
      ))}
    </span>
  );
}

function Home({ sheets, mode, toggle, onOpen, onCreate, onDelete, undo, canUndo, info, account, syncText, onGive, onImport }) {
  const [q, setQ] = useState("");
  const [menu, setMenu] = useState(null);
  const [removed, setRemoved] = useState(null);
  const isAdmin = info?.me.role === "admin";
  // Registers made on this phone before logins existed can be added to the account once.
  const [old, setOld] = useState(() => {
    if (!onImport) return [];
    try { if (localStorage.getItem("na.imported")) return []; } catch { return []; }
    return loadSheets().filter((s) => s.people.length);
  });
  const importOld = () => {
    onImport(old);
    try { localStorage.setItem("na.imported", "1"); } catch { /* ignore */ }
    setOld([]);
  };
  const list = [...sheets].filter((s) => (s.name || "").toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => (b.opened || b.created || 0) - (a.opened || a.created || 0));
  const templates = [
    { name: "Blank register", make: () => onCreate(`Class ${sheets.length + 1}`) },
    { name: "Class register", make: () => onCreate("New class") },
    { name: "Staff register", make: () => onCreate("Staff attendance") },
  ].filter((tp) => !info || isAdmin || tp.name !== "Staff register");

  return (
    <div className="home" onClick={() => setMenu(null)}>
      <header className="appbar">
        <Logo size={34} />
        <span className="appname">Attendance{info && <span className="school hide-sm">{info.school.name}</span>}</span>
        <label className="search"><Icon n="search" size={20} />
          <input id="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search registers" aria-label="Search registers" />
        </label>
        <button className="round" onClick={toggle} aria-label={mode === "dark" ? "Light theme" : "Dark theme"} title={mode === "dark" ? "Light theme" : "Dark theme"}>
          <Icon n={mode === "dark" ? "sun" : "moon"} size={20} />
        </button>
        {account}
      </header>
      {syncText && <div className="sync-bar" role="status">{syncText}</div>}
      {old.length > 0 && (
        <div className="banner" role="status">
          <span>{old.length === 1 ? "1 register is" : `${old.length} registers are`} saved on this phone from before you logged in.</span>
          <button className="btn-primary sm" onClick={importOld}>Add to my account</button>
          <button className="link" onClick={() => setOld([])}>Not now</button>
        </div>
      )}

      <section className="start">
        <div className="start-in">
          <h2 className="start-h">Start a new register</h2>
          <div className="templates">
            {templates.map((t, i) => (
              <button key={t.name} className="tpl" onClick={t.make}>
                <span className={`tpl-page ${i === 0 ? "is-blank" : ""}`}>{i === 0 ? <span className="tpl-plus"><Icon n="plus" size={42} /></span> : <Thumb />}</span>
                <span className="tpl-name">{t.name}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="docs">
        <div className="docs-head">
          <span className="docs-h">Recent registers</span>
          <span className="col-meta hide-sm">Students</span>
          <span className="col-meta hide-sm">Last opened</span>
          <span className="col-act" />
        </div>
        {!list.length && <p className="empty">{sheets.length ? "No registers match your search." : "No registers yet. Start one above."}</p>}
        {list.map((s) => (
          <div key={s.id} className="doc-row" onClick={() => onOpen(s.id)} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && onOpen(s.id)}>
            <span className="doc-title"><Logo size={22} /><span>{s.name || "Untitled register"}
              {isAdmin && s.ownerName && <small className="owner">{s.owner === info.me.id ? "You" : s.ownerName}</small>}</span></span>
            <span className="col-meta hide-sm">{s.people.length}</span>
            <span className="col-meta hide-sm">{when(s.opened || s.created)}</span>
            <span className="col-act">
              <button className="round sm" aria-label="More actions" onClick={(e) => { e.stopPropagation(); setMenu(menu === s.id ? null : s.id); }}><Icon n="more" /></button>
              {menu === s.id && (
                <div className="pop" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => onOpen(s.id)}>Open</button>
                  {isAdmin && (info.team || []).filter((tm) => tm.id !== s.owner).map((tm) => (
                    <button key={tm.id} onClick={() => { onGive(s.id, tm); setMenu(null); }}>Give to {tm.id === info.me.id ? "me" : tm.name}</button>
                  ))}
                  <button className="is-danger" onClick={() => { onDelete(s.id); setMenu(null); setRemoved(s.name || "Register"); }}>Remove</button>
                </div>
              )}
            </span>
          </div>
        ))}
      </section>

      {removed && canUndo && (
        <div className="snack" role="status"><span>{removed} removed</span><button onClick={() => { undo(); setRemoved(null); }}>Undo</button></div>
      )}
    </div>
  );
}

// ---------- workbook (one register) ----------
function Workbook({ sheets, sheet, commit, undo, redo, canUndo, canRedo, saveText, saveState, mode, toggle, onHome, onOpen, onCreate }) {
  const days = daysOf(sheet);
  const t = today();
  const [sel, setSel] = useState({ r: 0, c: 1 }); // r: -1 header row, people index, or people.length (new row). c: 0 name, 1..n dates, n+1, n+2 totals
  const [newName, setNewName] = useState("");
  const [copied, setCopied] = useState(false);
  const grid = useRef(null);
  const lastCol = days.length + 2;
  const nRows = sheet.people.length;

  const up = (fn, tag) => commit((all) => all.map((s) => (s.id === sheet.id ? fn(s) : s)), tag);

  // Opening a register on a school day (Mon–Fri) adds today's column, so the only daily job is tapping ✅ or ❌.
  // Weekends are left alone; the Today button still adds one if a class meets then.
  useEffect(() => {
    const dow = new Date().getDay();
    const todayIdx = days.indexOf(t);
    if (todayIdx >= 0) { setSel({ r: 0, c: todayIdx + 1 }); return; }
    if (!sheet.people.length || dow === 0 || dow === 6) return;
    up((s) => ({ ...s, cols: [...(s.cols || []), t] }));
    setSel({ r: 0, c: [...days, t].sort().indexOf(t) + 1 });
  }, [sheet.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const setMark = (pid, d, v) => up((s) => {
    const marks = { ...s.marks };
    if (v) marks[k(pid, d)] = v; else delete marks[k(pid, d)];
    return { ...s, marks };
  });
  const cycle = (pid, d) => setMark(pid, d, { undefined: "p", p: "a", a: null }[sheet.marks[k(pid, d)]]);
  const addDate = (d) => {
    if (!d || days.includes(d)) { if (d) setSel((x) => ({ ...x, c: days.indexOf(d) + 1 })); return; }
    up((s) => ({ ...s, cols: [...(s.cols || []), d] }));
    const idx = [...days, d].sort().indexOf(d) + 1;
    setSel((x) => ({ r: Math.max(0, Math.min(x.r, nRows - 1)), c: idx }));
  };
  const changeDate = (from, to) => {
    if (!to || to === from || days.includes(to)) return;
    up((s) => {
      const marks = {};
      for (const [key, v] of Object.entries(s.marks)) { const i = key.indexOf("|"); marks[key.slice(i + 1) === from ? key.slice(0, i + 1) + to : key] = v; }
      return { ...s, cols: [...(s.cols || []).filter((c) => c !== from), to], marks };
    });
  };
  const delDate = (d) => up((s) => ({ ...s, cols: (s.cols || []).filter((c) => c !== d), marks: Object.fromEntries(Object.entries(s.marks).filter(([key]) => !key.endsWith("|" + d))) }));
  const fillDate = (d, v) => up((s) => {
    const marks = { ...s.marks };
    for (const p of s.people) { if (v === null) delete marks[k(p.id, d)]; else if (!marks[k(p.id, d)]) marks[k(p.id, d)] = v; }
    return { ...s, marks };
  });
  const addPeople = (names) => {
    const clean = names.map((n) => n.trim()).filter(Boolean);
    if (!clean.length) return;
    // With no date column yet there is nothing to tick, so today's column comes with the first names.
    const needToday = !days.length;
    up((s) => ({ ...s, cols: needToday ? [...(s.cols || []), t] : s.cols, people: [...s.people, ...clean.map((name) => ({ id: uid(), name }))] }));
    setNewName("");
    // Close the phone keyboard and put the new student's box for today (or the latest date) under the finger.
    const dayList = needToday ? [t] : days;
    const c = (dayList.includes(t) ? dayList.indexOf(t) : dayList.length - 1) + 1;
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    setSel({ r: nRows, c });
  };
  const delPerson = (p) => up((s) => ({ ...s, people: s.people.filter((x) => x.id !== p.id), marks: Object.fromEntries(Object.entries(s.marks).filter(([key]) => !key.startsWith(p.id + "|"))) }));

  const selDay = sel.c >= 1 && sel.c <= days.length ? days[sel.c - 1] : null;
  const selPerson = sel.r >= 0 && sel.r < nRows ? sheet.people[sel.r] : null;

  // keep selection inside the sheet
  useEffect(() => {
    setSel((x) => ({ r: Math.min(Math.max(x.r, -1), nRows), c: Math.min(Math.max(x.c, 0), lastCol) }));
  }, [nRows, lastCol]);

  const focusCell = useCallback(() => {
    const el = grid.current?.querySelector(`[data-rc="${sel.r}:${sel.c}"]`);
    if (!el || el.contains(document.activeElement)) return;
    if (document.activeElement?.classList.contains("fx-input") || document.activeElement?.id === "doc-title") return;
    const input = el.querySelector("input");
    // On touch screens, focusing a cell can open or close the keyboard and jump the page under the finger.
    // There we only bring the cell into view; the name box still gets focus so typing works.
    if (input) input.focus({ preventScroll: true });
    else if (!matchMedia("(pointer: coarse)").matches) el.focus({ preventScroll: true });
    el.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [sel]);
  useEffect(() => { focusCell(); }, [sel.r, sel.c]); // eslint-disable-line react-hooks/exhaustive-deps

  const onKey = (e) => {
    if (e.target.tagName === "INPUT" && !["ArrowUp", "ArrowDown", "Enter", "Escape", "Tab"].includes(e.key)) return;
    const key = e.key;
    const mv = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[key];
    if ((e.metaKey || e.ctrlKey) && key.toLowerCase() === "z") { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if (mv && e.target.tagName !== "INPUT" || (mv && (key === "ArrowUp" || key === "ArrowDown"))) {
      e.preventDefault();
      setSel((x) => ({ r: Math.min(Math.max(x.r + mv[0], -1), nRows), c: Math.min(Math.max(x.c + mv[1], 0), lastCol) }));
      return;
    }
    if (key === "Tab") { e.preventDefault(); setSel((x) => ({ ...x, c: Math.min(Math.max(x.c + (e.shiftKey ? -1 : 1), 0), lastCol) })); return; }
    if (!selPerson || !selDay || e.target.tagName === "INPUT") return;
    const kk = key.toLowerCase();
    if (kk === " " || kk === "enter") { e.preventDefault(); cycle(selPerson.id, selDay); }
    else if (kk === "p" || kk === "1" || kk === "y") setMark(selPerson.id, selDay, "p");
    else if (kk === "a" || kk === "x" || kk === "0" || kk === "n") setMark(selPerson.id, selDay, "a");
    else if (kk === "backspace" || kk === "delete") setMark(selPerson.id, selDay, null);
  };

  // what the cell bar shows
  const ref = sel.r >= 0 ? `${letter(sel.c)}${sel.r + 2}` : `${letter(sel.c)}1`;
  let barText = "";
  if (sel.r === -1) barText = sel.c === 0 ? "Name" : selDay ? fmt(selDay, { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : sel.c === lastCol - 1 ? "Days attended" : "Days missed";
  else if (selPerson) {
    const tt = totals(sheet, selPerson.id);
    if (sel.c === 0) barText = selPerson.name;
    else if (selDay) { const m = sheet.marks[k(selPerson.id, selDay)]; barText = m === "p" ? "✅ Present" : m === "a" ? "❌ Absent" : "Not marked"; }
    else barText = `=COUNT(✅) → ${tt.here} days attended · ${tt.missed} days missed${tt.rate != null ? ` · ${tt.rate}%` : ""}`;
  }
  const status = selDay
    ? `${fmt(selDay, { weekday: "short", day: "numeric", month: "short" })}:  ✅ ${sheet.people.filter((p) => sheet.marks[k(p.id, selDay)] === "p").length}   ❌ ${sheet.people.filter((p) => sheet.marks[k(p.id, selDay)] === "a").length}   Not marked ${sheet.people.filter((p) => !sheet.marks[k(p.id, selDay)]).length}`
    : selPerson ? (() => { const tt = totals(sheet, selPerson.id); return `${selPerson.name}:  ✅ ${plural(tt.here, "day")}   ❌ ${plural(tt.missed, "day")}${tt.rate != null ? `   ${tt.rate}% attendance` : ""}`; })()
    : `${plural(nRows, "student")} · ${plural(days.length, "date")}`;
  const fileName = (sheet.name || "Attendance").replace(/[\\/:*?"<>|]/g, "");

  return (
    <div className="wb" onKeyDown={onKey}>
      <header className="wb-top">
        <button className="logo-btn" onClick={onHome} aria-label="All registers" title="All registers"><Logo size={30} /></button>
        <div className="wb-titles">
          <input id="doc-title" className="doc-name" value={sheet.name} placeholder="Untitled register" aria-label="Register name"
            onChange={(e) => up((s) => ({ ...s, name: e.target.value }), "title")} />
          <span className={`saved is-${saveState}`} role="status">{saveText}</span>
        </div>
        <button className="round" onClick={toggle} aria-label={mode === "dark" ? "Light theme" : "Dark theme"} title={mode === "dark" ? "Light theme" : "Dark theme"}>
          <Icon n={mode === "dark" ? "sun" : "moon"} size={20} />
        </button>
      </header>

      <nav className="ribbon-tabs" aria-hidden="true"><span className="is-on">Home</span></nav>
      <div className="ribbon" role="toolbar" aria-label="Sheet tools">
        <div className="group">
          <div className="group-btns">
            <Btn icon="undo" label="Undo (Ctrl+Z)" text="Undo" onClick={undo} disabled={!canUndo} />
            <Btn icon="redo" label="Redo (Ctrl+Shift+Z)" text="Redo" onClick={redo} disabled={!canRedo} />
          </div>
          <span className="group-name">Undo</span>
        </div>
        <div className="group">
          <div className="group-btns">
            <Btn icon="cal" label="Add today's date as a column" text="Today" onClick={() => addDate(t)} disabled={days.includes(t)} />
            <label className="tb has-text" title="Add any date as a column">
              <Icon n="addcol" /><span>Date</span>
              <input type="date" aria-label="Add a date" value="" onChange={(e) => addDate(e.target.value)} />
            </label>
          </div>
          <span className="group-name">Columns</span>
        </div>
        <div className="group">
          <div className="group-btns">
            <Btn icon="person" label="Add a student" text="Student" onClick={() => setSel({ r: nRows, c: 0 })} />
            <Btn icon="delrow" label={selDay && sel.r === -1 ? "Delete this date column" : "Delete the selected student"} text="Delete"
              onClick={() => { if (sel.r === -1 && selDay) delDate(selDay); else if (selPerson) delPerson(selPerson); }}
              disabled={!(sel.r === -1 && selDay) && !selPerson} />
          </div>
          <span className="group-name">Rows</span>
        </div>
        <div className="group">
          <div className="group-btns">
            <Btn icon="fill" label="Mark everyone not yet marked as present for the selected date" text="Fill ✅" onClick={() => selDay && fillDate(selDay, "p")} disabled={!selDay || !nRows} />
            <Btn icon="clear" label="Clear every mark in the selected date" text="Clear" onClick={() => selDay && fillDate(selDay, null)} disabled={!selDay} />
          </div>
          <span className="group-name">Attendance</span>
        </div>
        <div className="group">
          <div className="group-btns">
            <Btn icon="copy" label="Copy the whole sheet (paste into Excel or Google Sheets)" text={copied ? "Copied" : "Copy"}
              onClick={async () => { if (await copyText(tableOf(sheet, "\t"))) { setCopied(true); setTimeout(() => setCopied(false), 1500); } }} disabled={!nRows} />
            {!IS_ARTIFACT && <Btn icon="down" label="Download as .csv for Excel" text="Download" onClick={() => download(`${fileName}.csv`, "\ufeff" + tableOf(sheet, ","), "text/csv")} disabled={!nRows} />}
          </div>
          <span className="group-name">Export</span>
        </div>
      </div>

      <div className="cellbar">
        <span className="ref">{ref}</span>
        <span className="fx">fx</span>
        {sel.r === -1 && selDay ? (
          <input type="date" className="fx-input" value={selDay} onChange={(e) => changeDate(selDay, e.target.value)} aria-label="Change this date" />
        ) : sel.c === 0 && selPerson ? (
          <input className="fx-input" value={selPerson.name} aria-label="Edit name"
            onChange={(e) => up((s) => ({ ...s, people: s.people.map((x) => (x.id === selPerson.id ? { ...x, name: e.target.value } : x)) }), "name:" + selPerson.id)} />
        ) : <span className="fx-text">{barText}</span>}
      </div>

      <div className="grid-wrap" ref={grid}>
        <table className="grid">
          <thead>
            <tr className="letters">
              <th className="corner" />
              {Array.from({ length: lastCol + 1 }, (_, c) => (
                <th key={c} className={`${c === 0 ? "col-name" : c > days.length ? "col-tot" : "col-day"} ${sel.c === c ? "is-hl" : ""} ${c === lastCol - 1 ? "tot-a" : c === lastCol ? "tot-b" : ""}`}>{letter(c)}</th>
              ))}
              <th className="filler" />
            </tr>
          </thead>
          <tbody>
            <tr className="head-row">
              <th className={`rownum ${sel.r === -1 ? "is-hl" : ""}`}>1</th>
              <td data-rc="-1:0" tabIndex={-1} className={`col-name hcell ${sel.r === -1 && sel.c === 0 ? "is-sel" : ""}`} onClick={() => setSel({ r: -1, c: 0 })}>Name</td>
              {days.map((d, i) => (
                <td key={d} data-rc={`-1:${i + 1}`} tabIndex={-1} className={`col-day hcell ${d === t ? "is-today" : ""} ${sel.r === -1 && sel.c === i + 1 ? "is-sel" : ""}`} onClick={() => setSel({ r: -1, c: i + 1 })}>
                  <span className="hd-wd">{fmt(d, { weekday: "short" })}</span><span className="hd-dm">{fmt(d, { day: "numeric", month: "short" })}</span>
                </td>
              ))}
              <td data-rc={`-1:${lastCol - 1}`} tabIndex={-1} className={`col-tot tot-a hcell ${sel.r === -1 && sel.c === lastCol - 1 ? "is-sel" : ""}`} onClick={() => setSel({ r: -1, c: lastCol - 1 })}><span className="long">Attended</span><span className="short">✅ Days</span></td>
              <td data-rc={`-1:${lastCol}`} tabIndex={-1} className={`col-tot tot-b hcell ${sel.r === -1 && sel.c === lastCol ? "is-sel" : ""}`} onClick={() => setSel({ r: -1, c: lastCol })}><span className="long">Missed</span><span className="short">❌ Days</span></td>
              <td className="filler" />
            </tr>
            {sheet.people.map((p, r) => {
              const tt = totals(sheet, p.id);
              return (
                <tr key={p.id}>
                  <th className={`rownum ${sel.r === r ? "is-hl" : ""}`} onClick={() => setSel({ r, c: 0 })}>{r + 2}</th>
                  <td data-rc={`${r}:0`} tabIndex={-1} className={`col-name ${sel.r === r && sel.c === 0 ? "is-sel" : ""}`} onClick={() => setSel({ r, c: 0 })}
                    onDoubleClick={() => document.querySelector(".fx-input")?.focus()}>{p.name || <span className="ph">(no name)</span>}</td>
                  {days.map((d, i) => {
                    const m = sheet.marks[k(p.id, d)];
                    const on = sel.r === r && sel.c === i + 1;
                    return (
                      <td key={d} data-rc={`${r}:${i + 1}`} tabIndex={-1} className={`col-day mark ${d === t ? "is-today" : ""} ${on ? "is-sel" : ""}`}
                        onClick={() => setSel({ r, c: i + 1 })}>
                        <span className="pair">
                          <button type="button" tabIndex={-1} className={`box is-p ${m === "p" ? "is-on" : ""}`} aria-pressed={m === "p"}
                            aria-label={`${p.name} present on ${fmt(d, { day: "numeric", month: "short" })}`}
                            onClick={(e) => { e.stopPropagation(); setSel({ r, c: i + 1 }); setMark(p.id, d, m === "p" ? null : "p"); }}>✅</button>
                          <button type="button" tabIndex={-1} className={`box is-a ${m === "a" ? "is-on" : ""}`} aria-pressed={m === "a"}
                            aria-label={`${p.name} absent on ${fmt(d, { day: "numeric", month: "short" })}`}
                            onClick={(e) => { e.stopPropagation(); setSel({ r, c: i + 1 }); setMark(p.id, d, m === "a" ? null : "a"); }}>❌</button>
                        </span>
                      </td>
                    );
                  })}
                  <td data-rc={`${r}:${lastCol - 1}`} tabIndex={-1} className={`col-tot tot-a num ${sel.r === r && sel.c === lastCol - 1 ? "is-sel" : ""}`} onClick={() => setSel({ r, c: lastCol - 1 })}>✅ {tt.here}<span className="unit"> {tt.here === 1 ? "day" : "days"}</span></td>
                  <td data-rc={`${r}:${lastCol}`} tabIndex={-1} className={`col-tot tot-b num ${sel.r === r && sel.c === lastCol ? "is-sel" : ""}`} onClick={() => setSel({ r, c: lastCol })}>❌ {tt.missed}<span className="unit"> {tt.missed === 1 ? "day" : "days"}</span></td>
                  <td className="filler" />
                </tr>
              );
            })}
            <tr className="new-row">
              <th className={`rownum ${sel.r === nRows ? "is-hl" : ""}`}>{nRows + 2}</th>
              <td data-rc={`${nRows}:0`} className={`col-name ${sel.r === nRows && sel.c === 0 ? "is-sel" : ""}`}>
                <input id="new-name" value={newName} placeholder="Type a name, press Enter" spellCheck={false} aria-label="Add a student"
                  onFocus={() => setSel({ r: nRows, c: 0 })} onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); addPeople([newName]); } }}
                  onPaste={(e) => { const tx = e.clipboardData.getData("text"); if (/[\n\r]/.test(tx)) { e.preventDefault(); addPeople(tx.split(/[\n\r]+/).map((l) => l.split("\t")[0])); } }} />
              </td>
              {days.map((d) => <td key={d} className={`col-day ${d === t ? "is-today" : ""}`} />)}
              <td className="col-tot tot-a" /><td className="col-tot tot-b" /><td className="filler" />
            </tr>
            {Array.from({ length: Math.max(0, 14 - nRows) }, (_, i) => (
              <tr key={"e" + i} className="empty-row">
                <th className="rownum">{nRows + 3 + i}</th>
                <td className="col-name" />{days.map((d) => <td key={d} className={`col-day ${d === t ? "is-today" : ""}`} />)}
                <td className="col-tot tot-a" /><td className="col-tot tot-b" /><td className="filler" />
              </tr>
            ))}
          </tbody>
        </table>
        {!days.length && <div className="note">Click <b>Add today</b> in the toolbar to add the first date column.</div>}
      </div>

      <footer className="tabs">
        <button className="tab-add" onClick={onCreate} aria-label="New register" title="New register"><Icon n="plus" size={18} /></button>
        <div className="tab-list">
          {[...sheets].sort((a, b) => (a.created || 0) - (b.created || 0)).map((s) => (
            <button key={s.id} className={`tab ${s.id === sheet.id ? "is-on" : ""}`} onClick={() => s.id !== sheet.id && onOpen(s.id)}>{s.name || "Untitled"}</button>
          ))}
        </div>
      </footer>
      <div className="statusbar"><span>Ready</span><span className="status" aria-live="polite">{status}</span></div>
    </div>
  );
}
