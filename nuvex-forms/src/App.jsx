import { useEffect, useMemo, useState } from "react";
import Builder, { newQuestion } from "./Builder.jsx";
import Fill from "./Fill.jsx";
import Interview, { InterviewReport } from "./Interview.jsx";
import { TEMPLATES } from "./templates.js";
import {
  PROFILE_FIELDS, addToInbox, answersAsText, deleteForm, download, formLink, getForm, loadBank,
  loadForms, loadInbox, loadProfile, publicForm, removeFromInbox, saveBank, saveForm, saveProfile, toCSV, uid, unpack,
} from "./store.js";
import { CopyButton, VoiceField, clock, timeAgo, whatsappLink } from "./ui.jsx";
import { IArrowRight, IChat, IDownload, IEye, IPen, IPlus, ITrash } from "./icons.jsx";

/** "#/new/<template>" creates a draft once and becomes "#/edit/<id>", so refresh or Back never duplicates it. */
function resolveHash() {
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

function fromTemplate(tid) {
  const t = TEMPLATES.find((x) => x.id === tid);
  const base = { id: uid(), title: "", intro: "", owner: {}, questions: [newQuestion("What's your full name?", "short")] };
  if (!t) return base;
  return {
    ...base,
    title: t.title,
    intro: t.intro,
    questions: t.questions.map((q) => ({ options: [], required: false, autofill: "", ...q, id: uid(), autofillTouched: true })),
  };
}

export default function App() {
  const hash = useHash();

  // Applicant links: the form only, no product chrome.
  if (hash.startsWith("#f=")) {
    const form = unpack(hash.slice(3));
    if (!form?.questions) return <Shell><Broken /></Shell>;
    return form.interview?.enabled ? <Interview key={hash} form={form} /> : <Fill key={hash} form={form} />;
  }
  if (hash.startsWith("#r=")) {
    const r = unpack(hash.slice(3));
    return <Shell page="responses">{r?.answers ? <ResponseView key={r.id} response={r} /> : <Broken />}</Shell>;
  }

  const [, page, arg] = hash.split("/");
  if (page === "edit") {
    const f = getForm(arg);
    return f ? <Builder key={arg} initial={f} onBack={() => go("#/")} onPreview={(x) => go(`#/preview/${x.id}`)} /> : <Shell><Broken /></Shell>;
  }
  if (page === "preview") {
    const f = getForm(arg);
    if (!f) return <Shell><Broken /></Shell>;
    const pf = publicForm(f);
    const exit = () => go(`#/edit/${f.id}`);
    return pf.interview?.enabled ? <Interview key={hash} form={pf} preview onExit={exit} /> : <Fill key={hash} form={pf} preview onExit={exit} />;
  }
  if (page === "sample") {
    if (arg === "video") {
      const t = fromTemplate("interview");
      const f = publicForm({ ...t, title: "Video editor — screening interview", owner: { name: "Sample studio" }, interview: { enabled: true, seconds: 90, followups: true },
        questions: t.questions.filter((q) => !q.autofill).slice(1, 4) });
      return <Interview key={hash} form={f} preview onExit={() => go("#/")} />;
    }
    const t = fromTemplate(arg);
    return <Fill key={hash} form={publicForm({ ...t, owner: { name: "Sample application" } })} preview onExit={() => go("#/")} />;
  }
  if (page === "responses" || page === "inbox") return <Shell page="responses"><Responses /></Shell>;
  if (page === "details" || page === "me") return <Shell page="details"><SavedDetails /></Shell>;
  return <Shell page="home"><Home /></Shell>;
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

function Shell({ children, page }) {
  return (
    <div className="site">
      <header className="nav">
        <div className="nav-inner">
          <a href="#/" className="wordmark"><Mark /><span>Nuvex Forms</span></a>
          <nav className="nav-links" aria-label="Main">
            <a href="#/" className={page === "home" ? "is-active" : ""}>Forms</a>
            <a href="#/responses" className={page === "responses" ? "is-active" : ""}>Responses</a>
            <a href="#/details" className={page === "details" ? "is-active" : ""}>Saved details</a>
          </nav>
          <a href="#/new/blank" className="btn btn-primary btn-sm nav-cta"><IPlus size={15} /><span>New form</span></a>
        </div>
      </header>
      <main>{children}</main>
      <footer className="footer">
        <div className="footer-inner">
          <a href="#/" className="wordmark is-small"><Mark size={18} /><span>Nuvex Forms</span></a>
          <p>Applications people finish. A Nuvex product.</p>
          <p className="muted">Forms and answers stay on your device and inside the links you share.</p>
        </div>
      </footer>
    </div>
  );
}

function Broken() {
  return (
    <section className="page narrow empty">
      <h1 className="page-title">This link doesn't open</h1>
      <p className="lede">It was probably cut short when it was copied. Ask the sender for the full link.</p>
      <a className="btn" href="#/">Go to Nuvex Forms</a>
    </section>
  );
}

// ---------- Home ----------

const MOCK_ANSWER = "Last year I edited the launch film for a local clothing label. We shot everything on two phones in a weekend, and I cut it down to forty seconds for Instagram.";

function ProductShot() {
  const reduce = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [n, setN] = useState(reduce ? MOCK_ANSWER.length : 0);
  useEffect(() => {
    if (reduce) return;
    const id = setInterval(() => setN((x) => (x >= MOCK_ANSWER.length + 40 ? 0 : x + 1)), 45);
    return () => clearInterval(id);
  }, [reduce]);
  const shown = MOCK_ANSWER.slice(0, Math.min(n, MOCK_ANSWER.length));
  const secs = Math.floor(Math.min(n, MOCK_ANSWER.length) / 6);
  return (
    <figure className="shot" aria-label="An applicant recording an answer in Nuvex Forms">
      <div className="shot-bar"><span /><span /><span /><em>nuvexforms.app</em></div>
      <div className="shot-body">
        <div className="progress is-static"><span style={{ width: "42%" }} /></div>
        <p className="q-meta"><span className="q-num">05</span><span className="q-of">of 12</span></p>
        <p className="shot-q">Tell us about a project you're proud of.</p>
        <p className="shot-a">{shown}<span className="caret" /></p>
        <div className="shot-tools">
          <span className="record is-live"><span className="rec-dot is-live" /><span>Stop</span><span className="record-time">{clock(secs)}</span></span>
          <span className="shot-hint">Press <kbd>Ctrl</kbd> <kbd>Enter</kbd></span>
        </div>
        <div className="reuse is-shot">
          <p className="reuse-label">From an earlier application</p>
          <p className="reuse-text">I led the edit on a twelve-part series for a youth football league…</p>
        </div>
      </div>
    </figure>
  );
}

const COMPARE = [
  ["Answering on a phone", "Typing paragraphs into a shared document", "Record, tap or type, one question at a time"],
  ["Name, email, phone", "Entered again on every application", "Filled in from saved details"],
  ["Similar questions", "Rewritten from scratch each time", "Reuse an earlier answer in one tap"],
  ["Unfinished answers", "Easy to overwrite or lose", "Saved on the device as you go"],
  ["Collecting answers", "Copied out of separate documents", "One inbox, exported as a spreadsheet"],
  ["Getting access", "Permission requests and sign-ins", "A link that opens anywhere, no account"],
];

function Home() {
  const [forms, setForms] = useState(loadForms);
  const inbox = useMemo(loadInbox, []);
  const counts = useMemo(() => inbox.reduce((m, r) => ((m[r.formId] = (m[r.formId] || 0) + 1), m), {}), [inbox]);

  return (
    <>
      <section className="hero">
        <div className="hero-inner">
          <div className="hero-copy">
            <p className="eyebrow">Application forms, reconsidered</p>
            <h1 className="display">Applications people actually finish.</h1>
            <p className="lede">
              Write your interview or application questions once and send a link. Applicants answer by speaking,
              tapping or reusing what they've written before — on any phone, without an account.
            </p>
            <div className="hero-actions">
              <a className="btn btn-primary btn-lg" href="#/new/blank"><span>Create a form</span><IArrowRight size={18} /></a>
              <a className="btn btn-lg" href="#/sample/interview"><IEye size={18} /><span>Try a sample application</span></a>
            </div>
            <p className="fine">Free to use. Nothing to install.</p>
          </div>
          <ProductShot />
        </div>
      </section>

      {forms.length > 0 && (
        <section className="page">
          <div className="section-head">
            <h2>Your forms</h2>
            <a className="text-btn" href="#/new/blank"><IPlus size={15} /><span>New form</span></a>
          </div>
          <div className="table">
            <div className="table-row table-headrow">
              <span>Title</span><span>Questions</span><span>Responses</span><span>Edited</span><span />
            </div>
            {forms.map((f) => (
              <div className="table-row" key={f.id}>
                <a className="table-title" href={`#/edit/${f.id}`}>{f.title || "Untitled form"}</a>
                <span className="muted" data-label="Questions">{f.questions.length}</span>
                <span className="muted" data-label="Responses">{counts[f.id] || 0}</span>
                <span className="muted" data-label="Edited">{f.updated ? timeAgo(f.updated) : "—"}</span>
                <span className="table-actions">
                  <CopyButton text={formLink(f)} label="Copy link" className="btn btn-sm" />
                  <a className="icon-btn" href={`#/edit/${f.id}`} aria-label="Edit" title="Edit"><IPen size={16} /></a>
                  <button className="icon-btn is-danger" aria-label="Delete" title="Delete"
                    onClick={() => { if (confirm(`Delete “${f.title || "Untitled form"}”? This can't be undone.`)) { deleteForm(f.id); setForms(loadForms()); } }}>
                    <ITrash size={16} />
                  </button>
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="page" id="templates">
        <div className="section-head">
          <div>
            <h2>Start from a template</h2>
            <p className="muted">Written with hiring managers and admissions teams in mind. Every question can be edited.</p>
          </div>
        </div>
        <div className="templates">
          {TEMPLATES.map((t) => (
            <article className="template" key={t.id}>
              <p className="template-cat">{t.category}</p>
              <h3>{t.title}</h3>
              <p className="template-blurb">{t.blurb}</p>
              <p className="template-count">{t.questions.length} questions</p>
              <div className="template-actions">
                <a className="btn btn-sm btn-primary" href={`#/new/${t.id}`}>Use template</a>
                <a className="btn btn-sm" href={`#/sample/${t.id}`}>Preview</a>
              </div>
            </article>
          ))}
          <a className="template is-blank" href="#/new/blank">
            <IPlus size={22} />
            <h3>Blank form</h3>
            <p className="template-blurb">Type, paste or dictate your own questions.</p>
          </a>
        </div>
      </section>

      <section className="page">
        <div className="feature">
          <div className="feature-copy">
            <p className="eyebrow">New · Video interviews</p>
            <h2 className="display is-small">A first interview that runs itself.</h2>
            <p className="lede">
              Turn any form into a timed video interview. The interviewer asks each question aloud, the applicant answers on camera
              against the clock, and Claude asks a short follow-up when an answer is vague. You get a transcript, an AI review of what
              was said, and integrity flags for tab switching or anyone else in view.
            </p>
            <ul className="feature-points">
              <li>Never scored: appearance, accent or background.</li>
              <li>Video stays on the applicant's device. Face checks run locally.</li>
              <li>Results are sealed, so edits to the link are detected.</li>
            </ul>
            <div className="hero-actions">
              <a className="btn btn-primary btn-lg" href="#/sample/video"><span>Try a sample interview</span><IArrowRight size={18} /></a>
            </div>
          </div>
          <div className="feature-shot" aria-hidden="true">
            <div className="iv-tiles is-demo">
              <div className="iv-tile iv-host is-speaking"><div className="iv-avatar">S</div><div className="iv-voice"><span /><span /><span /><span /><span /></div><span className="iv-label">Sample studio · Interviewer</span></div>
              <div className="iv-tile iv-self is-placeholder"><span className="iv-label">You</span></div>
            </div>
            <p className="q-meta"><span className="q-num">Follow-up</span><span className="q-of">to question 02</span></p>
            <p className="shot-q">What was your part in that launch, specifically?</p>
            <div className="iv-timer is-demo"><svg width="40" height="40" viewBox="0 0 56 56"><circle cx="28" cy="28" r="22" className="iv-ring-bg" /><circle cx="28" cy="28" r="22" className="iv-ring" strokeDasharray="138.2" strokeDashoffset="52" /></svg><span>0:34</span></div>
          </div>
        </div>
      </section>

      <section className="page">
        <div className="steps">
          {[
            ["01", "Write", "Start from a template, or paste and dictate your own questions. Answer types are set for you."],
            ["02", "Share", "Send one link by WhatsApp or email. It opens on any phone, with nothing to install."],
            ["03", "Read", "Answers arrive as a tidy message and collect in your inbox, ready to export."],
          ].map(([n, h, p]) => (
            <div className="step" key={n}>
              <span className="step-num">{n}</span>
              <h3>{h}</h3>
              <p>{p}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="page">
        <div className="section-head">
          <div>
            <h2>Why teams move their applications here</h2>
            <p className="muted">The same questions, without the parts that make people give up halfway.</p>
          </div>
        </div>
        <div className="compare" role="table">
          <div className="compare-row compare-headrow" role="row">
            <span role="columnheader" />
            <span role="columnheader">Shared document</span>
            <span role="columnheader">Nuvex Forms</span>
          </div>
          {COMPARE.map(([k, a, b]) => (
            <div className="compare-row" role="row" key={k}>
              <span role="rowheader">{k}</span>
              <span role="cell" className="muted">{a}</span>
              <span role="cell">{b}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="page closing">
        <h2 className="display is-small">Your next round of applications can start today.</h2>
        <div className="hero-actions">
          <a className="btn btn-primary btn-lg" href="#/new/interview"><span>Use the screening interview</span><IArrowRight size={18} /></a>
          <a className="btn btn-lg" href="#/new/blank"><span>Start blank</span></a>
        </div>
      </section>
    </>
  );
}

// ---------- Responses ----------

function AnswerList({ answers }) {
  return (
    <dl className="answers">
      {answers.map(([q, a], i) => (
        <div className="answers-row" key={i}>
          <dt>{q}</dt>
          <dd className={a ? "" : "muted"}>{a || "No answer"}</dd>
        </div>
      ))}
    </dl>
  );
}

function ResponseView({ response }) {
  const [isNew] = useState(() => !loadInbox().some((r) => r.id === response.id));
  useEffect(() => { addToInbox(response); }, [response]);
  return (
    <section className="page narrow">
      <p className="eyebrow">{isNew ? "Added to your responses" : "Already in your responses"}</p>
      <h1 className="page-title">{response.from || "Applicant"}</h1>
      <p className="lede">{response.title} · {new Date(response.at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</p>
      {response.kind === "interview" ? <InterviewReport response={response} /> : <AnswerList answers={response.answers} />}
      <div className="row-start">
        <a className="btn btn-primary" href="#/responses"><span>All responses</span><IArrowRight size={16} /></a>
        <CopyButton text={answersAsText(response.title, response.answers)} label="Copy as text" />
      </div>
    </section>
  );
}

function Responses() {
  const [inbox, setInbox] = useState(loadInbox);
  const [open, setOpen] = useState(null);
  const groups = useMemo(() => {
    const m = new Map();
    for (const r of inbox) {
      if (!m.has(r.formId)) m.set(r.formId, { title: r.title, items: [] });
      m.get(r.formId).items.push(r);
    }
    return [...m.values()];
  }, [inbox]);

  return (
    <section className="page">
      <h1 className="page-title">Responses</h1>
      {!inbox.length ? (
        <div className="empty-box">
          <h2>No responses yet</h2>
          <p>When an applicant finishes, they send you a message with a link. Open that link on this device and their answers appear here, ready to read or export.</p>
          <a className="btn" href="#/">Back to forms</a>
        </div>
      ) : groups.map((g) => (
        <div className="group" key={g.title + g.items[0].id}>
          <div className="section-head">
            <h2>{g.title} <span className="muted">{g.items.length}</span></h2>
            <button className="btn btn-sm" onClick={() => download(`${g.title} - responses.csv`, toCSV(g.items), "text/csv")}>
              <IDownload size={15} /><span>Export CSV</span>
            </button>
          </div>
          <div className="table">
            {g.items.map((r) => {
              const preview = r.answers.find(([, a]) => a && a.length > 30)?.[1] || r.answers.find(([, a]) => a)?.[1] || "";
              return (
                <div key={r.id} className={`table-item ${open === r.id ? "is-open" : ""}`}>
                  <button className="table-row is-button" onClick={() => setOpen(open === r.id ? null : r.id)} aria-expanded={open === r.id}>
                    <span className="table-title">{r.from || "Applicant"}{r.kind === "interview" && <span className="tag">Video interview</span>}</span>
                    <span className="muted table-preview">{preview}</span>
                    <span className="muted">{timeAgo(r.at)}</span>
                  </button>
                  {open === r.id && (
                    <div className="table-detail">
                      {r.kind === "interview" ? <InterviewReport response={r} /> : <AnswerList answers={r.answers} />}
                      <div className="row-start">
                        <CopyButton text={answersAsText(r.title, r.answers)} label="Copy" className="btn btn-sm" />
                        <button className="btn btn-sm is-danger" onClick={() => { removeFromInbox(r.id); setInbox(loadInbox()); }}>
                          <ITrash size={15} /><span>Remove</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </section>
  );
}

// ---------- Saved details ----------

function SavedDetails() {
  const [p, setP] = useState(loadProfile);
  const [bank, setBank] = useState(loadBank);
  const [saved, setSaved] = useState(false);
  const set = (k, v) => { setP((x) => ({ ...x, [k]: v })); setSaved(false); };

  return (
    <section className="page">
      <h1 className="page-title">Saved details</h1>
      <div className="split">
        <div className="split-aside">
          <h2>Your details</h2>
          <p className="muted">Entered once, filled in on every Nuvex form you open on this device. Stored only here, never uploaded.</p>
        </div>
        <div className="split-main">
          {PROFILE_FIELDS.map((f) => (
            <label key={f.key} className="lbl">{f.label}
              <VoiceField type={f.type} autoComplete={f.auto} value={p[f.key]} onChange={(v) => set(f.key, v)} />
            </label>
          ))}
          <div className="row-start">
            <button className="btn btn-primary" onClick={() => { saveProfile(p); setSaved(true); }}>{saved ? "Saved" : "Save details"}</button>
          </div>
        </div>
      </div>

      <div className="split">
        <div className="split-aside">
          <h2>Reusable answers</h2>
          <p className="muted">Longer answers from past applications. When a new form asks something similar, you can reuse one in a single tap.</p>
        </div>
        <div className="split-main">
          {!bank.length && <p className="muted">Nothing yet. Answers are added here when you submit a form.</p>}
          {bank.map((b, i) => (
            <div className="bank" key={b.at + b.question}>
              <p className="bank-q">{b.question}</p>
              <p className="bank-a">{b.answer}</p>
              <button className="text-btn is-danger" onClick={() => { const nb = bank.filter((_, j) => j !== i); saveBank(nb); setBank(nb); }}>Remove</button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
