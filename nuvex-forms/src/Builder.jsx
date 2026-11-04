// The form editor. Saves automatically, like a document.
import { useEffect, useRef, useState } from "react";
import { TYPES } from "./templates.js";
import { PROFILE_FIELDS, formLink, guessAutofill, saveForm, uid } from "./store.js";
import { CopyButton, MicButton, Switch, VoiceField, appendText, whatsappLink } from "./ui.jsx";
import {
  IArrowDown, IArrowLeft, IArrowUp, IChat, IDuplicate, IEye, IMail, IPlus, IShare, ITrash, IX,
} from "./icons.jsx";

const AUTOFILL = [{ key: "", label: "Off" }, ...PROFILE_FIELDS.map((f) => ({ key: f.key, label: f.label }))];
const pad2 = (n) => String(n).padStart(2, "0");

export function newQuestion(text = "", type = "long") {
  const q = { id: uid(), type, text, options: [], required: false, autofill: guessAutofill(text) };
  if (type === "choice" || type === "multi") q.options = ["", ""];
  return q;
}

/** Turn a paragraph of spoken or pasted questions into separate questions. */
export function splitQuestions(raw) {
  return raw
    .replace(/\bnext question\b/gi, "\n")
    .match(/[^?\n]+\??/g)
    ?.map((s) => s.replace(/^[\s\d.)\-•*]+/, "").trim())
    .filter((s) => s.replace(/\?/g, "").trim().length > 3)
    .map((s) => {
      const text = s.charAt(0).toUpperCase() + s.slice(1);
      const auto = guessAutofill(text);
      let type = "long";
      if (auto) type = "short";
      else if (/^(are|do|did|have|has|can|could|will|would|is|were)\b/i.test(text)) type = "yesno";
      else if (/\bwhen\b.*\b(start|available|begin|date|deadline)\b|\bdate\b/i.test(text)) type = "date";
      else if (/^(what is your|whats your|what's your|which)\b/i.test(text) && text.length < 45) type = "short";
      return { ...newQuestion(text, type), autofill: auto };
    }) || [];
}

function problems(form) {
  if (!form.title.trim()) return "Give the form a title before sharing it.";
  if (!form.questions.length) return "Add at least one question before sharing.";
  const bad = form.questions.findIndex((q) => !q.text.trim());
  if (bad >= 0) return `Question ${bad + 1} has no text yet.`;
  const noOpts = form.questions.findIndex((q) => (q.type === "choice" || q.type === "multi") && q.options.filter((o) => o.trim()).length < 2);
  if (noOpts >= 0) return `Question ${noOpts + 1} needs at least two options.`;
  return "";
}

const clean = (form) => ({
  ...form,
  title: form.title.trim(),
  questions: form.questions.map((q) => ({ ...q, text: q.text.trim(), options: (q.options || []).map((o) => o.trim()).filter(Boolean) })),
});

export default function Builder({ initial, onBack, onPreview }) {
  const [form, setForm] = useState(initial);
  const [bulk, setBulk] = useState("");
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState("");
  const [savedAt, setSavedAt] = useState(null);
  const firstRun = useRef(true);

  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    const t = setTimeout(() => { saveForm(form); setSavedAt(Date.now()); }, 400);
    return () => clearTimeout(t);
  }, [form]);

  const update = (patch) => setForm((f) => ({ ...f, ...patch }));
  const updateOwner = (patch) => setForm((f) => ({ ...f, owner: { ...f.owner, ...patch } }));
  const setQ = (id, patch) => setForm((f) => ({ ...f, questions: f.questions.map((q) => (q.id === id ? { ...q, ...patch } : q)) }));
  const removeQ = (id) => setForm((f) => ({ ...f, questions: f.questions.filter((q) => q.id !== id) }));
  const duplicateQ = (i) => setForm((f) => {
    const qs = [...f.questions];
    qs.splice(i + 1, 0, { ...qs[i], id: uid(), options: [...(qs[i].options || [])] });
    return { ...f, questions: qs };
  });
  const moveQ = (i, d) => setForm((f) => {
    const qs = [...f.questions];
    const j = i + d;
    if (j < 0 || j >= qs.length) return f;
    [qs[i], qs[j]] = [qs[j], qs[i]];
    return { ...f, questions: qs };
  });
  const addQs = (list) => setForm((f) => ({ ...f, questions: [...f.questions, ...list] }));

  const changeType = (q, type) => {
    const patch = { type };
    if ((type === "choice" || type === "multi") && !(q.options || []).filter(Boolean).length) patch.options = ["", ""];
    setQ(q.id, patch);
  };

  const flushSave = () => { const f = clean(form); saveForm(f); setForm(f); setSavedAt(Date.now()); return f; };
  const share = () => {
    const e = problems(form);
    setError(e);
    if (e) return;
    flushSave();
    setSharing(true);
  };
  const preview = () => {
    const e = problems(form);
    setError(e);
    if (e) return;
    onPreview(flushSave());
  };

  const link = sharing ? formLink(clean(form)) : "";
  const invite = `${form.title}\n\nYou can type or record your answers — no account needed:\n${link}`;

  return (
    <div className="editor-page">
      <header className="editor-bar">
        <div className="editor-bar-inner">
          <button className="text-btn back-link" onClick={onBack}><IArrowLeft size={16} /><span>Forms</span></button>
          <span className="editor-status">{savedAt ? "Saved" : "Draft"}</span>
          <span className="grow" />
          <button className="btn" onClick={preview}><IEye size={16} /><span>Preview</span></button>
          <button className="btn btn-primary" onClick={share}><IShare size={16} /><span>Share</span></button>
        </div>
      </header>

      <main className="editor">
        {error && <p className="banner-error" role="alert">{error}</p>}

        <section className="doc-head">
          <VoiceField className="doc-title" value={form.title} onChange={(v) => update({ title: v })} placeholder="Untitled form" aria-label="Form title" />
          <VoiceField className="doc-intro" multiline rows={2} value={form.intro} onChange={(v) => update({ intro: v })}
            placeholder="Add a short introduction applicants see before they start" aria-label="Introduction" />
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>Delivery</h2>
            <p>When someone finishes, they send their answers to you with one tap.</p>
          </div>
          <div className="grid-3">
            <label className="lbl">Your name or organisation
              <input className="field" value={form.owner?.name || ""} onChange={(e) => updateOwner({ name: e.target.value })} placeholder="Pace Kreatvy" />
            </label>
            <label className="lbl">WhatsApp number
              <input className="field" type="tel" value={form.owner?.whatsapp || ""} onChange={(e) => updateOwner({ whatsapp: e.target.value })} placeholder="+231 77 000 0000" />
            </label>
            <label className="lbl">Email
              <input className="field" type="email" value={form.owner?.email || ""} onChange={(e) => updateOwner({ email: e.target.value })} placeholder="hiring@studio.com" />
            </label>
          </div>
        </section>

        <div className="section-head">
          <h2>Questions <span className="muted">{form.questions.length}</span></h2>
        </div>

        <ol className="qlist">
          {form.questions.map((q, i) => (
            <li className="qblock" key={q.id}>
              <div className="qblock-head">
                <span className="qblock-num">{pad2(i + 1)}</span>
                <select className="select" value={q.type} onChange={(e) => changeType(q, e.target.value)} aria-label="Answer type">
                  {TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
                <span className="grow" />
                <button className="icon-btn" onClick={() => moveQ(i, -1)} disabled={i === 0} aria-label="Move up" title="Move up"><IArrowUp size={16} /></button>
                <button className="icon-btn" onClick={() => moveQ(i, 1)} disabled={i === form.questions.length - 1} aria-label="Move down" title="Move down"><IArrowDown size={16} /></button>
                <button className="icon-btn" onClick={() => duplicateQ(i)} aria-label="Duplicate" title="Duplicate"><IDuplicate size={16} /></button>
                <button className="icon-btn is-danger" onClick={() => removeQ(q.id)} aria-label="Delete question" title="Delete"><ITrash size={16} /></button>
              </div>

              <VoiceField className="qblock-text" value={q.text} placeholder="Question"
                onChange={(v) => setQ(q.id, { text: v, ...(q.autofillTouched ? {} : { autofill: guessAutofill(v) }) })} aria-label={`Question ${i + 1}`} />
              <input className="field field-quiet" value={q.hint || ""} onChange={(e) => setQ(q.id, { hint: e.target.value })} placeholder="Description (optional)" aria-label="Description" />

              {(q.type === "choice" || q.type === "multi") && (
                <div className="opts">
                  {q.options.map((o, oi) => (
                    <div className="opt" key={oi}>
                      <span className={`opt-mark ${q.type === "multi" ? "is-square" : ""}`} />
                      <input className="field field-quiet" value={o} placeholder={`Option ${oi + 1}`} aria-label={`Option ${oi + 1}`}
                        onChange={(e) => setQ(q.id, { options: q.options.map((x, xi) => (xi === oi ? e.target.value : x)) })}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); setQ(q.id, { options: [...q.options, ""] }); } }} />
                      <button className="icon-btn" onClick={() => setQ(q.id, { options: q.options.filter((_, xi) => xi !== oi) })} aria-label="Remove option"><IX size={15} /></button>
                    </div>
                  ))}
                  <div className="opt-actions">
                    <button className="text-btn" onClick={() => setQ(q.id, { options: [...q.options, ""] })}><IPlus size={15} /><span>Add option</span></button>
                    <span className="opt-dictate">
                      <MicButton label="Dictate options"
                        onText={(t) => setQ(q.id, { options: [...q.options.filter((x) => x.trim()), ...t.split(/\s*(?:,|\bor\b|\band\b)\s*/i).filter(Boolean).map((x) => x.charAt(0).toUpperCase() + x.slice(1))] })} />
                      <small>Dictate options</small>
                    </span>
                  </div>
                </div>
              )}

              <div className="qblock-foot">
                <Switch checked={q.required} onChange={(v) => setQ(q.id, { required: v })} label="Required" />
                {(q.type === "short" || q.type === "long") && (
                  <label className="inline-select">
                    <span>Autofill</span>
                    <select className="select" value={q.autofill || ""} onChange={(e) => setQ(q.id, { autofill: e.target.value, autofillTouched: true })}>
                      {AUTOFILL.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
                    </select>
                  </label>
                )}
              </div>
            </li>
          ))}
        </ol>

        <div className="add-bar">
          <span className="add-bar-label">Add</span>
          {TYPES.map((t) => (
            <button key={t.id} className="chip" onClick={() => addQs([newQuestion("", t.id)])}><IPlus size={14} /><span>{t.label}</span></button>
          ))}
        </div>

        <section className="panel">
          <div className="panel-head">
            <h2>Add several questions at once</h2>
            <p>Paste a list, or dictate it. End each question with a question mark or say “next question” between them. Answer types are chosen for you and can be changed.</p>
          </div>
          <VoiceField multiline rows={4} value={bulk} onChange={setBulk}
            placeholder={"What's your full name?\nWhy do you want to join the team?\nAre you available on weekends?"} aria-label="Questions to add" />
          <div className="row-end">
            <button className="btn" disabled={!bulk.trim()} onClick={() => { addQs(splitQuestions(bulk)); setBulk(""); }}>
              <IPlus size={16} /><span>Add {splitQuestions(bulk).length || ""} question{splitQuestions(bulk).length === 1 ? "" : "s"}</span>
            </button>
          </div>
        </section>
      </main>

      {sharing && (
        <div className="dialog-backdrop" onClick={() => setSharing(false)}>
          <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="share-title" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-head">
              <h2 id="share-title">Share “{form.title}”</h2>
              <button className="icon-btn" onClick={() => setSharing(false)} aria-label="Close"><IX size={18} /></button>
            </div>
            <p className="muted">Anyone with this link can answer. They don't need an account or an app.</p>
            <div className="link-field">
              <input className="field" readOnly value={link} onFocus={(e) => e.target.select()} aria-label="Form link" />
              <CopyButton text={link} label="Copy link" className="btn btn-primary" />
            </div>
            <div className="share-grid">
              <a className="send-row" href={whatsappLink("", invite)} target="_blank" rel="noreferrer">
                <IChat size={20} /><span><strong>WhatsApp</strong><small>Send to a person or group</small></span>
              </a>
              <a className="send-row" href={`mailto:?subject=${encodeURIComponent(form.title)}&body=${encodeURIComponent(invite)}`}>
                <IMail size={20} /><span><strong>Email</strong><small>Send from your mail app</small></span>
              </a>
              <a className="send-row" href={link} target="_blank" rel="noreferrer">
                <IEye size={20} /><span><strong>Open form</strong><small>See exactly what applicants see</small></span>
              </a>
            </div>
            {!form.owner?.whatsapp && !form.owner?.email && (
              <p className="dialog-warn">Add a WhatsApp number or email under Delivery so applicants can send their answers straight to you.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
