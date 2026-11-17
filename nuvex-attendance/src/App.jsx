// Nuvex Attendance: a register that works like a spreadsheet.
// Names down the side, days across the top, tap a box for ✓ or ✗, totals at the end of each row.
import { useEffect, useMemo, useRef, useState } from "react";
import { copyText, dayKey, download, fromKey, loadActive, loadSheets, newSheet, saveActive, saveSheets, uid } from "./store.js";

const IS_ARTIFACT = import.meta.env.VITE_ARTIFACT === "1";
const MIN_ROWS = 12;
const key = (pid, day) => `${pid}|${day}`;
const weekday = (k) => fromKey(k).toLocaleDateString(undefined, { weekday: "short" });
const dayMonth = (k) => fromKey(k).toLocaleDateString(undefined, { day: "numeric", month: "short" });
const longDay = (k) => fromKey(k).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" });

/** Today if it isn't on the sheet yet, otherwise the next school day after the last column. */
function nextDay(cols) {
  const today = dayKey(new Date());
  if (!cols.length || cols[cols.length - 1] < today) return today;
  const d = fromKey(cols[cols.length - 1]);
  do { d.setDate(d.getDate() + 1); } while (d.getDay() === 0 || d.getDay() === 6);
  return dayKey(d);
}

function totalsFor(sheet, pid) {
  let attended = 0, missed = 0;
  for (const c of sheet.cols) {
    const m = sheet.marks[key(pid, c)];
    if (m === "p") attended++; else if (m === "a") missed++;
  }
  return { attended, missed };
}

function asTable(sheet, sep) {
  const cell = (v) => (sep === "," ? `"${String(v ?? "").replace(/"/g, '""')}"` : String(v ?? "").replace(/[\t\n]/g, " "));
  const rows = [["Name", ...sheet.cols, "Days attended", "Days missed"]];
  for (const p of sheet.people) {
    const t = totalsFor(sheet, p.id);
    rows.push([p.name, ...sheet.cols.map((c) => ({ p: "✓", a: "✗" })[sheet.marks[key(p.id, c)]] || ""), t.attended, t.missed]);
  }
  return rows.map((r) => r.map(cell).join(sep)).join("\n");
}

/** Tap once to arm, tap again within 3 seconds to do it. */
function ConfirmButton({ onConfirm, armedLabel, children, className = "tool" }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => { if (!armed) return; const t = setTimeout(() => setArmed(false), 3000); return () => clearTimeout(t); }, [armed]);
  return (
    <button type="button" className={`${className} ${armed ? "is-armed" : "is-danger"}`}
      onClick={() => { if (armed) { setArmed(false); onConfirm(); } else setArmed(true); }}>
      {armed ? armedLabel : children}
    </button>
  );
}

