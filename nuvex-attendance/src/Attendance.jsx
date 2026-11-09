// Attendance: a register per group. Pick a day, tap each person's status, and the totals count themselves.
import { useEffect, useMemo, useRef, useState } from "react";
import { deleteRegister, download, loadRegisters, saveRegister, timeAgo, uid } from "./store.js";
import { IArrowLeft, IChevronLeft, IChevronRight, IDownload, IPlus, ITrash } from "./icons.jsx";

// "Here" counts present and late. "Missed" counts absent and excused (excused is also shown on its own).
export const STATUSES = [
  { id: "p", label: "Present", short: "P" },
  { id: "l", label: "Late", short: "L" },
  { id: "a", label: "Absent", short: "A" },
  { id: "e", label: "Excused", short: "E" },
];

const pad = (n) => String(n).padStart(2, "0");
const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromKey = (k) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
const shiftDay = (k, n) => { const d = fromKey(k); d.setDate(d.getDate() + n); return dayKey(d); };
const prettyDay = (k, long) => fromKey(k).toLocaleDateString(undefined, long
  ? { weekday: "long", day: "numeric", month: "long", year: "numeric" }
  : { weekday: "short", day: "numeric", month: "short" });

export function newRegister(name = "") {
  return { id: uid(), name, people: [], days: {} };
}

/** Per-person totals across every day that has been marked. */
export function totals(reg) {
  return reg.people.map((p) => {
    const t = { p: 0, l: 0, a: 0, e: 0, missedDays: [] };
    for (const [day, marks] of Object.entries(reg.days || {})) {
      const s = marks[p.id];
      if (!s) continue;
      t[s]++;
      if (s === "a" || s === "e") t.missedDays.push({ day, s });
    }
    t.missedDays.sort((x, y) => (x.day < y.day ? 1 : -1));
    const marked = t.p + t.l + t.a + t.e;
    return { person: p, ...t, here: t.p + t.l, missed: t.a + t.e, marked, rate: marked ? Math.round(((t.p + t.l) / marked) * 100) : null };
  });
}

function toCSV(reg) {
  const cell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const days = Object.keys(reg.days || {}).sort();
  const label = Object.fromEntries(STATUSES.map((s) => [s.id, s.label]));
  const rows = [["Name", "Days here", "Days missed", "Late", "Excused", "Attendance %", ...days].map(cell).join(",")];
  totals(reg).forEach((t) => {
    rows.push([t.person.name, t.here, t.missed, t.l, t.e, t.rate ?? "", ...days.map((d) => label[reg.days[d][t.person.id]] || "")].map(cell).join(","));
  });
  return rows.join("\n");
}

// ---------- All registers ----------

