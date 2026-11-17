// Nuvex Attendance
// Two jobs, kept simple: take today's roll in a few taps, and read the register with every total worked out.
import { useEffect, useMemo, useRef, useState } from "react";
import { copyText, dayKey, download, fromKey, loadSheets, newSheet, saveSheets, uid } from "./store.js";

const IS_ARTIFACT = import.meta.env.VITE_ARTIFACT === "1";
const k = (pid, day) => `${pid}|${day}`;
const today = () => dayKey(new Date());
const shift = (day, n) => { const d = fromKey(day); d.setDate(d.getDate() + n); return dayKey(d); };
const fmt = (day, o) => fromKey(day).toLocaleDateString(undefined, o);
const dayLabel = (day) => {
  if (day === today()) return "Today";
  if (day === shift(today(), -1)) return "Yesterday";
  return fmt(day, { weekday: "long" });
};
const initials = (n) => (n.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("") || "?").toUpperCase();
const hue = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
const pct = (a, b) => (b ? Math.round((a / b) * 100) : null);

// ---------- maths ----------

function daysOf(sheet) {
  const set = new Set();
  for (const key of Object.keys(sheet.marks)) set.add(key.slice(key.indexOf("|") + 1));
  return [...set].sort();
}
function statsOf(sheet, pid) {
  let here = 0, missed = 0;
  const missedDays = [];
  for (const [key, v] of Object.entries(sheet.marks)) {
    if (!key.startsWith(pid + "|")) continue;
    if (v === "p") here++;
    else if (v === "a") { missed++; missedDays.push(key.slice(pid.length + 1)); }
  }
  return { here, missed, rate: pct(here, here + missed), missedDays: missedDays.sort().reverse() };
}
function classRate(sheet) {
  let here = 0, all = 0;
  for (const v of Object.values(sheet.marks)) { all++; if (v === "p") here++; }
  return pct(here, all);
}
function tableOf(sheet, sep) {
  const days = daysOf(sheet);
  const cell = (v) => (sep === "," ? `"${String(v ?? "").replace(/"/g, '""')}"` : String(v ?? "").replace(/[\t\n]/g, " "));
  const rows = [["Name", ...days, "Days attended", "Days missed", "Attendance %"]];
  for (const p of sheet.people) {
    const s = statsOf(sheet, p.id);
    rows.push([p.name, ...days.map((d) => ({ p: "✓", a: "✗" })[sheet.marks[k(p.id, d)]] || ""), s.here, s.missed, s.rate ?? ""]);
  }
  return rows.map((r) => r.map(cell).join(sep)).join("\n");
}

// ---------- small pieces ----------

