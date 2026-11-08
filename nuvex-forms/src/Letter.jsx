// Letters: pick a kind of letter, fill in each part ("Date: …"), and get it laid out in the correct format.
import { useEffect, useMemo, useRef, useState } from "react";
import { LETTERS, effectiveValues, layoutLetter, letterDoc, letterText, letterType, missingParts } from "./letters.js";
import { THEMES } from "./templates.js";
import { deleteLetter, download, loadLetters, loadProfile, saveLetter, uid } from "./store.js";
import { CopyButton, VoiceField, timeAgo } from "./ui.jsx";
import { IArrowLeft, IDownload, IPrint, ITrash } from "./icons.jsx";

const themeFor = (typeId) => {
  const t = THEMES[Math.max(0, LETTERS.findIndex((l) => l.id === typeId)) % THEMES.length];
  return { "--theme": t.c, "--theme-soft": t.soft };
};

/** A new letter of this kind, with "My info" (name, phone, email) already filled in. */
export function newLetter(typeId) {
  const type = letterType(typeId);
  const profile = loadProfile();
  const values = {};
  for (const p of type.parts) if (p.profile && profile[p.profile]) values[p.key] = profile[p.profile];
  return { id: uid(), type: type.id, layout: type.layout, values };
}

// ---------- Picking a letter ----------

export function LetterTiles({ limit }) {
  const list = limit ? LETTERS.slice(0, limit) : LETTERS;
  return (
    <div className={`l-tiles ${limit ? "is-row" : ""}`}>
      {list.map((l) => (
        <a key={l.id} className="l-tile" href={`#/letter/new/${l.id}`} style={themeFor(l.id)}>
          <span className={`l-tile-art ${l.layout === "classic" ? "is-classic" : ""}`} aria-hidden="true">
            <i className="a-from" /><i className="a-to" /><i className="a-p" /><i className="a-p" /><i className="a-p short" /><i className="a-sign" />
          </span>
          <span className="l-tile-name">{l.name}</span>
          <span className="l-tile-blurb">{l.blurb}</span>
        </a>
      ))}
      {limit && limit < LETTERS.length && (
        <a className="l-tile is-more" href="#/letters"><span className="l-tile-name">All {LETTERS.length} kinds of letter</span><span className="l-tile-blurb">Resignation, leave, recommendation, thank-you and invitation letters.</span></a>
      )}
    </div>
  );
}