export function AttendanceHome() {
  const [regs, setRegs] = useState(loadRegisters);
  const [name, setName] = useState("");

  const create = (e) => {
    e.preventDefault();
    const r = newRegister(name.trim() || "Untitled group");
    saveRegister(r);
    location.hash = `#/g/${r.id}`;
  };

  return (
    <section className="page narrow">
      <h1 className="page-title">Who showed up</h1>
      <p className="lede">Make a group, add the people in it, and tick them off each day. Nuvex counts how many days each person was here and how many they missed.</p>

      <form className="at-new" onSubmit={create}>
        <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Group name, e.g. Under-16s, Monday class, Studio team" aria-label="Group name" />
        <button className="btn btn-primary" type="submit"><IPlus size={16} />Create</button>
      </form>

      {regs.length > 0 && (
        <>
          <h2 className="start-h at-h">Your groups</h2>
          <div className="table">
            {regs.map((r) => {
              const days = Object.keys(r.days || {}).length;
              return (
                <div className="table-row is-forms" key={r.id}>
                  <a className="table-title" href={`#/g/${r.id}`}>
                    <span className="form-dot" aria-hidden="true">{(r.name || "G").trim().charAt(0).toUpperCase()}</span>
                    <span className="l-row-name">{r.name || "Untitled group"}<small>{r.people.length} {r.people.length === 1 ? "person" : "people"} · {days} day{days === 1 ? "" : "s"} taken</small></span>
                  </a>
                  <span className="muted hide-sm">{r.updated ? `Edited ${timeAgo(r.updated)}` : ""}</span>
                  <span className="table-actions">
                    <button className="icon-btn is-danger" aria-label="Delete group" title="Delete"
                      onClick={() => { if (confirm(`Delete “${r.name || "Untitled group"}” and all its attendance?`)) { deleteRegister(r.id); setRegs(loadRegisters()); } }}>
                      <ITrash size={16} />
                    </button>
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}

// ---------- One register ----------

export function Register({ initial }) {
  const [reg, setReg] = useState(initial);
  const [tab, setTab] = useState(initial.people.length ? "take" : "people");
  const [day, setDay] = useState(() => dayKey(new Date()));
  const first = useRef(true);

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const t = setTimeout(() => saveRegister(reg), 250);
    return () => clearTimeout(t);
  }, [reg]);

  const update = (fn) => setReg((r) => fn(r));
  const fileName = (reg.name || "Attendance").replace(/[\\/:*?"<>|]/g, "");

  return (
    <section className="page narrow at-page">
      <div className="at-top">
        <a className="icon-btn" href="#/" aria-label="All groups" title="All groups"><IArrowLeft size={18} /></a>
        <input className="at-name" value={reg.name} placeholder="Group name" aria-label="Group name"
          onChange={(e) => update((r) => ({ ...r, name: e.target.value }))} />
        <button className="btn btn-sm" disabled={!reg.people.length} onClick={() => download(`${fileName}.csv`, toCSV(reg), "text/csv")}>
          <IDownload size={16} /><span className="hide-sm">Spreadsheet</span>
        </button>
      </div>

      <div className="tabs at-tabs" role="tablist">
        {[["take", "Take attendance"], ["totals", "Totals"], ["people", `People (${reg.people.length})`]].map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? "is-active" : ""} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      {tab === "take" && <TakeDay reg={reg} day={day} setDay={setDay} update={update} goPeople={() => setTab("people")} />}
      {tab === "totals" && <Totals reg={reg} />}
      {tab === "people" && <People reg={reg} update={update} />}
    </section>
  );
}

function TakeDay({ reg, day, setDay, update, goPeople }) {
  const marks = reg.days?.[day] || {};
  const today = dayKey(new Date());
  const count = (s) => reg.people.filter((p) => marks[p.id] === s).length;
  const unmarked = reg.people.filter((p) => !marks[p.id]).length;

  const setMarks = (fn) => update((r) => {
    const next = fn({ ...(r.days?.[day] || {}) });
    const days = { ...(r.days || {}) };
    if (Object.keys(next).length) days[day] = next; else delete days[day];
    return { ...r, days };
  });
  const mark = (pid, s) => setMarks((m) => { if (m[pid] === s) delete m[pid]; else m[pid] = s; return m; });
  const allPresent = () => setMarks((m) => { reg.people.forEach((p) => { if (!m[p.id]) m[p.id] = "p"; }); return m; });
  const clearDay = () => { if (confirm(`Clear all marks for ${prettyDay(day, true)}?`)) setMarks(() => ({})); };

  if (!reg.people.length) {
    return (
      <div className="empty-box at-empty">
        <h2>No one in this group yet</h2>
        <p>Add the people first, then you can take attendance.</p>
        <button className="btn btn-primary" onClick={goPeople}><IPlus size={16} />Add people</button>
      </div>
    );
  }

  return (
    <>
      <div className="at-day">
        <button className="icon-btn" onClick={() => setDay(shiftDay(day, -1))} aria-label="Previous day" title="Previous day"><IChevronLeft size={18} /></button>
        <label className="at-day-label">
          <span>{prettyDay(day, true)}</span>
          <input type="date" value={day} max={today} onChange={(e) => e.target.value && setDay(e.target.value)} aria-label="Pick a day" />
        </label>
        <button className="icon-btn" onClick={() => setDay(shiftDay(day, 1))} disabled={day >= today} aria-label="Next day" title="Next day"><IChevronRight size={18} /></button>
        {day !== today && <button className="text-btn" onClick={() => setDay(today)}>Today</button>}
      </div>

      <div className="at-summary">
        {STATUSES.map((s) => <span key={s.id} className={`at-pill is-${s.id}`}>{s.label} <b>{count(s.id)}</b></span>)}
        {unmarked > 0 && <span className="at-pill">Not marked <b>{unmarked}</b></span>}
      </div>

      <div className="at-list">
        {reg.people.map((p) => (
          <div className={`at-row ${marks[p.id] ? `has-${marks[p.id]}` : ""}`} key={p.id}>
            <span className="at-person">{p.name}</span>
            <span className="at-seg" role="group" aria-label={`${p.name} status`}>
              {STATUSES.map((s) => (
                <button key={s.id} type="button" className={`is-${s.id} ${marks[p.id] === s.id ? "is-on" : ""}`}
                  aria-pressed={marks[p.id] === s.id} title={s.label} onClick={() => mark(p.id, s.id)}>
                  <span className="at-seg-short">{s.short}</span><span className="at-seg-long">{s.label}</span>
                </button>
              ))}
            </span>
          </div>
        ))}
      </div>

      <div className="row-start">
        {unmarked > 0 && <button className="btn btn-primary" onClick={allPresent}>Mark the rest present</button>}
        {Object.keys(marks).length > 0 && <button className="btn is-danger" onClick={clearDay}>Clear this day</button>}
      </div>
    </>
  );
}

function Totals({ reg }) {
  const rows = useMemo(() => totals(reg), [reg]);
  const [open, setOpen] = useState(null);
  const days = Object.keys(reg.days || {}).length;

  if (!reg.people.length) return <p className="muted at-note">Add people to see their totals.</p>;
  if (!days) return <p className="muted at-note">No days taken yet. Totals appear here once you take attendance.</p>;

  return (
    <>
      <p className="muted at-note">{days} day{days === 1 ? "" : "s"} taken. “Here” counts present and late. “Missed” counts absent and excused. Tap a name to see the days they missed.</p>
      <div className="at-totals">
        <div className="at-trow is-head">
          <span>Name</span><span>Here</span><span>Missed</span><span className="hide-sm">Late</span><span className="hide-sm">Excused</span><span>Rate</span>
        </div>
        {rows.map((t) => (
          <div key={t.person.id}>
            <button type="button" className="at-trow" onClick={() => setOpen(open === t.person.id ? null : t.person.id)} aria-expanded={open === t.person.id}>
              <span className="at-person">{t.person.name}</span>
              <span className="at-num is-here">{t.here}</span>
              <span className="at-num is-missed">{t.missed}</span>
              <span className="at-num hide-sm">{t.l}</span>
              <span className="at-num hide-sm">{t.e}</span>
              <span className="at-rate">
                {t.rate == null ? "—" : `${t.rate}%`}
                {t.rate != null && <i style={{ "--w": `${t.rate}%` }} className={t.rate < 75 ? "is-low" : ""} />}
              </span>
            </button>
            {open === t.person.id && (
              <div className="at-detail">
                {t.missedDays.length ? (
                  <ul>{t.missedDays.map((m) => <li key={m.day}>{prettyDay(m.day)}<span className={`at-pill is-${m.s}`}>{m.s === "a" ? "Absent" : "Excused"}</span></li>)}</ul>
                ) : <p className="muted">Hasn't missed a day.</p>}
                {t.l > 0 && <p className="muted">Late {t.l} time{t.l === 1 ? "" : "s"}.</p>}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

function People({ reg, update }) {
  const [text, setText] = useState("");

  const add = (e) => {
    e.preventDefault();
    const names = text.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
    if (!names.length) return;
    update((r) => ({ ...r, people: [...r.people, ...names.map((name) => ({ id: uid(), name }))] }));
    setText("");
  };
  const rename = (id, name) => update((r) => ({ ...r, people: r.people.map((p) => (p.id === id ? { ...p, name } : p)) }));
  const remove = (p) => {
    if (!confirm(`Remove ${p.name || "this person"}? Their attendance is removed too.`)) return;
    update((r) => {
      const days = {};
      for (const [d, m] of Object.entries(r.days || {})) {
        const { [p.id]: _, ...rest } = m;
        if (Object.keys(rest).length) days[d] = rest;
      }
      return { ...r, people: r.people.filter((x) => x.id !== p.id), days };
    });
  };

  return (
    <>
      <form className="at-add" onSubmit={add}>
        <textarea className="field" rows={3} value={text} onChange={(e) => setText(e.target.value)}
          placeholder={"Type a name, or paste a list\n(one per line, or separated by commas)"} aria-label="Names to add"
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !text.includes("\n")) add(e); }} />
        <button className="btn btn-primary" type="submit" disabled={!text.trim()}><IPlus size={16} />Add</button>
      </form>
      {reg.people.length > 0 && (
        <div className="at-people">
          {reg.people.map((p) => (
            <div className="at-prow" key={p.id}>
              <input className="field field-quiet" value={p.name} aria-label="Name" onChange={(e) => rename(p.id, e.target.value)} />
              <button className="icon-btn is-danger" aria-label={`Remove ${p.name}`} title="Remove" onClick={() => remove(p)}><ITrash size={16} /></button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