export default function App() {
  const [sheets, setSheets] = useState(loadSheets);
  const [activeId, setActiveId] = useState(() => loadActive());
  const [sel, setSel] = useState(null); // { type: "col", day } | { type: "row", id }
  const [ghostId, setGhostId] = useState(uid);
  const [copied, setCopied] = useState(false);
  const wrap = useRef(null);

  const sheet = sheets.find((s) => s.id === activeId) || sheets[0];
  useEffect(() => { const t = setTimeout(() => saveSheets(sheets), 200); return () => clearTimeout(t); }, [sheets]);
  useEffect(() => { saveActive(sheet.id); }, [sheet.id]);

  const update = (fn) => setSheets((all) => all.map((s) => (s.id === sheet.id ? fn(s) : s)));
  const rows = useMemo(() => [...sheet.people, { id: ghostId, name: "", ghost: true }], [sheet.people, ghostId]);
  const blanks = Math.max(0, MIN_ROWS - rows.length);
  const dayCount = (day) => sheet.people.filter((p) => sheet.marks[key(p.id, day)] === "p").length;

  // ---------- names ----------
  const setName = (row, name) => {
    if (row.ghost) {
      if (!name.trim()) return;
      update((s) => ({ ...s, people: [...s.people, { id: row.id, name }] }));
      setGhostId(uid());
    } else update((s) => ({ ...s, people: s.people.map((p) => (p.id === row.id ? { ...p, name } : p)) }));
  };
  const removeRow = (id) => {
    update((s) => {
      const marks = Object.fromEntries(Object.entries(s.marks).filter(([k]) => !k.startsWith(id + "|")));
      return { ...s, people: s.people.filter((p) => p.id !== id), marks };
    });
    setSel(null);
  };
  const tidyRow = (row) => {
    if (row.ghost || row.name.trim()) return;
    if (!sheet.cols.some((c) => sheet.marks[key(row.id, c)])) removeRow(row.id);
  };
  const pasteNames = (e, row) => {
    const text = e.clipboardData.getData("text");
    if (!/[\n\r]/.test(text)) return;
    e.preventDefault();
    const names = text.split(/[\n\r]+/).map((l) => l.split("\t")[0].trim()).filter(Boolean).slice(0, 300);
    if (!names.length) return;
    const fillHere = row.ghost || !row.name.trim();
    update((s) => {
      const fresh = (fillHere ? names.slice(1) : names).map((name) => ({ id: uid(), name }));
      const people = row.ghost ? [...s.people, { id: row.id, name: names[0] }]
        : s.people.map((p) => (fillHere && p.id === row.id ? { ...p, name: names[0] } : p));
      return { ...s, people: [...people, ...fresh] };
    });
    if (row.ghost) setGhostId(uid());
  };
  const focusName = (i) => wrap.current?.querySelector(`[data-name="${i}"]`)?.focus();
  const focusCell = (r, c) => wrap.current?.querySelector(`[data-cell="${r}-${c}"]`)?.focus();

  // ---------- marks ----------
  const setMark = (pid, day, value) => update((s) => {
    const marks = { ...s.marks };
    if (value) marks[key(pid, day)] = value; else delete marks[key(pid, day)];
    return { ...s, marks };
  });
  const cycle = (pid, day) => setMark(pid, day, { undefined: "p", p: "a", a: null }[sheet.marks[key(pid, day)]]);
  const cellKey = (e, r, c, pid, day) => {
    const k = e.key.toLowerCase();
    const move = { arrowup: [-1, 0], arrowdown: [1, 0], arrowleft: [0, -1], arrowright: [0, 1] }[k];
    if (move) { e.preventDefault(); focusCell(r + move[0], c + move[1]); }
    else if (k === "p" || k === "y" || k === "1") setMark(pid, day, "p");
    else if (k === "x" || k === "a" || k === "n" || k === "0") setMark(pid, day, "a");
    else if (k === "backspace" || k === "delete") setMark(pid, day, null);
  };

  // ---------- days ----------
  const addDay = () => {
    update((s) => ({ ...s, cols: [...s.cols, nextDay(s.cols)] }));
    setTimeout(() => { const el = wrap.current; if (el) el.scrollLeft = el.scrollWidth; }, 30);
  };
  const changeDay = (from, to) => {
    if (!to || to === from || sheet.cols.includes(to)) return;
    update((s) => {
      const marks = {};
      for (const [k, v] of Object.entries(s.marks)) {
        const [pid, d] = k.split("|");
        marks[key(pid, d === from ? to : d)] = v;
      }
      return { ...s, cols: s.cols.map((c) => (c === from ? to : c)).sort(), marks };
    });
    setSel({ type: "col", day: to });
  };
  const removeDay = (day) => {
    update((s) => ({ ...s, cols: s.cols.filter((c) => c !== day), marks: Object.fromEntries(Object.entries(s.marks).filter(([k]) => !k.endsWith("|" + day))) }));
    setSel(null);
  };
  const fillDay = (day, value) => update((s) => {
    const marks = { ...s.marks };
    for (const p of s.people) {
      if (value === null) delete marks[key(p.id, day)];
      else if (!marks[key(p.id, day)]) marks[key(p.id, day)] = value;
    }
    return { ...s, marks };
  });

  // ---------- sheets ----------
  const addSheet = () => {
    const s = newSheet(`Class ${sheets.length + 1}`);
    setSheets((all) => [...all, s]); setActiveId(s.id); setSel(null);
  };
  const removeSheet = () => {
    const rest = sheets.filter((s) => s.id !== sheet.id);
    const next = rest.length ? rest : [newSheet("Class 1")];
    setSheets(next); setActiveId(next[0].id); setSel(null);
  };
  const fileName = (sheet.name || "Attendance").replace(/[\\/:*?"<>|]/g, "");
  const selRow = sel?.type === "row" ? sheet.people.find((p) => p.id === sel.id) : null;
  const selDay = sel?.type === "col" && sheet.cols.includes(sel.day) ? sel.day : null;

  return (
    <div className="app">
      <header className="top">
        <svg className="logo" viewBox="0 0 24 24" aria-hidden="true">
          <rect width="24" height="24" rx="6" fill="var(--brand)" />
          <path d="M7 12.5l3.2 3.2L17 8.8" stroke="var(--on-brand)" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <input id="sheet-title" className="title" value={sheet.name} placeholder="Class name" aria-label="Class name"
          onChange={(e) => update((s) => ({ ...s, name: e.target.value }))} />
        <span className="saved">Saved on this device</span>
      </header>

      <div className="tools">
        {selDay ? (
          <>
            <strong className="tools-label">{longDay(selDay)}</strong>
            <label className="tool is-date">Change date
              <input id="change-date" type="date" value={selDay} onChange={(e) => changeDay(selDay, e.target.value)} />
            </label>
            <button className="tool" onClick={() => fillDay(selDay, "p")}>Fill blanks with ✓</button>
            <button className="tool" onClick={() => fillDay(selDay, null)}>Clear day</button>
            <ConfirmButton armedLabel="Tap again to delete" onConfirm={() => removeDay(selDay)}>Delete day</ConfirmButton>
            <button className="tool is-quiet" onClick={() => setSel(null)}>Done</button>
          </>
        ) : selRow ? (
          <>
            <strong className="tools-label">{selRow.name || "This row"}</strong>
            <ConfirmButton armedLabel="Tap again to delete" onConfirm={() => removeRow(selRow.id)}>Delete row</ConfirmButton>
            <button className="tool is-quiet" onClick={() => setSel(null)}>Done</button>
          </>
        ) : (
          <>
            <button className="tool is-primary" onClick={addDay}>+ Add day</button>
            <button className="tool" disabled={!sheet.people.length}
              onClick={async () => { if (await copyText(asTable(sheet, "\t"))) { setCopied(true); setTimeout(() => setCopied(false), 1800); } }}>
              {copied ? "Copied" : "Copy table"}
            </button>
            {!IS_ARTIFACT && (
              <button className="tool" disabled={!sheet.people.length}
                onClick={() => download(`${fileName}.csv`, "﻿" + asTable(sheet, ","), "text/csv")}>Download</button>
            )}
            <span className="hint">Tap a box: ✓ present, tap again: ✗ absent</span>
            <span className="grow" />
            <ConfirmButton armedLabel="Tap again to delete" onConfirm={removeSheet}>Delete class</ConfirmButton>
          </>
        )}
      </div>

      <div className="grid-wrap" ref={wrap}>
        <table className="grid">
          <thead>
            <tr>
              <th className="c-num" />
              <th className="c-name">Name</th>
              {sheet.cols.map((c) => (
                <th key={c} className={`c-day ${selDay === c ? "is-sel" : ""}`}>
                  <button type="button" onClick={() => setSel(selDay === c ? null : { type: "col", day: c })} aria-pressed={selDay === c} title={longDay(c)}>
                    <small>{weekday(c)}</small>{dayMonth(c)}
                  </button>
                </th>
              ))}
              <th className="c-add"><button type="button" onClick={addDay} aria-label="Add day" title="Add day">+</button></th>
              <th className="c-fill" />
              <th className="c-tot is-att"><span className="t-long">Attended</span><span className="t-short">✓ days</span></th>
              <th className="c-tot is-mis"><span className="t-long">Missed</span><span className="t-short">✗ days</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => {
              const t = row.ghost ? null : totalsFor(sheet, row.id);
              const rowSel = selRow?.id === row.id;
              return (
                <tr key={row.id} className={rowSel ? "is-sel" : ""}>
                  <td className="c-num">
                    {row.ghost ? r + 1 : (
                      <button type="button" onClick={() => setSel(rowSel ? null : { type: "row", id: row.id })} aria-pressed={rowSel} aria-label={`Select row ${r + 1}`}>{r + 1}</button>
                    )}
                  </td>
                  <td className="c-name">
                    <input data-name={r} value={row.name} placeholder={row.ghost ? "Type a name" : "(no name)"} aria-label={`Name, row ${r + 1}`}
                      autoComplete="off" spellCheck={false}
                      onChange={(e) => setName(row, e.target.value)} onBlur={() => tidyRow(row)} onPaste={(e) => pasteNames(e, row)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === "ArrowDown") { e.preventDefault(); focusName(r + 1); }
                        else if (e.key === "ArrowUp") { e.preventDefault(); focusName(r - 1); }
                      }} />
                  </td>
                  {sheet.cols.map((c, ci) => {
                    const m = row.ghost ? undefined : sheet.marks[key(row.id, c)];
                    return (
                      <td key={c} className={`c-day ${selDay === c ? "is-sel" : ""}`}>
                        {!row.ghost && (
                          <button type="button" data-cell={`${r}-${ci}`} className={m ? `is-${m}` : ""}
                            aria-label={`${row.name || "Row " + (r + 1)}, ${dayMonth(c)}: ${m === "p" ? "present" : m === "a" ? "absent" : "not marked"}`}
                            onClick={() => cycle(row.id, c)} onKeyDown={(e) => cellKey(e, r, ci, row.id, c)}>
                            {m === "p" ? "✓" : m === "a" ? "✗" : ""}
                          </button>
                        )}
                      </td>
                    );
                  })}
                  <td className="c-add" /><td className="c-fill" />
                  <td className="c-tot is-att">{t ? t.attended : ""}</td>
                  <td className="c-tot is-mis">{t ? t.missed : ""}</td>
                </tr>
              );
            })}
            {Array.from({ length: blanks }, (_, i) => (
              <tr key={`b${i}`} className="is-blank" onClick={() => focusName(rows.length - 1)}>
                <td className="c-num">{rows.length + i + 1}</td><td className="c-name" />
                {sheet.cols.map((c) => <td key={c} className={`c-day ${selDay === c ? "is-sel" : ""}`} />)}
                <td className="c-add" /><td className="c-fill" /><td className="c-tot" /><td className="c-tot" />
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="c-num" /><td className="c-name">Present that day</td>
              {sheet.cols.map((c) => <td key={c} className={`c-day ${selDay === c ? "is-sel" : ""}`}>{sheet.people.length ? dayCount(c) : ""}</td>)}
              <td className="c-add" /><td className="c-fill" /><td className="c-tot" /><td className="c-tot" />
            </tr>
          </tfoot>
        </table>
      </div>

      <nav className="tabs" aria-label="Classes">
        <button type="button" className="tab-add" onClick={addSheet} aria-label="Add a class" title="Add a class">+</button>
        {sheets.map((s) => (
          <button type="button" key={s.id} className={`tab ${s.id === sheet.id ? "is-on" : ""}`} onClick={() => { setActiveId(s.id); setSel(null); }}>
            {s.name || "Untitled"}
          </button>
        ))}
      </nav>
    </div>
  );
}
