// Where you make a form. You can type questions, speak them, or start from a template.
import { useState } from "react";
import { TYPES } from "./templates.js";
import { formLink, guessAutofill, saveForm, uid, PROFILE_FIELDS } from "./store.js";
import { CopyButton, MicButton, VoiceField, appendText, whatsappLink } from "./ui.jsx";

const AUTOFILL = [{ key: "", label: "Don't fill in" }, ...PROFILE_FIELDS.map((f) => ({ key: f.key, label: f.label }))];

export function newQuestion(text = "", type = "long") {
  return { id: uid(), type, text, options: [], required: false, autofill: guessAutofill(text) };
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

export default function Builder({ initial, onDone, onPreview }) {
  const [form, setForm] = useState(initial);
  const [bulk, setBulk] = useState("");
  const [shared, setShared] = useState(false);
  const [error, setError] = useState("");

  const update = (patch) => setForm((f) => ({ ...f, ...patch }));
  const updateOwner = (patch) => setForm((f) => ({ ...f, owner: { ...f.owner, ...patch } }));
  const setQ = (id, patch) => setForm((f) => ({ ...f, questions: f.questions.map((q) => (q.id === id ? { ...q, ...patch } : q)) }));
  const removeQ = (id) => setForm((f) => ({ ...f, questions: f.questions.filter((q) => q.id !== id) }));
  const moveQ = (i, d) => setForm((f) => {
    const qs = [...f.questions];
    const j = i + d;
    if (j < 0 || j >= qs.length) return f;
    [qs[i], qs[j]] = [qs[j], qs[i]];
    return { ...f, questions: qs };
  });
  const addQs = (list) => setForm((f) => ({ ...f, questions: [...f.questions, ...list] }));

  const check = () => {
    if (!form.title.trim()) return "Give your form a name.";
    if (!form.questions.length) return "Add at least one question.";
    const bad = form.questions.findIndex((q) => !q.text.trim());
    if (bad >= 0) return `Question ${bad + 1} is empty.`;
    const noOpts = form.questions.findIndex((q) => (q.type === "choice" || q.type === "multi") && q.options.filter(Boolean).length < 2);
    if (noOpts >= 0) return `Question ${noOpts + 1} needs at least 2 options.`;
    return "";
  };
  const clean = () => ({
    ...form,
    title: form.title.trim(),
    questions: form.questions.map((q) => ({ ...q, text: q.text.trim(), options: (q.options || []).map((o) => o.trim()).filter(Boolean) })),
  });
  const save = (then) => {
    const e = check();
    setError(e);
    if (e) return;
    const f = clean();
    saveForm(f);
    setForm(f);
    then(f);
  };

  const link = shared ? formLink(form) : "";

  return (
    <div className="builder">
      <div className="card">
        <label className="lbl" htmlFor="title">Form name</label>
        <VoiceField id="title" value={form.title} onChange={(v) => update({ title: v })} placeholder="e.g. Video editor interview" />
        <label className="lbl" htmlFor="intro">Welcome message (optional)</label>
        <VoiceField id="intro" multiline value={form.intro} onChange={(v) => update({ intro: v })} placeholder="A short note people see before they start" />
      </div>

      <div className="card">
        <h3>Where should answers come to you?</h3>
        <p className="muted small-text">When someone finishes, they get a button to send their answers straight to you.</p>
        <div className="grid2">
          <div>
            <label className="lbl" htmlFor="oname">Your name or company</label>
            <input id="oname" value={form.owner?.name || ""} onChange={(e) => updateOwner({ name: e.target.value })} placeholder="Nuvex" />
          </div>
          <div>
            <label className="lbl" htmlFor="owa">WhatsApp number</label>
            <input id="owa" type="tel" value={form.owner?.whatsapp || ""} onChange={(e) => updateOwner({ whatsapp: e.target.value })} placeholder="+231 77 000 0000" />
          </div>
          <div>
            <label className="lbl" htmlFor="oemail">Email</label>
            <input id="oemail" type="email" value={form.owner?.email || ""} onChange={(e) => updateOwner({ email: e.target.value })} placeholder="you@example.com" />
          </div>
        </div>
      </div>

      <h3 className="section">Questions ({form.questions.length})</h3>
      {form.questions.map((q, i) => (
        <div className="card qcard" key={q.id}>
          <div className="qhead">
            <span className="qbadge">{i + 1}</span>
            <select value={q.type} onChange={(e) => setQ(q.id, { type: e.target.value })} aria-label="Answer type">
              {TYPES.map((t) => <option key={t.id} value={t.id}>{t.icon} {t.label}</option>)}
            </select>
            <span className="grow" />
            <button className="icon-btn" onClick={() => moveQ(i, -1)} disabled={i === 0} aria-label="Move up">↑</button>
            <button className="icon-btn" onClick={() => moveQ(i, 1)} disabled={i === form.questions.length - 1} aria-label="Move down">↓</button>
            <button className="icon-btn danger" onClick={() => removeQ(q.id)} aria-label="Delete question">✕</button>
          </div>
          <VoiceField
            value={q.text}
            onChange={(v) => setQ(q.id, { text: v, ...(q.autofillTouched ? {} : { autofill: guessAutofill(v) }) })}
            placeholder="Type or say the question"
          />
          {(q.type === "choice" || q.type === "multi") && (
            <>
              <label className="lbl">Options — one per line</label>
              <div className="voice-field multi">
                <textarea rows={Math.max(3, q.options.length + 1)} value={q.options.join("\n")}
                  onChange={(e) => setQ(q.id, { options: e.target.value.split("\n") })} placeholder={"Option 1\nOption 2"} />
                <MicButton small onText={(t) => setQ(q.id, { options: [...q.options.filter(Boolean), ...t.split(/\s*(?:,|\bor\b|\band\b)\s*/i).filter(Boolean).map((o) => o.charAt(0).toUpperCase() + o.slice(1))] })} />
              </div>
            </>
          )}
          <input className="hint-input" value={q.hint || ""} onChange={(e) => setQ(q.id, { hint: e.target.value })} placeholder="Helper text (optional)" />
          <div className="qfoot">
            <label className="check inline">
              <input type="checkbox" checked={!!q.required} onChange={(e) => setQ(q.id, { required: e.target.checked })} /> Required
            </label>
            {(q.type === "short" || q.type === "long") && (
              <label className="inline small-text">
                Auto-fill from saved info:{" "}
                <select value={q.autofill || ""} onChange={(e) => setQ(q.id, { autofill: e.target.value, autofillTouched: true })}>
                  {AUTOFILL.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
                </select>
              </label>
            )}
          </div>
        </div>
      ))}

      <div className="row wrap">
        <button className="btn" onClick={() => addQs([newQuestion()])}>+ Add a question</button>
      </div>

      <div className="card bulk">
        <h3>🎙️ Say all your questions at once</h3>
        <p className="muted small-text">Talk or paste them in. Say “next question” between each one (or put a question mark at the end). We'll split them up and pick the answer type.</p>
        <div className="voice-field multi">
          <textarea rows={4} value={bulk} onChange={(e) => setBulk(e.target.value)} placeholder="What's your name? Why do you want this job? Are you available on weekends?" />
          <MicButton small onText={(t) => setBulk((b) => appendText(b, t))} />
        </div>
        <button className="btn" disabled={!bulk.trim()} onClick={() => { addQs(splitQuestions(bulk)); setBulk(""); }}>Turn into questions</button>
      </div>

      {error && <p className="err">{error}</p>}
      <div className="sticky-actions">
        <button className="btn" onClick={() => save(onPreview)}>Preview</button>
        <button className="btn primary grow" onClick={() => save(() => setShared(true))}>Save & get link</button>
      </div>

      {shared && (
        <div className="modal" onClick={() => setShared(false)}>
          <div className="card share" onClick={(e) => e.stopPropagation()}>
            <h2>Your form is ready 🎉</h2>
            <p className="muted">Send this link to anyone. They can answer by talking — no app or account needed.</p>
            <input className="link-box" readOnly value={link} onFocus={(e) => e.target.select()} />
            <div className="send">
              <CopyButton text={link} label="Copy link" className="btn primary" />
              <a className="btn wa" href={whatsappLink("", `${form.title}\nAnswer here (you can just talk): ${link}`)} target="_blank" rel="noreferrer">Share on WhatsApp</a>
              <a className="btn" href={link} target="_blank" rel="noreferrer">Open the form</a>
            </div>
            <div className="row"><button className="btn grow" onClick={() => onDone(form)}>Done</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
