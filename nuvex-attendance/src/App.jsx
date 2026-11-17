// Nuvex Attendance
// Home: every class as a glass tile. Inside a class: one plain ruled sheet.
// Name | a column per date with ✅ ❌ boxes | ✅ days attended | ❌ days missed.
import { useEffect, useRef, useState } from "react";
import { copyText, dayKey, download, fromKey, loadSheets, newSheet, saveSheets, uid } from "./store.js";

const IS_ARTIFACT = import.meta.env.VITE_ARTIFACT === "1";
const k = (pid, day) => `${pid}|${day}`;
const today = () => dayKey(new Date());
const fmt = (day, o) => fromKey(day).toLocaleDateString(undefined, o);
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : w.endsWith("s") ? "es" : "s"}`;

// ---------- data helpers ----------

/** Dates on the sheet: the columns that were added, plus any date that has a mark. */
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
  return { here, missed };
}
function nextDay(days) {
  const t = today();
  if (!days.includes(t) && (!days.length || days[days.length - 1] < t)) return t;
  const d = fromKey(days[days.length - 1] || t);
  do { d.setDate(d.getDate() + 1); } while (d.getDay() === 0 || d.getDay() === 6 || days.includes(dayKey(d)));
  return dayKey(d);
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

const Svg = ({ children, size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);
const Moon = () => <Svg><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" /></Svg>;
const Sun = () => <Svg><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" /></Svg>;
const Back = () => <Svg><path d="M15 5l-7 7 7 7" /></Svg>;
const More = () => <Svg><circle cx="5" cy="12" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="19" cy="12" r="1.2" /></Svg>;
const Plus = ({ size }) => <Svg size={size}><path d="M12 5v14M5 12h14" /></Svg>;
const X = ({ size = 14 }) => <Svg size={size}><path d="M7 7l10 10M17 7L7 17" /></Svg>;

function ThemeButton({ mode, toggle, className = "" }) {
  return (
    <button className={`theme-btn ${className}`} onClick={toggle} aria-label={mode === "dark" ? "White mode" : "Dark mode"} title={mode === "dark" ? "White mode" : "Dark mode"}>
      {mode === "dark" ? <Sun /> : <Moon />}
    </button>
  );
}

// ---------- app ----------

export default function App() {
  const [sheets, setSheets] = useState(loadSheets);
  const [openId, setOpenId] = useState(null);
  const [mode, toggle] = useTheme();
  const [toast, setToast] = useState(null);
  const timer = useRef(0);
  const latest = useRef(sheets);
  latest.current = sheets;

  useEffect(() => { const t = setTimeout(() => saveSheets(sheets), 150); return () => clearTimeout(t); }, [sheets]);

  /** Make a change that can be undone from the message at the bottom. */
  const withUndo = (message, change) => {
    const before = latest.current;
    change();
    clearTimeout(timer.current);
    setToast({ message, undo: () => { setSheets(before); setToast(null); } });
    timer.current = setTimeout(() => setToast(null), 6000);
  };

  const sheet = sheets.find((s) => s.id === openId);
  const update = (fn) => setSheets((all) => all.map((s) => (s.id === openId ? fn(s) : s)));

  return (
    <>
      {sheet ? (
        <ClassSheet key={sheet.id} sheet={sheet} update={update} mode={mode} toggle={toggle} withUndo={withUndo}
          onBack={() => setOpenId(null)}
          onDelete={() => withUndo(`Deleted ${sheet.name || "class"}`, () => { setSheets((all) => all.filter((s) => s.id !== sheet.id)); setOpenId(null); })} />
      ) : (
        <Home sheets={sheets} mode={mode} toggle={toggle} onOpen={setOpenId}
          onCreate={(name) => { const s = { ...newSheet(name), cols: [] }; setSheets((all) => [...all, s]); setOpenId(s.id); }} />
      )}
      {toast && (
        <div className="toast" role="status"><span>{toast.message}</span><button onClick={toast.undo}>Undo</button></div>
      )}
    </>
  );
}

// ---------- home ----------

function Week({ sheet }) {
  // The last seven dates on the sheet, each as a bar: how much of the class was there.
  const days = daysOf(sheet).slice(-7);
  const n = sheet.people.length;
  return (
    <span className="week" aria-hidden="true">
      {Array.from({ length: 7 }, (_, i) => {
        const d = days[i - (7 - days.length)];
        const here = d ? sheet.people.filter((p) => sheet.marks[k(p.id, d)] === "p").length : 0;
        return <i key={i} style={{ "--f": d && n ? here / n : 0 }} className={d ? "" : "is-empty"} />;
      })}
    </span>
  );
}

function Home({ sheets, mode, toggle, onOpen, onCreate }) {
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const t = today();
  let here = 0, away = 0, students = 0;
  for (const s of sheets) {
    students += s.people.length;
    for (const p of s.people) { const m = s.marks[k(p.id, t)]; if (m === "p") here++; else if (m === "a") away++; }
  }

  return (
    <div className="home">
      <div className="aura" aria-hidden="true"><b /><b /><b /></div>
      <div className="home-in">
        <header className="home-top">
          <span className="mark-logo" aria-hidden="true">✓</span>
          <span className="home-brand">Nuvex Attendance</span>
          <ThemeButton mode={mode} toggle={toggle} className="glass" />
        </header>

        <section className="hero glass">
          <span className="hero-day">{fmt(t, { weekday: "long" })}</span>
          <span className="hero-date">{fmt(t, { day: "numeric", month: "long" })}</span>
          <span className="hero-stats">
            <span><b>✅ {here}</b> here today</span>
            <span><b>❌ {away}</b> away</span>
            <span><b>{students}</b> {students === 1 ? "student" : "students"} · {plural(sheets.length, "class")}</span>
          </span>
        </section>

        <h2 className="home-h">Classes</h2>
        <div className="tiles">
          {sheets.map((s) => {
            const taken = s.people.filter((p) => s.marks[k(p.id, t)]).length;
            const ok = s.people.filter((p) => s.marks[k(p.id, t)] === "p").length;
            return (
              <button key={s.id} className="tile glass" onClick={() => onOpen(s.id)}>
                <span className="tile-name">{s.name || "Untitled class"}</span>
                <span className="tile-sub">{plural(s.people.length, "student")}</span>
                <Week sheet={s} />
                <span className="tile-today">{taken ? `Today ✅ ${ok} · ❌ ${taken - ok}` : "Today not taken"}</span>
              </button>
            );
          })}

          {naming ? (
            <form className="tile glass is-new is-open" onSubmit={(e) => { e.preventDefault(); onCreate(name.trim() || `Class ${sheets.length + 1}`); }}>
              <input id="new-class" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Class name" aria-label="Class name"
                onKeyDown={(e) => e.key === "Escape" && setNaming(false)} />
              <button className="create" type="submit">Create</button>
            </form>
          ) : (
            <button className="tile glass is-new" onClick={() => setNaming(true)}>
              <Plus size={26} /><span>New class</span>
            </button>
          )}
        </div>
        <p className="home-foot">Each class keeps its own register. Saved on this device.</p>
      </div>
    </div>
  );
}

// ---------- the sheet ----------

function ClassSheet({ sheet, update, mode, toggle, withUndo, onBack, onDelete }) {
  const [menu, setMenu] = useState(false);
  const [newName, setNewName] = useState("");
  const [copied, setCopied] = useState(false);
  const wrap = useRef(null);
  const days = daysOf(sheet);
  const t = today();

  const setMark = (pid, d, v) => update((s) => {
    const marks = { ...s.marks };
    if (marks[k(pid, d)] === v) delete marks[k(pid, d)]; else marks[k(pid, d)] = v;
    return { ...s, marks };
  });
  const addDay = () => {
    update((s) => ({ ...s, cols: [...(s.cols || []), nextDay(daysOf(s))] }));
    setTimeout(() => { const el = wrap.current; if (el) el.scrollLeft = el.scrollWidth; }, 40);
  };
  const changeDay = (from, to) => {
    if (!to || to === from || days.includes(to)) return;
    update((s) => {
      const marks = {};
      for (const [key, v] of Object.entries(s.marks)) {
        const i = key.indexOf("|"), d = key.slice(i + 1);
        marks[d === from ? key.slice(0, i + 1) + to : key] = v;
      }
      return { ...s, cols: [...(s.cols || []).filter((c) => c !== from), to], marks };
    });
  };
  const removeDay = (d) => withUndo(`Removed ${fmt(d, { day: "numeric", month: "short" })}`, () => update((s) => ({
    ...s, cols: (s.cols || []).filter((c) => c !== d),
    marks: Object.fromEntries(Object.entries(s.marks).filter(([key]) => !key.endsWith("|" + d))),
  })));
  const addNames = (names) => {
    const clean = names.map((n) => n.trim()).filter(Boolean);
    if (!clean.length) return;
    update((s) => ({ ...s, people: [...s.people, ...clean.map((name) => ({ id: uid(), name }))] }));
    setNewName("");
  };
  const removePerson = (p) => withUndo(`Removed ${p.name || "student"}`, () => update((s) => ({
    ...s, people: s.people.filter((x) => x.id !== p.id),
    marks: Object.fromEntries(Object.entries(s.marks).filter(([key]) => !key.startsWith(p.id + "|"))),
  })));
  const fileName = (sheet.name || "Attendance").replace(/[\\/:*?"<>|]/g, "");

  return (
    <div className="paper">
      <header className="sheet-top">
        <button className="plain-btn" onClick={onBack} aria-label="All classes"><Back /></button>
        <input id="class-name" className="sheet-title" value={sheet.name} placeholder="Class name" aria-label="Class name"
          onChange={(e) => update((s) => ({ ...s, name: e.target.value }))} />
        <ThemeButton mode={mode} toggle={toggle} className="plain-btn" />
        <div className="menu-wrap">
          <button className="plain-btn" onClick={() => setMenu((m) => !m)} aria-label="More" aria-expanded={menu}><More /></button>
          {menu && (
            <div className="menu" onClick={() => setMenu(false)}>
              <button disabled={!sheet.people.length}
                onClick={async () => { if (await copyText(tableOf(sheet, "\t"))) { setCopied(true); setTimeout(() => setCopied(false), 1600); } }}>
                Copy sheet for Google Sheets
              </button>
              {!IS_ARTIFACT && (
                <button disabled={!sheet.people.length} onClick={() => download(`${fileName}.csv`, "﻿" + tableOf(sheet, ","), "text/csv")}>Download for Excel</button>
              )}
              <button className="is-danger" onClick={onDelete}>Delete this class</button>
            </div>
          )}
        </div>
      </header>

      <div className="sheet-bar">
        <span className="sheet-count">{plural(sheet.people.length, "student")} · {plural(days.length, "day")}</span>
        {copied && <span className="sheet-count">Copied</span>}
        <button className="add-day" onClick={addDay}><Plus size={16} />{days.includes(t) ? "Add day" : "Add today"}</button>
      </div>

      <div className="sheet-wrap" ref={wrap}>
        <table className="sheet">
          <thead>
            <tr>
              <th className="c-no">#</th>
              <th className="c-name">Name</th>
              {days.map((d) => (
                <th key={d} className={`c-day ${d === t ? "is-today" : ""}`}>
                  <span className="day-head">
                    <label className="day-label" title="Change date">
                      <span className="day-wd">{fmt(d, { weekday: "short" })}</span>
                      <span className="day-dm">{fmt(d, { day: "numeric", month: "short" })}</span>
                      <input type="date" value={d} onChange={(e) => changeDay(d, e.target.value)} aria-label={`Change date ${d}`} />
                    </label>
                    <button className="day-x" onClick={() => removeDay(d)} aria-label={`Remove ${fmt(d, { day: "numeric", month: "short" })}`}><X size={12} /></button>
                  </span>
                </th>
              ))}
              <th className="c-fill" />
              <th className="c-tot"><span className="tot"><span className="is-p">Attended</span><span className="is-a">Missed</span></span></th>
            </tr>
          </thead>
          <tbody>
            {sheet.people.map((p, i) => {
              const tt = totals(sheet, p.id);
              return (
                <tr key={p.id}>
                  <td className="c-no">{i + 1}</td>
                  <td className="c-name">
                    <span className="name-cell">
                      <input value={p.name} aria-label={`Name ${i + 1}`} spellCheck={false}
                        onChange={(e) => update((s) => ({ ...s, people: s.people.map((x) => (x.id === p.id ? { ...x, name: e.target.value } : x)) }))} />
                      <button className="row-x" onClick={() => removePerson(p)} aria-label={`Remove ${p.name}`}><X /></button>
                    </span>
                  </td>
                  {days.map((d) => {
                    const m = sheet.marks[k(p.id, d)];
                    return (
                      <td key={d} className={`c-day ${d === t ? "is-today" : ""}`}>
                        <span className="pair">
                          <button className={`box ${m === "p" ? "is-on" : ""}`} aria-pressed={m === "p"} onClick={() => setMark(p.id, d, "p")}
                            aria-label={`${p.name} present ${fmt(d, { day: "numeric", month: "short" })}`}>✅</button>
                          <button className={`box ${m === "a" ? "is-on" : ""}`} aria-pressed={m === "a"} onClick={() => setMark(p.id, d, "a")}
                            aria-label={`${p.name} absent ${fmt(d, { day: "numeric", month: "short" })}`}>❌</button>
                        </span>
                      </td>
                    );
                  })}
                  <td className="c-fill" />
                  <td className="c-tot"><span className="tot"><span className="is-p">✅ {plural(tt.here, "day")}</span><span className="is-a">❌ {plural(tt.missed, "day")}</span></span></td>
                </tr>
              );
            })}
            <tr className="add-row">
              <td className="c-no"><Plus size={14} /></td>
              <td className="c-name">
                <input id="add-name" value={newName} placeholder="Write a name, press Enter" aria-label="Add a student" spellCheck={false}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addNames([newName]); } }}
                  onPaste={(e) => {
                    const text = e.clipboardData.getData("text");
                    if (/[\n\r]/.test(text)) { e.preventDefault(); addNames(text.split(/[\n\r]+/).map((l) => l.split("\t")[0])); }
                  }} />
              </td>
              {days.map((d) => <td key={d} className={`c-day ${d === t ? "is-today" : ""}`} />)}
              <td className="c-fill" /><td className="c-tot" />
            </tr>
          </tbody>
        </table>
      </div>

      {!days.length && sheet.people.length > 0 && <p className="hint">Tap <b>Add today</b> to start a date column.</p>}
      {!sheet.people.length && <p className="hint">Write the first name in the sheet. You can also paste a whole list.</p>}
    </div>
  );
}