export function LetterList({ letters, onChange }) {
  if (!letters.length) return null;
  return (
    <div className="table">
      {letters.map((l) => {
        const type = letterType(l.type);
        const eff = effectiveValues(type, l.values || {});
        const about = eff.subject || eff.toName || eff.toOrg || "";
        return (
          <div className="table-row is-forms" key={l.id} style={themeFor(l.type)}>
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
      <p className="eyebrow">Letters</p>
      <h1 className="page-title">Write a letter in the right format</h1>
      <p className="lede">Pick the kind of letter. Every part is laid out in the correct order, so you just fill in the lines: Date, Their name, Greeting and so on. You can type or speak.</p>
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

// ---------- Writing one ----------

const GROUPS = [
  { id: "top", roles: ["from", "date"], title: "Your details", where: { modern: "Top of the page, on the left", classic: "Top right corner" } },
  { id: "to", roles: ["to", "meta"], title: "Who it's going to", where: { modern: "Below the date, on the left", classic: "Below your address, on the left" } },
  { id: "open", roles: ["greeting", "subject"], title: "Greeting and subject" },
  { id: "body", roles: ["body"], title: "The letter" },
  { id: "end", roles: ["close", "sign", "enc"], title: "Ending", where: { modern: "Bottom, on the left", classic: "Bottom, on the right" } },
];

function PartRow({ part, value, onChange, suggestion, why }) {
  const id = `lp-${part.key}`;
  const multi = part.kind !== "line";
  return (
    <div className={`l-row ${multi ? "is-multi" : ""}`}>
      <label className="l-label" htmlFor={id}>{part.label}:{part.optional && <small>optional</small>}</label>
      <div className="l-input">
        <VoiceField id={id} value={value} onChange={onChange} multiline={multi} rows={part.kind === "para" ? 3 : 2}
          placeholder={suggestion || part.placeholder} className="l-field" />
        {suggestion && !value?.trim() ? (
          <p className="l-hint is-auto">Filled in for you: <b>{suggestion}</b>{why && <span>{why}</span>}</p>
        ) : part.hint ? <p className="l-hint">{part.hint}</p> : null}
        {part.options && (
          <div className="l-options">
            {part.options.map((o) => (
              <button key={o} type="button" className={`l-opt ${value === o ? "is-on" : ""}`} onClick={() => onChange(value === o ? "" : o)}>{o}</button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Paper({ type, values, layout }) {
  const blocks = layoutLetter(type, values, layout);
  return (
    <article className={`l-paper is-${layout}`} aria-label="Your letter">
      {blocks.map((b, i) => (
        <p key={i} className={`l-b is-${b.role} ${b.side === "right" ? "is-right" : ""}`}>
          {b.lines.map((l, j) => (l.gap ? <br key={j} /> : <span key={j} className={l.ph ? "is-ph" : ""}>{l.text}</span>))}
        </p>
      ))}
    </article>
  );
}

export function LetterWriter({ initial }) {
  const [letter, setLetter] = useState(initial);
  const [view, setView] = useState("write");
  const first = useRef(true);
  const type = letterType(letter.type);
  const values = letter.values || {};

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const t = setTimeout(() => saveLetter(letter), 300);
    return () => clearTimeout(t);
  }, [letter]);

  const setValue = (key, v) => setLetter((l) => ({ ...l, values: { ...l.values, [key]: v } }));
  const eff = useMemo(() => effectiveValues(type, values), [type, values]);
  const missing = missingParts(type, values);
  const text = letterText(type, values, letter.layout);
  const fileName = `${type.name}${eff.name ? ` - ${eff.name}` : ""}`.replace(/[\\/:*?"<>|]/g, "");

  return (
    <div className="l-page" style={themeFor(type.id)}>
      <header className="l-bar">
        <div className="l-bar-inner">
          <a className="icon-btn" href="#/letters" aria-label="All letters" title="All letters"><IArrowLeft size={18} /></a>
          <span className="editor-name">{type.name}</span>
          <span className="grow" />
          <span className={`l-status hide-sm ${missing.length ? "" : "is-done"}`}>
            {missing.length ? `${missing.length} part${missing.length === 1 ? "" : "s"} left` : "All parts filled in"}
          </span>
          <CopyButton text={text} label="Copy" className="btn btn-sm" />
          <button className="btn btn-sm" onClick={() => download(`${fileName}.doc`, letterDoc(type, values, letter.layout), "application/msword")}>
            <IDownload size={16} /><span className="hide-sm">Word</span>
          </button>
          <button className="btn btn-sm btn-primary" onClick={() => print()}><IPrint size={16} /><span className="hide-sm">Print or PDF</span></button>
        </div>
        <nav className="tabs l-switch" aria-label="Write or preview">
          {[["write", "Fill in"], ["preview", "See the letter"]].map(([id, label]) => (
            <button key={id} className={view === id ? "is-active" : ""} onClick={() => { setView(id); scrollTo(0, 0); }}>{label}</button>
          ))}
        </nav>
      </header>

      <main className={`l-main show-${view}`}>
        <div className="l-form">
          <section className="e-card l-guide">
            <h1 className="l-title">{type.name}</h1>
            <p className="muted">Fill in each line. The order below is the order on the page, and empty lines show in [brackets] on the letter.</p>
            <ul className="l-rules">{type.rules.map((r) => <li key={r}>{r}</li>)}</ul>
            <div className="l-layout" role="radiogroup" aria-label="Layout">
              <span className="e-themes-label">Layout</span>
              {[["modern", "Modern: all on the left"], ["classic", "Classic: address on the right"]].map(([id, label]) => (
                <button key={id} type="button" role="radio" aria-checked={letter.layout === id} className={`l-opt ${letter.layout === id ? "is-on" : ""}`}
                  onClick={() => setLetter((l) => ({ ...l, layout: id }))}>{label}</button>
              ))}
            </div>
          </section>

          {GROUPS.map((g) => {
            const parts = type.parts.filter((p) => g.roles.includes(p.role));
            if (!parts.length) return null;
            return (
              <section key={g.id} className="e-card l-group">
                <h2 className="l-group-title">{g.title}{g.where && <small>{g.where[letter.layout]}</small>}</h2>
                {parts.map((p) => {
                  const suggestion = p.auto ? eff[p.key] : "";
                  return (
                    <PartRow key={p.key} part={p} value={values[p.key] || ""} onChange={(v) => setValue(p.key, v)}
                      suggestion={!values[p.key]?.trim() ? suggestion : ""} why={p.why ? p.why(values, eff) : ""} />
                  );
                })}
              </section>
            );
          })}
          <button className="btn btn-primary btn-lg l-see" onClick={() => { setView("preview"); scrollTo(0, 0); }}>See the letter</button>
        </div>

        <div className="l-preview">
          <Paper type={type} values={values} layout={letter.layout} />
          <p className="l-preview-note muted">Updates as you type. Print it, save it as a PDF, or download it for Word.</p>
        </div>
      </main>
    </div>
  );
}
