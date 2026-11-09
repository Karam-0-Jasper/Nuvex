import { useEffect, useMemo, useState } from "react";
import Builder, { newQuestion } from "./Builder.jsx";
import Fill from "./Fill.jsx";
import { ResponseDetail } from "./Responses.jsx";
import { TEMPLATES, themeStyle } from "./templates.js";
import { addToInbox, deleteForm, formLink, getForm, getLetter, getRegister, loadForms, loadInbox, loadLetters, publicForm, saveForm, saveLetter, uid, unpack } from "./store.js";
import { CopyButton, timeAgo } from "./ui.jsx";
import { LetterList, LetterTiles, LetterWriter, LettersHome, newLetter } from "./Letter.jsx";
import { AttendanceHome, Register } from "./Attendance.jsx";
import { ICalendar, IMoon, IPen, IPlus, ISun, ITrash } from "./icons.jsx";

function fromTemplate(tid) {
  const t = TEMPLATES.find((x) => x.id === tid);
  const base = { id: uid(), title: "Untitled form", intro: "", owner: {}, questions: [newQuestion("", "short")] };
  if (!t) return base;
  return {
    ...base,
    title: t.title,
    intro: t.intro,
    questions: t.questions.map((q) => ({ options: [], required: false, autofill: "", ...q, id: uid(), autofillTouched: true })),
    ...(t.interview ? { interview: { ...t.interview, questions: t.interview.questions.map((q) => ({ ...q, id: uid() })) } } : {}),
  };
}

