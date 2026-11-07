// The form editor: Questions, Interview and Responses — like Google Forms. Saves automatically.
import { useEffect, useRef, useState } from "react";
import { HAS_OPTIONS, TYPES } from "./templates.js";
import { uploadsReady } from "./upload.js";
import { formLink, guessAutofill, loadInbox, saveForm, uid } from "./store.js";
import FormResponses from "./Responses.jsx";
import { CopyButton, Switch, useAutoGrow, whatsappLink } from "./ui.jsx";
import { IArrowDown, IArrowLeft, IArrowUp, IChat, IDuplicate, IEye, IMail, IPlus, ISection, IShuffle, ITrash, IX } from "./icons.jsx";

export function newQuestion(text = "", type = "short") {
  const q = { id: uid(), type, text, options: [], required: false, autofill: guessAutofill(text) };
  if (HAS_OPTIONS.includes(type)) q.options = ["Option 1"];
  return q;
}
const newSection = () => ({ id: uid(), type: "section", text: "", hint: "" });
const newInterviewQuestion = () => ({ id: uid(), text: "", expect: "" });

function problems(form) {
  if (!form.title.trim()) return "Give your form a title.";
  const qs = form.questions.filter((q) => q.type !== "section");
  if (!qs.length) return "Add at least one question.";
  const bad = qs.findIndex((q) => !q.text.trim());
  if (bad >= 0) return `Question ${bad + 1} is empty.`;
  const noOpts = qs.findIndex((q) => HAS_OPTIONS.includes(q.type) && q.options.filter((o) => o.trim()).length + (q.other ? 1 : 0) < 2);
  if (noOpts >= 0) return `Question ${noOpts + 1} needs at least two options.`;
  if (form.interview?.enabled && !form.interview.questions?.some((q) => q.text.trim())) return "Add at least one interview question, or turn the interview off.";
  return "";
}

const clean = (form) => ({
  ...form,
  title: form.title.trim(),
  questions: form.questions.map((q) => ({ ...q, text: q.text.trim(), options: (q.options || []).map((o) => o.trim()).filter(Boolean) })),
});

function AutoText({ value, onChange, className, placeholder, label }) {
  const ref = useAutoGrow(value);
  return <textarea ref={ref} rows={1} className={className} value={value || ""} placeholder={placeholder} aria-label={label} onChange={(e) => onChange(e.target.value)} />;
}

