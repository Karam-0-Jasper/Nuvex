// Letters: a plain white page that already looks typed. The person only fills the blanks.
import { useEffect, useRef, useState } from "react";
import { LETTERS, effectiveValues, letterDoc, letterText, letterType, prefill } from "./letters.js";
import { deleteLetter, download, loadLetters, loadProfile, saveLetter, uid } from "./store.js";
import { CopyButton, timeAgo, useAutoGrow } from "./ui.jsx";
import { IArrowLeft, IDownload, IPrint, ITrash } from "./icons.jsx";

export function newLetter(typeId) {
  const type = letterType(typeId);
  return { id: uid(), type: type.id, values: prefill(type, loadProfile()) };
}

// ---------- Picking a letter ----------

export function LetterTiles({ limit }) {
  const list = limit ? LETTERS.slice(0, limit) : LETTERS;
  return (
    <div className={`l-tiles ${limit ? "is-row" : ""}`}>
      {list.map((l) => (
        <a key={l.id} className="l-tile" href={`#/letter/new/${l.id}`}>
          <span className="l-tile-art" aria-hidden="true">
            <i className="a-from" /><i className="a-to" /><i className="a-p" /><i className="a-p" /><i className="a-p short" /><i className="a-sign" />
          </span>
          <span className="l-tile-name">{l.name}</span>
        </a>
      ))}
      {limit && limit < LETTERS.length && (
        <a className="l-tile is-more" href="#/letters"><span className="l-tile-name">More letters</span></a>
      )}
    </div>
  );
}

const ABOUT_KEYS = ["position", "scholarship", "request", "problem", "event", "person", "friend", "thankName", "toOrg"];

export function LetterList({ letters, onChange }) {
  if (!letters.length) return null;
  return (
    <div className="table">
      {letters.map((l) => {
        const type = letterType(l.type);
        const eff = effectiveValues(type, l.values || {});
        const about = ABOUT_KEYS.map((k) => (eff[k] || "").trim()).find(Boolean) || "";
        return (
          <div className="table-row is-forms" key={l.id}>
            <a className="table-title" href={`#/letter/${l.id}`}>
              <span className="form-dot" aria-hidden="true">{type.name.charAt(0)}</span>
              <span className="l-row-name">{type.name}{about && <small>{about}</small>}</span>
            </a>
            <span className="muted hide-sm">{l.updated ? `Edited ${timeAgo(l.updated)}` : ""}</span>
            <span className="table-actions">
              <button className="icon-btn is-danger" aria-label="Delete letter" title="Delete"
                onClick={() => { if (confirm(`Delete this ${type.name.toLowerCase()}?`)) { deleteLetter(l.id); onChange(loadLetters()); } }}>
                <ITrash size={16} />
              </button>
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function LettersHome() {
  const [letters, setLetters] = useState(loadLetters);
  return (
    <section className="page">
      <h1 className="page-title">Letters</h1>
      <div className="l-section"><LetterTiles /></div>
      {letters.length > 0 && (
        <>
          <h2 className="start-h">Your letters</h2>
          <LetterList letters={letters} onChange={setLetters} />
        </>
      )}
    </section>
  );
}

// ---------- The page ----------

function Area({ value, onChange, placeholder, className, label }) {
  const ref = useAutoGrow(value);
  return <textarea ref={ref} rows={1} className={className} value={value} placeholder={placeholder} aria-label={label} onChange={(e) => onChange(e.target.value)} />;
}

function Blank({ piece, value, onChange, inline }) {
  const cls = `l-blank ${value ? "" : "is-empty"} ${piece.big ? "is-big" : ""}`;
  if (piece.multi) return <Area className={cls} value={value} onChange={onChange} placeholder={piece.ph} label={piece.ph} />;
  return (
    <input className={`${cls} ${inline ? "is-inline" : ""}`} value={value} placeholder={piece.ph} aria-label={piece.ph}
      size={inline ? Math.max(piece.ph.length, value.length) + 1 : undefined} onChange={(e) => onChange(e.target.value)} />
  );
}

export function LetterWriter({ initial }) {
  const [letter, setLetter] = useState(initial);
  const first = useRef(true);
  const type = letterType(letter.type);
  const values = letter.values || {};
  const eff = effectiveValues(type, values);

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const t = setTimeout(() => saveLetter(letter), 300);
    return () => clearTimeout(t);
  }, [letter]);

  const set = (k, v) => setLetter((l) => ({ ...l, values: { ...l.values, [k]: v } }));
  const fileName = `${type.name}${eff.name ? ` - ${eff.name}` : ""}`.replace(/[\\/:*?"<>|]/g, "");

  return (
    <div className="l-page">
      <header className="l-bar">
        <div className="l-bar-inner">
          <a className="icon-btn" href="#/letters" aria-label="All letters" title="All letters"><IArrowLeft size={18} /></a>
          <span className="editor-name">{type.name}</span>
          <span className="grow" />
          <CopyButton text={letterText(type, values)} label="Copy" className="btn btn-sm" />
          <button className="btn btn-sm" onClick={() => download(`${fileName}.doc`, letterDoc(type, values), "application/msword")}>
            <IDownload size={16} /><span className="hide-sm">Word</span>
          </button>
          <button className="btn btn-sm btn-primary" onClick={() => print()}><IPrint size={16} /><span className="hide-sm">Print</span></button>
        </div>
      </header>

      <main className="l-main">
        <article className="l-paper" aria-label={type.name}>
          {type.blocks.map((b, i) => (
            <div key={i} className={`l-b ${b.side === "right" ? "is-right" : ""} ${b.role ? `is-${b.role}` : ""}`}>
              {b.lines.map((line, j) => {
                if (!line.length) return <div key={j} className="l-gap" />;
                if (line[0].sign) return <div key={j} className="l-sign" />;
                const inline = line.length > 1;
                return (
                  <div key={j} className={`l-line ${inline ? "is-inline" : ""}`}>
                    {line.map((p, n) => (typeof p === "string"
                      ? <span key={n}>{p}</span>
                      : <Blank key={n} piece={p} inline={inline} value={eff[p.k] || ""} onChange={(v) => set(p.k, v)} />))}
                  </div>
                );
              })}
            </div>
          ))}
        </article>
      </main>
    </div>
  );
}