/** "#/new/<template>" creates the form once and becomes "#/edit/<id>", so Back or refresh never duplicates it. */
function resolveHash() {
  const l = location.hash.match(/^#\/letter\/new\/([\w-]*)/);
  if (l) {
    const letter = newLetter(l[1]);
    saveLetter(letter);
    history.replaceState(null, "", `#/letter/${letter.id}`);
    return location.hash;
  }
  const m = location.hash.match(/^#\/new\/([\w-]*)/);
  if (!m) return location.hash;
  const f = fromTemplate(m[1]);
  saveForm(f);
  history.replaceState(null, "", `#/edit/${f.id}`);
  return location.hash;
}

function useHash() {
  const [hash, setHash] = useState(resolveHash);
  useEffect(() => {
    const on = () => { setHash(resolveHash()); window.scrollTo(0, 0); };
    addEventListener("hashchange", on);
    return () => removeEventListener("hashchange", on);
  }, []);
  return hash;
}
const go = (h) => { location.hash = h; };

export default function App() {
  const hash = useHash();

  if (hash.startsWith("#f=")) {
    const form = unpack(hash.slice(3));
    return form?.questions ? <Fill key={hash} form={form} /> : <Shell><Broken /></Shell>;
  }
  if (hash.startsWith("#r=")) {
    const r = unpack(hash.slice(3));
    return <Shell>{r?.answers ? <ResponseView key={r.id} response={r} /> : <Broken />}</Shell>;
  }
  const [, page, arg, sub] = hash.split("/");
  if (page === "edit") {
    const f = getForm(arg);
    return f ? <Builder key={arg} initial={f} initialTab={sub} onBack={() => go("#/")} onPreview={(x) => go(`#/preview/${x.id}`)} /> : <Shell><Broken /></Shell>;
  }
  if (page === "letters") return <Shell><LettersHome /></Shell>;
  if (page === "letter") {
    const l = getLetter(arg);
    return <Shell>{l ? <LetterWriter key={arg} initial={l} /> : <Broken />}</Shell>;
  }
  if (page === "attendance") {
    if (!arg) return <Shell><AttendanceHome /></Shell>;
    const r = getRegister(arg);
    return <Shell>{r ? <Register key={arg} initial={r} /> : <Broken />}</Shell>;
  }
  if (page === "preview") {
    const f = getForm(arg);
    return f ? <Fill key={hash} form={publicForm(f)} preview onExit={() => go(`#/edit/${f.id}`)} /> : <Shell><Broken /></Shell>;
  }
  return <Shell><Home /></Shell>;
}

export function Mark({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <rect width="24" height="24" rx="6" fill="currentColor" />
      <path d="M6.5 8h11M6.5 12h7M6.5 16h4" stroke="var(--paper)" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="17" cy="16" r="1.6" fill="var(--rec)" />
    </svg>
  );
}

function Shell({ children }) {
  return (
    <div className="site">
      <header className="nav">
        <div className="nav-inner">
          <a href="#/" className="wordmark"><Mark /><span>Nuvex Forms</span></a>
          <span className="grow" />
          <ModeButton />
          <a href="#/attendance" className="btn btn-sm nav-letters"><ICalendar size={15} /><span className="hide-sm">Attendance</span></a>
          <a href="#/letters" className="btn btn-sm nav-letters"><IPen size={15} /><span className="hide-sm">Letters</span></a>
          <a href="#/new/blank" className="btn btn-primary btn-sm nav-new"><IPlus size={15} /><span className="nav-new-label">New form</span></a>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}

/** Switch between light and dark. Remembered on this device. */
function ModeButton() {
  const [mode, setMode] = useState(() => document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
  const flip = () => {
    const next = mode === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("nf.mode", next); } catch { /* ignore */ }
    setMode(next);
  };
  return (
    <button type="button" className="icon-btn nav-mode" onClick={flip} aria-label={mode === "dark" ? "Light mode" : "Dark mode"} title={mode === "dark" ? "Light mode" : "Dark mode"}>
      {mode === "dark" ? <ISun size={18} /> : <IMoon size={18} />}
    </button>
  );
}

function Broken() {
  return (
    <section className="page narrow">
      <h1 className="page-title">This link doesn't open</h1>
      <p className="lede">It was probably cut short when it was copied. Ask the sender for the full link.</p>
      <a className="btn" href="#/">Go to Nuvex Forms</a>
    </section>
  );
}

function Home() {
  const [forms, setForms] = useState(loadForms);
  const [letters, setLetters] = useState(loadLetters);
  const counts = useMemo(() => loadInbox().reduce((m, r) => ((m[r.formId] = (m[r.formId] || 0) + 1), m), {}), []);

  return (
    <>
      <section className="start">
        <div className="start-inner">
          <h2 className="start-h">New form</h2>
          <div className="tiles">
            <a className="tile" href="#/new/blank">
              <span className="tile-art is-blank"><IPlus size={30} /></span>
              <span className="tile-name">Blank form</span>
            </a>
            {TEMPLATES.map((t) => (
              <a className="tile" key={t.id} href={`#/new/${t.id}`}>
                <span className="tile-art">
                  <span className="tile-line is-title" />
                  {t.questions.slice(0, 3).map((q, i) => <span key={i} className="tile-line" />)}
                  {t.interview && <span className="tile-badge">Interview</span>}
                </span>
                <span className="tile-name">{t.title}</span>
              </a>
            ))}
          </div>
          <h2 className="start-h l-home-h">New letter</h2>
          <LetterTiles limit={5} />
        </div>
      </section>

      <section className="page">
        <h2 className="start-h">Your forms</h2>
        {!forms.length ? (
          <p className="muted">No forms yet.</p>
        ) : (
          <div className="table">
            {forms.map((f) => (
              <div className="table-row is-forms" key={f.id} style={themeStyle(f)}>
                <a className="table-title" href={`#/edit/${f.id}`}><span className="form-dot" aria-hidden="true">{(f.title || "U").trim().charAt(0).toUpperCase()}</span>{f.title || "Untitled form"}{f.interview?.enabled && <span className="tag">Interview</span>}</a>
                <span className="muted">{counts[f.id] || 0} response{counts[f.id] === 1 ? "" : "s"}</span>
                <span className="muted hide-sm">{f.updated ? `Edited ${timeAgo(f.updated)}` : ""}</span>
                <span className="table-actions">
                  <CopyButton text={formLink(f)} label="Copy link" className="btn btn-sm" />
                  <button className="icon-btn is-danger" aria-label="Delete form" title="Delete"
                    onClick={() => { if (confirm(`Delete “${f.title || "Untitled form"}”?`)) { deleteForm(f.id); setForms(loadForms()); } }}>
                    <ITrash size={16} />
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}
        {letters.length > 0 && (
          <>
            <h2 className="start-h l-home-list">Your letters</h2>
            <LetterList letters={letters} onChange={setLetters} />
          </>
        )}
      </section>
    </>
  );
}

function ResponseView({ response }) {
  const [isNew] = useState(() => !loadInbox().some((r) => r.id === response.id));
  useEffect(() => { addToInbox(response); }, [response]);
  const mine = getForm(response.formId);
  return (
    <section className="page narrow">
      <p className="eyebrow">{isNew ? "Saved to your responses" : "Already in your responses"}</p>
      <h1 className="page-title">{response.from || "Applicant"}</h1>
      <p className="lede">{response.title} · {new Date(response.at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</p>
      <ResponseDetail r={response} />
      {mine && <div className="row-start"><a className="btn btn-primary" href={`#/edit/${mine.id}/responses`}>See all responses</a></div>}
    </section>
  );
}
