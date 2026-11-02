import { useEffect, useMemo, useState } from "react";
import Builder, { newQuestion } from "./Builder.jsx";
import Fill from "./Fill.jsx";
import { TEMPLATES } from "./templates.js";
import {
  PROFILE_FIELDS, addToInbox, answersAsText, deleteForm, download, formLink, getForm, loadBank,
  loadForms, loadInbox, loadProfile, publicForm, removeFromInbox, saveBank, saveProfile, toCSV, uid, unpack,
} from "./store.js";
import { CopyButton, MicIcon, VoiceField, whatsappLink } from "./ui.jsx";

function useHash() {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const on = () => { setHash(location.hash); window.scrollTo(0, 0); };
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

  // Someone opened a form link → just the form, nothing else.
  if (hash.startsWith("#f=")) {
    const form = unpack(hash.slice(3));
    if (!form?.questions) return <Shell bare><Broken /></Shell>;
    return <Shell bare><Fill key={hash} form={form} /></Shell>;
  }
  if (hash.startsWith("#r=")) {
    const r = unpack(hash.slice(3));
    return <Shell>{r?.answers ? <ResponseView key={r.id} response={r} /> : <Broken />}</Shell>;
  }

  const [, page, arg] = hash.split("/");
  if (page === "new") return <Shell title="New form"><Builder key={hash} initial={fromTemplate(arg)} onDone={() => go("#/")} onPreview={(f) => go(`#/preview/${f.id}`)} /></Shell>;
  if (page === "edit") {
    const f = getForm(arg);
    return <Shell title="Edit form">{f ? <Builder key={hash} initial={f} onDone={() => go("#/")} onPreview={(x) => go(`#/preview/${x.id}`)} /> : <Broken />}</Shell>;
  }
  if (page === "preview") {
    const f = getForm(arg);
    return <Shell bare>{f ? <Fill key={hash} form={publicForm(f)} preview onExit={() => go(`#/edit/${f.id}`)} /> : <Broken />}</Shell>;
  }
  if (page === "inbox") return <Shell title="Answers you got"><Inbox /></Shell>;
  if (page === "me") return <Shell title="My info"><Profile /></Shell>;
  return <Shell><Home /></Shell>;
}

function Shell({ children, bare, title }) {
  return (
    <div className="app">
      <header className="top">
        <a href="#/" className="brand"><span className="logo"><MicIcon size={16} /></span>Nuvex Forms</a>
        {!bare && (
          <nav>
            <a href="#/inbox">Inbox</a>
            <a href="#/me">My info</a>
          </nav>
        )}
      </header>
      <main>
        {title && <h1 className="page-title">{title}</h1>}
        {children}
      </main>
      {bare && <footer className="foot">Made with <a href="#/">Nuvex Forms</a> — forms you can just talk to.</footer>}
    </div>
  );
}

function Broken() {
  return (
    <div className="card welcome">
      <h2>This link doesn't work</h2>
      <p className="muted">It may have been cut off when it was copied. Ask the person to send it again.</p>
      <a className="btn" href="#/">Go home</a>
    </div>
  );
}

