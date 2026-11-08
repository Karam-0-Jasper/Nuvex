import { useEffect, useMemo, useState } from "react";
import Builder, { newQuestion } from "./Builder.jsx";
import Fill from "./Fill.jsx";
import { ResponseDetail } from "./Responses.jsx";
import { TEMPLATES, THEMES, themeOf } from "./templates.js";
import { addToInbox, deleteForm, formLink, getForm, getLetter, loadForms, loadInbox, loadLetters, publicForm, saveForm, saveLetter, uid, unpack } from "./store.js";
import { CopyButton, MicButton, appendText, timeAgo } from "./ui.jsx";
import { draftForm } from "./assist.js";
import { LetterList, LetterTiles, LetterWriter, LettersHome, newLetter } from "./Letter.jsx";
import { matchLetter, wantsLetter } from "./letters.js";
import { IArrowRight, IPen, IPlus, ITrash } from "./icons.jsx";

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
          <a href="#/letters" className="btn btn-sm nav-letters"><IPen size={15} /><span className="hide-sm">Letters</span></a>
          <a href="#/new/blank" className="btn btn-primary btn-sm"><IPlus size={15} /><span>New form</span></a>
        </div>
      </header>
      <main>{children}</main>
    </div>
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

const EXAMPLES = ["Tryouts for our under-17 football team", "Hiring a video editor for our studio", "Registration for a weekend photography workshop", "A job application letter"];

/** One sentence in, a ready form out. */
function Describe() {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const create = async (e) => {
    e?.preventDefault();
    const d = text.trim();
    if (!d || busy) return;
    if (wantsLetter(d)) {
      const letter = newLetter(matchLetter(d));
      saveLetter(letter);
      go(`#/letter/${letter.id}`);
      return;
    }
    setBusy(true);
    const draft = await draftForm(d);
    const f = { id: uid(), title: draft.title, intro: draft.intro, description: d, draftedBy: draft.source, owner: {}, questions: draft.questions };
    saveForm(f);
    go(`#/edit/${f.id}`);
  };
  return (
    <form className="describe" onSubmit={create}>
      <p className="describe-hello">Hello there</p>
      <label className="describe-label" htmlFor="describe">What would you like to <em>make</em> today?</label>
      <div className="describe-box">
        <input id="describe" value={text} onChange={(e) => setText(e.target.value)} disabled={busy}
          placeholder="Describe your form or letter in a sentence…" autoComplete="off" />
        <MicButton onText={(t) => setText((v) => appendText(v, t))} label="Say it" />
        <button className="btn btn-primary" type="submit" disabled={!text.trim() || busy}>
          <span>{busy ? "Building…" : "Create"}</span>{!busy && <IArrowRight size={16} />}
        </button>
      </div>
      <p className="describe-hint">
        We'll add the usual questions and the ones your topic needs. Ask for a letter and we'll set out its format. You can change anything after.
      </p>
      <p className="describe-examples">
        {EXAMPLES.map((x) => <button type="button" key={x} className="example-chip" onClick={() => setText(x)}>{x}</button>)}
      </p>
    </form>
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
          <Describe />
          <h2 className="start-h">Or start from a template</h2>
          <div className="tiles">
            <a className="tile" href="#/new/blank">
              <span className="tile-art is-blank"><IPlus size={30} /></span>
              <span className="tile-name">Blank form</span>
            </a>
            {TEMPLATES.map((t, i) => (
              <a className="tile" key={t.id} href={`#/new/${t.id}`} style={{ "--theme": THEMES[i % THEMES.length].c, "--theme-soft": THEMES[i % THEMES.length].soft }}>
                <span className="tile-art">
                  <span className="tile-line is-title" />
                  {t.questions.slice(0, 3).map((q, i) => <span key={i} className="tile-line" />)}
                  {t.interview && <span className="tile-badge">Interview</span>}
                </span>
                <span className="tile-name">{t.title}</span>
              </a>
            ))}
          </div>
          <h2 className="start-h l-home-h">Or write a letter in the right format</h2>
          <LetterTiles limit={5} />
        </div>
      </section>

      <section className="page">
        <h2 className="start-h">Your forms</h2>
        {!forms.length ? (
          <p className="muted">No forms yet. Start one above — it takes a minute.</p>
        ) : (
          <div className="table">
            {forms.map((f) => (
              <div className="table-row is-forms" key={f.id} style={{ "--theme": themeOf(f).c, "--theme-soft": themeOf(f).soft }}>
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