const I = {
  back: <path d="M15 5l-7 7 7 7" />,
  left: <path d="M14 6l-6 6 6 6" />,
  right: <path d="M10 6l6 6-6 6" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  cross: <path d="M7 7l10 10M17 7L7 17" />,
  plus: <path d="M12 5v14M5 12h14" />,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4 4" /></>,
  copy: <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h8" /></>,
  down: <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />,
  more: <><circle cx="5" cy="12" r="1.3" /><circle cx="12" cy="12" r="1.3" /><circle cx="19" cy="12" r="1.3" /></>,
  cal: <><rect x="3.5" y="5" width="17" height="15.5" rx="3" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>,
  grid: <><rect x="3.5" y="4" width="17" height="16" rx="2.5" /><path d="M3.5 9.5h17M3.5 15h17M9.5 4v16" /></>,
  roll: <><path d="M9 6h11M9 12h11M9 18h11" /><path d="M3.5 6l1.2 1.2L7 5M3.5 12l1.2 1.2L7 11M3.5 18l1.2 1.2L7 17" /></>,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18.5 14.5a6.5 6.5 0 0 1 3 5.5" /></>,
  trash: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />,
};
const Icon = ({ n, size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{I[n]}</svg>
);

function Avatar({ name, size = 40 }) {
  const h = hue(name || "?");
  return <span className="avatar" style={{ "--h": h, width: size, height: size, fontSize: size * 0.38 }} aria-hidden="true">{initials(name)}</span>;
}

function Ring({ value, total, size = 92 }) {
  const r = (size - 12) / 2, c = 2 * Math.PI * r, f = total ? value / total : 0;
  return (
    <svg className="ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} className="ring-track" />
      <circle cx={size / 2} cy={size / 2} r={r} className="ring-fill" strokeDasharray={`${c * f} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
    </svg>
  );
}

function Sheet({ title, onClose, children }) {
  useEffect(() => {
    const esc = (e) => e.key === "Escape" && onClose();
    addEventListener("keydown", esc);
    return () => removeEventListener("keydown", esc);
  }, [onClose]);
  return (
    <div className="sheet-back" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" />
        {children}
      </div>
    </div>
  );
}

function AddStudents({ onAdd, autoFocus }) {
  const [text, setText] = useState("");
  const names = text.split(/\n|,/).map((s) => s.trim()).filter(Boolean);
  return (
    <form className="add-form" onSubmit={(e) => { e.preventDefault(); if (names.length) { onAdd(names); setText(""); } }}>
      <textarea id="add-names" className="field" rows={5} value={text} autoFocus={autoFocus} onChange={(e) => setText(e.target.value)}
        placeholder={"Type or paste names, one per line\n\nAmara Okafor\nJordan Lee\nLuis Ortega"} aria-label="Student names" />
      <button className="btn btn-primary btn-block" type="submit" disabled={!names.length}>
        <Icon n="plus" size={18} />{names.length > 1 ? `Add ${names.length} students` : "Add student"}
      </button>
    </form>
  );
}

// ---------- app ----------

export default function App() {
  const [sheets, setSheets] = useState(loadSheets);
  const [openId, setOpenId] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(0);

  useEffect(() => { const t = setTimeout(() => saveSheets(sheets), 150); return () => clearTimeout(t); }, [sheets]);

  /** Change something and offer to undo it. */
  const withUndo = (message, change) => {
    const before = sheets;
    change();
    clearTimeout(toastTimer.current);
    setToast({ message, undo: () => { setSheets(before); setToast(null); } });
    toastTimer.current = setTimeout(() => setToast(null), 6000);
  };

  const sheet = sheets.find((s) => s.id === openId);
  const update = (id, fn) => setSheets((all) => all.map((s) => (s.id === id ? fn(s) : s)));

  return (
    <>
      {sheet ? (
        <ClassScreen key={sheet.id} sheet={sheet} update={(fn) => update(sheet.id, fn)} onBack={() => setOpenId(null)} withUndo={withUndo}
          onDelete={() => withUndo(`Deleted ${sheet.name || "class"}`, () => { setSheets((all) => all.filter((s) => s.id !== sheet.id)); setOpenId(null); })} />
      ) : (
        <Home sheets={sheets} onOpen={setOpenId}
          onCreate={(name) => { const s = newSheet(name); setSheets((all) => [...all, s]); setOpenId(s.id); }} />
      )}
      {toast && (
        <div className="toast" role="status">
          <span>{toast.message}</span>
          <button onClick={toast.undo}>Undo</button>
        </div>
      )}
    </>
  );
}

// ---------- home ----------

function Home({ sheets, onOpen, onCreate }) {
  const [name, setName] = useState("");
  const t = today();
  return (
    <div className="page home">
      <header className="brand">
        <span className="logo" aria-hidden="true"><Icon n="check" size={18} /></span>
        <span>Nuvex Attendance</span>
      </header>

      <h1 className="h1">{sheets.length ? "Your classes" : "Start your first class"}</h1>
      <p className="lede">{fmt(t, { weekday: "long", day: "numeric", month: "long" })}</p>

      <div className="class-list">
        {sheets.map((s) => {
          const taken = s.people.some((p) => s.marks[k(p.id, t)]);
          const here = s.people.filter((p) => s.marks[k(p.id, t)] === "p").length;
          const rate = classRate(s);
          return (
            <button key={s.id} className="class-card" onClick={() => onOpen(s.id)}>
              <span className="class-top">
                <span className="class-name">{s.name || "Untitled class"}</span>
                <span className={`pill ${taken ? "is-done" : ""}`}>{taken ? `Today ${here}/${s.people.length}` : "Not taken today"}</span>
              </span>
              <span className="class-meta">
                <span><Icon n="users" size={16} />{s.people.length} student{s.people.length === 1 ? "" : "s"}</span>
                <span><Icon n="cal" size={16} />{daysOf(s).length} day{daysOf(s).length === 1 ? "" : "s"}</span>
                {rate != null && <span className="class-rate">{rate}% attendance</span>}
              </span>
            </button>
          );
        })}
      </div>

      <form className="new-class" onSubmit={(e) => { e.preventDefault(); onCreate(name.trim() || `Class ${sheets.length + 1}`); setName(""); }}>
        <input id="new-class" className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="New class name, e.g. Primary 4B" aria-label="New class name" />
        <button className="btn btn-primary" type="submit"><Icon n="plus" size={18} />Create</button>
      </form>
      <p className="fine">Saved on this device. Nothing is sent anywhere.</p>
    </div>
  );
}

// ---------- one class ----------

function ClassScreen({ sheet, update, onBack, withUndo, onDelete }) {
  const [tab, setTab] = useState(sheet.people.length && daysOf(sheet).length ? "take" : "take");
  const [day, setDay] = useState(today);
  const [student, setStudent] = useState(null);
  const [adding, setAdding] = useState(false);
  const [menu, setMenu] = useState(false);

  const setMark = (pid, d, v) => update((s) => {
    const marks = { ...s.marks };
    if (v) marks[k(pid, d)] = v; else delete marks[k(pid, d)];
    return { ...s, marks };
  });
  const addPeople = (names) => { update((s) => ({ ...s, people: [...s.people, ...names.map((name) => ({ id: uid(), name }))] })); setAdding(false); };
  const removePerson = (p) => withUndo(`Removed ${p.name}`, () => {
    update((s) => ({ ...s, people: s.people.filter((x) => x.id !== p.id), marks: Object.fromEntries(Object.entries(s.marks).filter(([key]) => !key.startsWith(p.id + "|"))) }));
    setStudent(null);
  });
  const openDay = (d) => { setDay(d); setTab("take"); };
  const sel = sheet.people.find((p) => p.id === student);

  return (
    <div className="page cls">
      <header className="bar">
        <button className="icon-btn" onClick={onBack} aria-label="All classes"><Icon n="back" /></button>
        <input id="class-name" className="bar-title" value={sheet.name} placeholder="Class name" aria-label="Class name"
          onChange={(e) => update((s) => ({ ...s, name: e.target.value }))} />
        <div className="menu-wrap">
          <button className="icon-btn" onClick={() => setMenu((m) => !m)} aria-label="More" aria-expanded={menu}><Icon n="more" /></button>
          {menu && (
            <div className="menu" onClick={() => setMenu(false)}>
              <button onClick={() => setAdding(true)}><Icon n="plus" size={18} />Add students</button>
              <button className="is-danger" onClick={onDelete}><Icon n="trash" size={18} />Delete class</button>
            </div>
          )}
        </div>
      </header>

      <nav className="seg" role="tablist">
        <button role="tab" aria-selected={tab === "take"} className={tab === "take" ? "is-on" : ""} onClick={() => setTab("take")}><Icon n="roll" size={18} />Take attendance</button>
        <button role="tab" aria-selected={tab === "register"} className={tab === "register" ? "is-on" : ""} onClick={() => setTab("register")}><Icon n="grid" size={18} />Register</button>
      </nav>

      {!sheet.people.length ? (
        <section className="empty">
          <h2 className="h2">Add your students</h2>
          <p className="muted">Type them in, or paste a list from WhatsApp, Excel or Google Sheets.</p>
          <AddStudents onAdd={addPeople} />
        </section>
      ) : tab === "take" ? (
        <TakeView sheet={sheet} day={day} setDay={setDay} setMark={setMark} update={update} onStudent={setStudent} onAdd={() => setAdding(true)} />
      ) : (
        <RegisterView sheet={sheet} setMark={setMark} onStudent={setStudent} onDay={openDay} onAdd={() => setAdding(true)} />
      )}

      {adding && (
        <Sheet title="Add students" onClose={() => setAdding(false)}>
          <h2 className="h2">Add students</h2>
          <AddStudents onAdd={addPeople} autoFocus />
        </Sheet>
      )}
      {sel && (
        <StudentSheet sheet={sheet} person={sel} onClose={() => setStudent(null)} onRemove={() => removePerson(sel)}
          onRename={(name) => update((s) => ({ ...s, people: s.people.map((p) => (p.id === sel.id ? { ...p, name } : p)) }))}
          onDay={(d) => { setStudent(null); openDay(d); }} />
      )}
    </div>
  );
}

// ---------- take attendance ----------

function TakeView({ sheet, day, setDay, setMark, update, onStudent, onAdd }) {
  const people = sheet.people;
  const here = people.filter((p) => sheet.marks[k(p.id, day)] === "p").length;
  const away = people.filter((p) => sheet.marks[k(p.id, day)] === "a").length;
  const left = people.length - here - away;
  const isFuture = day > today();

  const fillRest = () => update((s) => {
    const marks = { ...s.marks };
    for (const p of s.people) if (!marks[k(p.id, day)]) marks[k(p.id, day)] = "p";
    return { ...s, marks };
  });

  return (
    <section className="take">
      <div className="day-bar">
        <button className="icon-btn" onClick={() => setDay(shift(day, -1))} aria-label="Previous day"><Icon n="left" /></button>
        <label className="day-pick">
          <span className="day-big">{dayLabel(day)}</span>
          <span className="day-small">{fmt(day, { day: "numeric", month: "long", year: "numeric" })}</span>
          <input id="pick-day" type="date" value={day} onChange={(e) => e.target.value && setDay(e.target.value)} aria-label="Choose a day" />
        </label>
        <button className="icon-btn" onClick={() => setDay(shift(day, 1))} disabled={day >= today()} aria-label="Next day"><Icon n="right" /></button>
      </div>

      <div className="summary">
        <div className="ring-box">
          <Ring value={here} total={people.length} />
          <span className="ring-num"><b>{here}</b><small>of {people.length}</small></span>
        </div>
        <div className="sum-text">
          <div className="sum-row"><span className="dot is-p" />Present <b>{here}</b></div>
          <div className="sum-row"><span className="dot is-a" />Absent <b>{away}</b></div>
          <div className="sum-row"><span className="dot" />Not marked <b>{left}</b></div>
        </div>
      </div>
      {left > 0 && !isFuture && (
        <button className="btn btn-soft btn-block" onClick={fillRest}><Icon n="check" size={18} />Mark the other {left} present</button>
      )}

      <ul className="roll">
        {people.map((p) => {
          const m = sheet.marks[k(p.id, day)];
          const s = statsOf(sheet, p.id);
          return (
            <li key={p.id} className={`roll-row ${m ? "has-" + m : ""}`}>
              <button className="who" onClick={() => onStudent(p.id)}>
                <Avatar name={p.name} />
                <span className="who-text">
                  <span className="who-name">{p.name}</span>
                  <span className="who-sub"><span className="t-p">{s.here} attended</span> · <span className="t-a">{s.missed} missed</span></span>
                </span>
              </button>
              <div className="mark-pair" role="group" aria-label={`${p.name} on ${fmt(day, { day: "numeric", month: "short" })}`}>
                <button className={`mark is-p ${m === "p" ? "is-on" : ""}`} aria-pressed={m === "p"} aria-label="Present"
                  onClick={() => setMark(p.id, day, m === "p" ? null : "p")}><Icon n="check" size={22} /></button>
                <button className={`mark is-a ${m === "a" ? "is-on" : ""}`} aria-pressed={m === "a"} aria-label="Absent"
                  onClick={() => setMark(p.id, day, m === "a" ? null : "a")}><Icon n="cross" size={22} /></button>
              </div>
            </li>
          );
        })}
      </ul>
      <button className="btn btn-ghost btn-block" onClick={onAdd}><Icon n="plus" size={18} />Add students</button>
    </section>
  );
}

// ---------- register ----------

function RegisterView({ sheet, setMark, onStudent, onDay, onAdd }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("list");
  const [copied, setCopied] = useState(false);
  const days = daysOf(sheet);
  const rows = useMemo(() => {
    const list = sheet.people.map((p) => ({ p, s: statsOf(sheet, p.id) }))
      .filter(({ p }) => p.name.toLowerCase().includes(q.trim().toLowerCase()));
    if (sort === "az") list.sort((a, b) => a.p.name.localeCompare(b.p.name));
    if (sort === "missed") list.sort((a, b) => b.s.missed - a.s.missed || a.p.name.localeCompare(b.p.name));
    if (sort === "best") list.sort((a, b) => (b.s.rate ?? -1) - (a.s.rate ?? -1) || a.p.name.localeCompare(b.p.name));
    return list;
  }, [sheet, q, sort]);
  const fileName = (sheet.name || "Attendance").replace(/[\\/:*?"<>|]/g, "");
  const cycle = (pid, d) => setMark(pid, d, { undefined: "p", p: "a", a: null }[sheet.marks[k(pid, d)]]);

  return (
    <section className="reg">
      <div className="reg-tools">
        <label className="search"><Icon n="search" size={18} />
          <input id="find" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a student" aria-label="Find a student" />
        </label>
        <select id="sort" className="select" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort">
          <option value="list">Class order</option>
          <option value="az">A to Z</option>
          <option value="missed">Most missed</option>
          <option value="best">Best attendance</option>
        </select>
        <button className="btn btn-quiet" onClick={async () => { if (await copyText(tableOf(sheet, "\t"))) { setCopied(true); setTimeout(() => setCopied(false), 1600); } }}>
          <Icon n="copy" size={18} /><span>{copied ? "Copied" : "Copy"}</span>
        </button>
        {!IS_ARTIFACT && (
          <button className="btn btn-quiet" onClick={() => download(`${fileName}.csv`, "﻿" + tableOf(sheet, ","), "text/csv")}>
            <Icon n="down" size={18} /><span>Excel</span>
          </button>
        )}
      </div>

      {!days.length ? (
        <div className="empty-note">No days yet. Take attendance once and the register fills in here.</div>
      ) : (
        <div className="grid-wrap">
          <table className="grid">
            <thead>
              <tr>
                <th className="g-name">Student</th>
                {days.map((d) => (
                  <th key={d} className="g-day">
                    <button onClick={() => onDay(d)} title={fmt(d, { weekday: "long", day: "numeric", month: "long" })}>
                      <small>{fmt(d, { weekday: "short" })}</small>{fmt(d, { day: "numeric", month: "short" })}
                    </button>
                  </th>
                ))}
                <th className="g-gap" />
                <th className="g-tot is-p">Attended</th>
                <th className="g-tot is-a">Missed</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ p, s }) => (
                <tr key={p.id}>
                  <th className="g-name" scope="row">
                    <button onClick={() => onStudent(p.id)}>
                      <span className="g-who">{p.name}</span>
                      {s.rate != null && <span className={`g-rate ${s.rate < 75 ? "is-low" : ""}`}>{s.rate}%</span>}
                    </button>
                  </th>
                  {days.map((d) => {
                    const m = sheet.marks[k(p.id, d)];
                    return (
                      <td key={d} className="g-day">
                        <button className={m ? `is-${m}` : ""} onClick={() => cycle(p.id, d)}
                          aria-label={`${p.name}, ${fmt(d, { day: "numeric", month: "short" })}: ${m === "p" ? "present" : m === "a" ? "absent" : "not marked"}`}>
                          {m === "p" ? <Icon n="check" size={18} /> : m === "a" ? <Icon n="cross" size={18} /> : ""}
                        </button>
                      </td>
                    );
                  })}
                  <td className="g-gap" />
                  <td className="g-tot is-p">{s.here}</td>
                  <td className="g-tot is-a">{s.missed}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th className="g-name" scope="row">Present</th>
                {days.map((d) => <td key={d} className="g-day">{sheet.people.filter((p) => sheet.marks[k(p.id, d)] === "p").length}</td>)}
                <td className="g-gap" /><td className="g-tot" /><td className="g-tot" />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      <p className="fine">Tap a box to change it: ✓ present, ✗ absent, blank. Tap a date to open that day.</p>
      <button className="btn btn-ghost btn-block" onClick={onAdd}><Icon n="plus" size={18} />Add students</button>
    </section>
  );
}

// ---------- one student ----------

function StudentSheet({ sheet, person, onClose, onRename, onRemove, onDay }) {
  const s = statsOf(sheet, person.id);
  return (
    <Sheet title={person.name} onClose={onClose}>
      <div className="st-head">
        <Avatar name={person.name} size={56} />
        <input id="student-name" className="st-name" value={person.name} aria-label="Student name" onChange={(e) => onRename(e.target.value)} />
      </div>
      <div className="tiles">
        <div className="tile is-p"><b>{s.here}</b><span>Days attended</span></div>
        <div className="tile is-a"><b>{s.missed}</b><span>Days missed</span></div>
        <div className="tile"><b>{s.rate == null ? "–" : s.rate + "%"}</b><span>Attendance</span></div>
      </div>
      {s.rate != null && <div className="bar-meter" aria-hidden="true"><span style={{ width: `${s.rate}%` }} /></div>}
      <h3 className="h3">Days missed</h3>
      {s.missedDays.length ? (
        <ul className="missed">
          {s.missedDays.map((d) => (
            <li key={d}><button onClick={() => onDay(d)}>{fmt(d, { weekday: "long", day: "numeric", month: "long" })}<Icon n="right" size={16} /></button></li>
          ))}
        </ul>
      ) : <p className="muted">No days missed.</p>}
      <button className="btn btn-danger btn-block" onClick={onRemove}><Icon n="trash" size={18} />Remove from class</button>
    </Sheet>
  );
}