function Home() {
  const [forms, setForms] = useState(loadForms);
  const [paste, setPaste] = useState("");
  const inboxCount = loadInbox().length;

  const openPasted = () => {
    const i = paste.indexOf("#");
    if (i >= 0) location.hash = paste.slice(i);
  };

  return (
    <>
      <section className="hero">
        <h1>Forms people can <span className="hl">just talk to.</span></h1>
        <p>Interview questions, job and school applications, client briefs. Send a link. People answer by speaking, tapping, or reusing what they've already said. No typing marathons.</p>
        <div className="row wrap">
          <a className="btn primary" href="#/new/blank">+ Make a form</a>
          <a className="btn" href="#/inbox">Inbox{inboxCount ? ` (${inboxCount})` : ""}</a>
        </div>
      </section>

      <section className="how">
        <div><span>🎙️</span><b>Speak answers</b><small>Every answer has a mic. Or go fully hands-free: it reads the questions, you talk.</small></div>
        <div><span>👆</span><b>Tap, don't type</b><small>Choices, yes/no, ratings and dates are one tap — or say “the second one”.</small></div>
        <div><span>✨</span><b>Fills itself</b><small>Name, email, phone fill in automatically. Answered something similar before? Reuse it.</small></div>
      </section>

      <h2 className="section">Start from a template</h2>
      <div className="templates">
        {TEMPLATES.map((t) => (
          <a key={t.id} className="template" href={`#/new/${t.id}`}>
            <span className="t-icon">{t.icon}</span>
            <b>{t.title}</b>
            <small>{t.blurb}</small>
            <small className="muted">{t.questions.length} questions</small>
          </a>
        ))}
        <a className="template blank" href="#/new/blank"><span className="t-icon">➕</span><b>Blank form</b><small>Type or say your own questions.</small></a>
      </div>

      {forms.length > 0 && (
        <>
          <h2 className="section">My forms</h2>
          <div className="list">
            {forms.map((f) => {
              const link = formLink(f);
              const got = loadInbox().filter((r) => r.formId === f.id).length;
              return (
                <div className="card list-item" key={f.id}>
                  <div className="grow">
                    <b>{f.title}</b>
                    <p className="muted small-text">{f.questions.length} questions · {got} answer{got === 1 ? "" : "s"} received</p>
                  </div>
                  <div className="row wrap">
                    <CopyButton text={link} label="Copy link" className="btn small primary" />
                    <a className="btn small wa" href={whatsappLink("", `${f.title}\nAnswer here (you can just talk): ${link}`)} target="_blank" rel="noreferrer">WhatsApp</a>
                    <a className="btn small" href={`#/edit/${f.id}`}>Edit</a>
                    <button className="btn small danger" onClick={() => { if (confirm(`Delete "${f.title}"?`)) { deleteForm(f.id); setForms(loadForms()); } }}>Delete</button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <div className="card">
        <h3>Got a form link or answers link?</h3>
        <div className="row">
          <input className="grow" value={paste} onChange={(e) => setPaste(e.target.value)} placeholder="Paste it here" />
          <button className="btn" onClick={openPasted} disabled={!paste.includes("#")}>Open</button>
        </div>
      </div>
    </>
  );
}

function AnswerList({ answers }) {
  return (
    <ol className="review static">
      {answers.map(([q, a], i) => (
        <li key={i}><span className="rq">{q}</span><span className="ra">{a || <em>No answer</em>}</span></li>
      ))}
    </ol>
  );
}

function ResponseView({ response }) {
  const [isNew] = useState(() => !loadInbox().some((r) => r.id === response.id));
  useEffect(() => { addToInbox(response); }, [response]);
  return (
    <div className="card">
      <p className="good small-text">{isNew ? "✓ Saved to your inbox" : "Already in your inbox"}</p>
      <h2>{response.title}</h2>
      <p className="muted">{response.from ? `From ${response.from} · ` : ""}{new Date(response.at).toLocaleString()}</p>
      <AnswerList answers={response.answers} />
      <div className="row wrap">
        <CopyButton text={answersAsText(response.title, response.answers)} label="Copy as text" />
        <a className="btn primary" href="#/inbox">Open inbox</a>
      </div>
    </div>
  );
}

function Inbox() {
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

  if (!inbox.length) {
    return (
      <div className="card welcome">
        <h2>No answers yet</h2>
        <p className="muted">When someone finishes your form, they send you a message with a link. Open that link on this phone and the answers land here, ready to read or download as a spreadsheet.</p>
        <a className="btn primary" href="#/">Back home</a>
      </div>
    );
  }
  return groups.map((g) => (
    <div className="card" key={g.title + g.items[0].id}>
      <div className="row">
        <h3 className="grow">{g.title} <span className="muted">({g.items.length})</span></h3>
        <button className="btn small" onClick={() => download(`${g.title} - answers.csv`, toCSV(g.items), "text/csv")}>Download spreadsheet</button>
      </div>
      {g.items.map((r) => (
        <div key={r.id} className="inbox-item">
          <button className="inbox-head" onClick={() => setOpen(open === r.id ? null : r.id)}>
            <b>{r.from || "Someone"}</b>
            <span className="muted small-text">{new Date(r.at).toLocaleDateString()}</span>
            <span>{open === r.id ? "▲" : "▼"}</span>
          </button>
          {open === r.id && (
            <>
              <AnswerList answers={r.answers} />
              <div className="row wrap">
                <CopyButton text={answersAsText(r.title, r.answers)} label="Copy" className="btn small" />
                <button className="btn small danger" onClick={() => { removeFromInbox(r.id); setInbox(loadInbox()); }}>Remove</button>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  ));
}

function Profile() {
  const [p, setP] = useState(loadProfile);
  const [bank, setBank] = useState(loadBank);
  const [saved, setSaved] = useState(false);
  const set = (k, v) => { setP((x) => ({ ...x, [k]: v })); setSaved(false); };

  return (
    <>
      <div className="card">
        <p className="muted">Save these once. Every Nuvex form you open on this phone fills them in for you. They stay on this phone only.</p>
        {PROFILE_FIELDS.map((f) => (
          <div key={f.key}>
            <label className="lbl" htmlFor={"p-" + f.key}>{f.label}</label>
            <VoiceField id={"p-" + f.key} type={f.type} autoComplete={f.auto} value={p[f.key]} onChange={(v) => set(f.key, v)} />
          </div>
        ))}
        <div className="row">
          <button className="btn primary grow" onClick={() => { saveProfile(p); setSaved(true); }}>{saved ? "Saved ✓" : "Save my info"}</button>
        </div>
      </div>

      <div className="card">
        <h3>Answers I can reuse ({bank.length})</h3>
        <p className="muted small-text">Longer answers you gave before. When a new form asks something similar, you'll get a “Use this answer” button.</p>
        {bank.map((b, i) => (
          <div className="bank-item" key={b.at + b.question}>
            <b>{b.question}</b>
            <p>{b.answer}</p>
            <button className="link small-text danger" onClick={() => { const nb = bank.filter((_, j) => j !== i); saveBank(nb); setBank(nb); }}>Forget this</button>
          </div>
        ))}
      </div>
    </>
  );
}