export default function Builder({ initial, initialTab, onBack, onPreview }) {
  const [form, setForm] = useState(initial);
  const [tab, setTab] = useState(["questions", "interview", "responses"].includes(initialTab) ? initialTab : "questions");
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState("");
  const firstRun = useRef(true);
  const responseCount = loadInbox().filter((r) => r.formId === form.id).length;

  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    const t = setTimeout(() => saveForm(form), 300);
    return () => clearTimeout(t);
  }, [form]);

  const update = (patch) => setForm((f) => ({ ...f, ...patch }));
  const setQ = (id, patch) => setForm((f) => ({ ...f, questions: f.questions.map((q) => (q.id === id ? { ...q, ...patch } : q)) }));
  const duplicateQ = (i) => setForm((f) => {
    const qs = [...f.questions];
    qs.splice(i + 1, 0, { ...qs[i], id: uid(), options: [...(qs[i].options || [])] });
    return { ...f, questions: qs };
  });
  const removeQ = (id) => setForm((f) => ({ ...f, questions: f.questions.filter((q) => q.id !== id) }));
  const moveQ = (i, d) => setForm((f) => {
    const qs = [...f.questions];
    const j = i + d;
    if (j < 0 || j >= qs.length) return f;
    [qs[i], qs[j]] = [qs[j], qs[i]];
    return { ...f, questions: qs };
  });

  const iv = form.interview || { enabled: false, seconds: 120, questions: [] };
  const setIv = (patch) => update({ interview: { ...iv, ...patch } });
  const setIvQ = (id, patch) => setIv({ questions: iv.questions.map((q) => (q.id === id ? { ...q, ...patch } : q)) });

  const check = () => {
    const e = problems(form);
    setError(e);
    if (e) { setTab(e.includes("interview") ? "interview" : "questions"); return false; }
    const f = clean(form);
    saveForm(f);
    setForm(f);
    return f;
  };

  const link = sharing ? formLink(clean(form)) : "";
  const invite = `${form.title}\n\nApply here:\n${link}`;

  return (
    <div className="editor-page">
      <header className="editor-bar">
        <div className="editor-bar-inner">
          <button className="icon-btn" onClick={onBack} aria-label="Back to forms" title="Back to forms"><IArrowLeft size={18} /></button>
          <span className="editor-name">{form.title || "Untitled form"}</span>
          <span className="grow" />
          <button className="btn" onClick={() => { const f = check(); if (f) onPreview(f); }}><IEye size={16} /><span className="hide-sm">Preview</span></button>
          <button className="btn btn-primary" onClick={() => { if (check()) setSharing(true); }}>Send</button>
        </div>
        <nav className="tabs" aria-label="Form sections">
          {[["questions", "Questions"], ["interview", "Interview"], ["responses", `Responses${responseCount ? ` (${responseCount})` : ""}`]].map(([id, label]) => (
            <button key={id} className={tab === id ? "is-active" : ""} onClick={() => setTab(id)}>{label}</button>
          ))}
        </nav>
      </header>

      <main className="editor">
        {error && <p className="banner-error" role="alert">{error}</p>}

        {tab === "questions" && (
          <>
            <section className="e-card e-head">
              <AutoText className="e-title" value={form.title} onChange={(v) => update({ title: v })} placeholder="Untitled form" label="Form title" />
              <AutoText className="e-desc" value={form.intro} onChange={(v) => update({ intro: v })} placeholder="Form description" label="Form description" />
            </section>

            {form.questions.map((q, i) => {
              const foot = (
                <div className="e-foot">
                  <button className="icon-btn" onClick={() => moveQ(i, -1)} disabled={i === 0} aria-label="Move up" title="Move up"><IArrowUp size={16} /></button>
                  <button className="icon-btn" onClick={() => moveQ(i, 1)} disabled={i === form.questions.length - 1} aria-label="Move down" title="Move down"><IArrowDown size={16} /></button>
                  {q.type !== "section" && <button className="icon-btn" onClick={() => duplicateQ(i)} aria-label="Duplicate" title="Duplicate"><IDuplicate size={16} /></button>}
                  <button className="icon-btn is-danger" onClick={() => removeQ(q.id)} aria-label={q.type === "section" ? "Delete section" : "Delete question"} title="Delete"><ITrash size={16} /></button>
                  {q.type !== "section" && (
                    <>
                      {HAS_OPTIONS.includes(q.type) && (
                        <button className={`icon-btn ${q.shuffle ? "is-on" : ""}`} aria-pressed={!!q.shuffle} onClick={() => setQ(q.id, { shuffle: !q.shuffle })}
                          aria-label="Shuffle option order" title={q.shuffle ? "Options are shuffled for each applicant" : "Shuffle option order"}><IShuffle size={16} /></button>
                      )}
                      <span className="e-divider" />
                      <Switch checked={q.required} onChange={(v) => setQ(q.id, { required: v })} label="Required" />
                    </>
                  )}
                </div>
              );

              if (q.type === "section") {
                const n = form.questions.slice(0, i + 1).filter((x) => x.type === "section").length + 1;
                const total = form.questions.filter((x) => x.type === "section").length + 1;
                return (
                  <div className="e-section" key={q.id}>
                    <p className="e-section-tag">Section {n} of {total}</p>
                    <section className="e-card e-head">
                      <AutoText className="e-title is-section" value={q.text} placeholder="Untitled section" label={`Section ${n} title`} onChange={(v) => setQ(q.id, { text: v })} />
                      <AutoText className="e-desc" value={q.hint} placeholder="Description (optional)" label={`Section ${n} description`} onChange={(v) => setQ(q.id, { hint: v })} />
                      {foot}
                    </section>
                  </div>
                );
              }

              const mark = (oi) => (q.type === "dropdown" ? <span className="opt-num">{oi + 1}.</span> : <span className={`opt-mark ${q.type === "multi" ? "is-square" : ""}`} />);
              return (
                <section className="e-card" key={q.id}>
                  <div className="e-row">
                    <AutoText className="e-q" value={q.text} placeholder="Question" label={`Question ${i + 1}`}
                      onChange={(v) => setQ(q.id, { text: v, ...(q.autofillTouched ? {} : { autofill: guessAutofill(v) }) })} />
                    <select className="select is-type" value={q.type} aria-label="Question type"
                      onChange={(e) => {
                        const type = e.target.value;
                        setQ(q.id, { type, ...(HAS_OPTIONS.includes(type) && !q.options.filter(Boolean).length ? { options: ["Option 1"] } : {}) });
                      }}>
                      {TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                    </select>
                  </div>

                  {HAS_OPTIONS.includes(q.type) && (
                    <div className="e-opts">
                      {q.options.map((o, oi) => (
                        <div className="e-opt" key={oi}>
                          {mark(oi)}
                          <input className="e-opt-input" value={o} placeholder={`Option ${oi + 1}`} aria-label={`Option ${oi + 1}`}
                            onChange={(e) => setQ(q.id, { options: q.options.map((x, xi) => (xi === oi ? e.target.value : x)) })}
                            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); setQ(q.id, { options: [...q.options, ""] }); } }} />
                          <button className="icon-btn" onClick={() => setQ(q.id, { options: q.options.filter((_, xi) => xi !== oi) })} aria-label="Remove option"><IX size={15} /></button>
                        </div>
                      ))}
                      {q.other && (
                        <div className="e-opt">
                          {mark(q.options.length)}
                          <span className="e-opt-other">Other…</span>
                          <button className="icon-btn" onClick={() => setQ(q.id, { other: false })} aria-label="Remove Other"><IX size={15} /></button>
                        </div>
                      )}
                      <div className="e-add-opt">
                        {mark(q.options.length + (q.other ? 1 : 0))}
                        <button className="e-add-link" onClick={() => setQ(q.id, { options: [...q.options, ""] })}>Add option</button>
                        {!q.other && <><span className="muted">or</span><button className="e-add-link is-accent" onClick={() => setQ(q.id, { other: true })}>add "Other"</button></>}
                      </div>
                    </div>
                  )}
                  {q.type === "short" && <p className="e-sample">Short answer text</p>}
                  {q.type === "long" && <p className="e-sample">Long answer text</p>}
                  {q.type === "yesno" && <p className="e-sample">Yes / No</p>}
                  {q.type === "rating" && <p className="e-sample">1 · 2 · 3 · 4 · 5</p>}
                  {q.type === "date" && <p className="e-sample">Day, month, year</p>}
                  {q.type === "file" && (
                    <>
                      <p className="e-sample">Applicants upload one file — PDF, Word or image, up to 10 MB</p>
                      {!uploadsReady() && <p className="e-warn">File uploads aren't connected yet, so applicants will see a message instead of the upload button.</p>}
                    </>
                  )}
                  {foot}
                </section>
              );
            })}

            <div className="e-add-row">
              <button className="e-add" onClick={() => update({ questions: [...form.questions, newQuestion()] })}><IPlus size={18} /><span>Add question</span></button>
              <button className="e-add" onClick={() => update({ questions: [...form.questions, newSection()] })}><ISection size={18} /><span>Add section</span></button>
            </div>
          </>
        )}

        {tab === "interview" && (
          <>
            <section className="e-card e-head">
              <h2 className="e-h2">Video interview</h2>
              <p className="muted">After filling in the form, applicants answer these questions out loud on camera. The AI asks each one, follows up if something is missing, and scores the answer against what you say a good answer includes.</p>
              <div className="e-foot is-top">
                <Switch checked={iv.enabled} onChange={(v) => setIv({ enabled: v, questions: iv.questions?.length ? iv.questions : [newInterviewQuestion()] })} label="Add a video interview to this form" />
                {iv.enabled && (
                  <label className="inline-select">
                    <span>Time per answer</span>
                    <select className="select" value={iv.seconds || 120} onChange={(e) => setIv({ seconds: Number(e.target.value) })}>
                      {[60, 90, 120, 180, 300].map((s) => <option key={s} value={s}>{s < 120 ? `${s} seconds` : `${s / 60} minutes`}</option>)}
                    </select>
                  </label>
                )}
              </div>
            </section>

            {iv.enabled && (
              <>
                {iv.questions.map((q, i) => (
                  <section className="e-card" key={q.id}>
                    <div className="e-label-row">
                      <p className="e-label">Question {i + 1}</p>
                      <button className="icon-btn is-danger" onClick={() => setIv({ questions: iv.questions.filter((x) => x.id !== q.id) })} aria-label="Delete interview question" title="Delete"><ITrash size={16} /></button>
                    </div>
                    <AutoText className="e-q" value={q.text} placeholder="What should the AI ask?" label={`Interview question ${i + 1}`} onChange={(v) => setIvQ(q.id, { text: v })} />
                    <p className="e-label">A good answer includes</p>
                    <AutoText className="e-expect" value={q.expect} label="What a good answer includes"
                      placeholder="For example: a real project, what they did themselves, and the result." onChange={(v) => setIvQ(q.id, { expect: v })} />
                    <p className="e-private">Only you see this. Applicants never do.</p>
                  </section>
                ))}
                <button className="e-add" onClick={() => setIv({ questions: [...iv.questions, newInterviewQuestion()] })}><IPlus size={18} /><span>Add interview question</span></button>
              </>
            )}
          </>
        )}

        {tab === "responses" && <FormResponses formId={form.id} title={form.title} />}
      </main>

      {sharing && (
        <div className="dialog-backdrop" onClick={() => setSharing(false)}>
          <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="share-title" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-head">
              <h2 id="share-title">Send form</h2>
              <button className="icon-btn" onClick={() => setSharing(false)} aria-label="Close"><IX size={18} /></button>
            </div>
            <div className="link-field">
              <input className="field" readOnly value={link} onFocus={(e) => e.target.select()} aria-label="Form link" />
              <CopyButton text={link} label="Copy link" className="btn btn-primary" />
            </div>
            <div className="share-grid">
              <a className="send-row" href={whatsappLink("", invite)} target="_blank" rel="noreferrer"><IChat size={20} /><span><strong>Share on WhatsApp</strong></span></a>
              <a className="send-row" href={`mailto:?subject=${encodeURIComponent(form.title)}&body=${encodeURIComponent(invite)}`}><IMail size={20} /><span><strong>Share by email</strong></span></a>
            </div>
            <div className="dialog-section">
              <p className="e-label">Where should answers come to you?</p>
              <div className="grid-2 is-tight">
                <input className="field" type="tel" value={form.owner?.whatsapp || ""} placeholder="Your WhatsApp number"
                  onChange={(e) => update({ owner: { ...form.owner, whatsapp: e.target.value } })} aria-label="Your WhatsApp number" />
                <input className="field" type="email" value={form.owner?.email || ""} placeholder="Your email"
                  onChange={(e) => update({ owner: { ...form.owner, email: e.target.value } })} aria-label="Your email" />
              </div>
              <input className="field" value={form.owner?.name || ""} placeholder="Your name or company (shown on the form)"
                onChange={(e) => update({ owner: { ...form.owner, name: e.target.value } })} aria-label="Your name or company" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
