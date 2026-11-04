// What applicants see: one simple page, then the video interview if the form has one, then send.
import { useEffect, useRef, useState } from "react";
import { canListen, useDictation } from "./voice.js";
import { answersAsText, clearDraft, download, loadDraft, loadProfile, responseLink, saveDraft, saveProfile, uid } from "./store.js";
import Interview, { callApi } from "./Interview.jsx";
import { CopyButton, appendText, digits, useAutoGrow, whatsappLink } from "./ui.jsx";
import { IArrowRight, IChat, ICheck, IDownload, IMail, IMic, IStop } from "./icons.jsx";

const isAnswered = (v) => v != null && v !== "" && !(Array.isArray(v) && v.length === 0);

export function answerText(q, v) {
  if (!isAnswered(v)) return "";
  if (Array.isArray(v)) return v.join(", ");
  if (q.type === "rating") return `${v} / 5`;
  if (q.type === "date") {
    const d = new Date(v + "T12:00:00");
    return isNaN(d) ? String(v) : d.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
  }
  return String(v);
}

function TextAnswer({ q, value, onChange }) {
  const d = useDictation((t) => onChange((prev) => appendText(prev, t)));
  const ref = useAutoGrow(value);
  const Tag = q.type === "long" ? "textarea" : "input";
  return (
    <div className="ans-text">
      <Tag
        ref={ref}
        className={q.type === "long" ? "ans-area" : "ans-line"}
        rows={q.type === "long" ? 3 : undefined}
        value={value || ""}
        placeholder="Your answer"
        aria-label={q.text}
        type={q.type === "long" ? undefined : q.autofill === "email" ? "email" : q.autofill === "phone" ? "tel" : "text"}
        autoComplete={{ name: "name", email: "email", phone: "tel", location: "address-level2", link: "url" }[q.autofill] || "off"}
        onChange={(e) => onChange(e.target.value)}
      />
      {canListen && (
        <button type="button" className={`ans-mic ${d.listening ? "is-live" : ""}`} onClick={() => (d.listening ? d.stop() : d.start(true))}
          aria-label={d.listening ? "Stop" : "Speak your answer"} title={d.listening ? "Stop" : "Speak your answer"}>
          {d.listening ? <IStop size={13} /> : <IMic size={17} />}
        </button>
      )}
      {d.listening && <p className="ans-live">{d.interim || "Listening…"}</p>}
    </div>
  );
}

function Question({ q, value, set, missing }) {
  const pick = (o) => set(o);
  const toggle = (o) => set((prev) => ((prev || []).includes(o) ? prev.filter((x) => x !== o) : [...(prev || []), o]));
  return (
    <fieldset className={`f-card ${missing ? "is-missing" : ""}`}>
      <legend className="f-q">{q.text}{q.required && <span className="f-req" aria-label="required"> *</span>}</legend>
      {q.hint && <p className="f-hint">{q.hint}</p>}

      {(q.type === "short" || q.type === "long") && <TextAnswer q={q} value={value} onChange={set} />}

      {(q.type === "choice" || q.type === "yesno") && (
        <div className="f-opts">
          {(q.type === "yesno" ? ["Yes", "No"] : q.options).map((o) => (
            <label key={o} className="f-opt">
              <input type="radio" name={q.id} checked={value === o} onChange={() => pick(o)} />
              <span>{o}</span>
            </label>
          ))}
        </div>
      )}

      {q.type === "multi" && (
        <div className="f-opts">
          {q.options.map((o) => (
            <label key={o} className="f-opt">
              <input type="checkbox" checked={(value || []).includes(o)} onChange={() => toggle(o)} />
              <span>{o}</span>
            </label>
          ))}
        </div>
      )}

      {q.type === "rating" && (
        <div className="f-scale" role="radiogroup" aria-label={q.text}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button type="button" key={n} role="radio" aria-checked={value === n} className={value === n ? "is-on" : ""} onClick={() => pick(n)}>{n}</button>
          ))}
        </div>
      )}

      {q.type === "date" && <input type="date" className="ans-line is-date" value={value || ""} aria-label={q.text} onChange={(e) => set(e.target.value)} />}

      {missing && <p className="error">This question is required.</p>}
    </fieldset>
  );
}

export default function Fill({ form, preview = false, onExit }) {
  const qs = form.questions;
  const [answers, setAnswers] = useState(() => {
    const profile = loadProfile();
    const a = { ...((!preview && loadDraft(form.id)) || {}) };
    for (const q of qs) if (q.autofill && !isAnswered(a[q.id]) && profile[q.autofill]) a[q.id] = profile[q.autofill];
    return a;
  });
  const [missing, setMissing] = useState([]);
  const [stage, setStage] = useState("form"); // form → interview → sending → done
  const [response, setResponse] = useState(null);
  const topRef = useRef(null);

  useEffect(() => { if (!preview && stage === "form") saveDraft(form.id, answers); }, [answers, preview, stage, form.id]);

  const setAnswer = (id) => (v) => setAnswers((prev) => ({ ...prev, [id]: typeof v === "function" ? v(prev[id]) : v }));
  const field = (key) => { const q = qs.find((x) => x.autofill === key); return q ? String(answers[q.id] || "").trim() : ""; };

  const base = () => ({
    v: 1, kind: "application", id: uid(), formId: form.id, title: form.title, at: Date.now(),
    from: field("name"), email: field("email"),
    answers: qs.map((q) => [q.text, answerText(q, answers[q.id])]),
  });

  const submit = (e) => {
    e.preventDefault();
    const miss = qs.filter((q) => q.required && !isAnswered(answers[q.id])).map((q) => q.id);
    setMissing(miss);
    if (miss.length) {
      document.getElementById("q-" + miss[0])?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (!preview) {
      const p = { ...loadProfile() };
      for (const q of qs) if (q.autofill && isAnswered(answers[q.id])) p[q.autofill] = String(answers[q.id]).trim();
      saveProfile(p);
      clearDraft(form.id);
    }
    if (form.interview?.enabled) { setStage("interview"); window.scrollTo(0, 0); return; }
    setResponse(base());
    setStage("done");
    window.scrollTo(0, 0);
  };

  const interviewDone = async (interview) => {
    setStage("sending");
    const payload = { ...base(), interview };
    try {
      const { seal } = await callApi({ action: "seal", payload }, 8000);
      payload.seal = seal;
    } catch { /* shown to the hiring team as "not sealed" */ }
    setResponse(payload);
    setStage("done");
  };

  const owner = form.owner?.name || "";
  const PreviewBar = preview && (
    <div className="preview-note">
      <span>Preview — nothing is saved or sent.</span>
      <button className="text-btn" onClick={onExit}>Close preview</button>
    </div>
  );

  if (stage === "interview") {
    return <Interview form={form} name={field("name")} preview={preview} onExit={onExit} onDone={interviewDone} />;
  }
  if (stage === "sending") {
    return <div className="f-page">{PreviewBar}<main className="f-main"><p className="muted f-center">Saving your interview…</p></main></div>;
  }
  if (stage === "done") return <Sent form={form} response={response} preview={preview} onExit={onExit} />;

  return (
    <div className="f-page" ref={topRef}>
      {PreviewBar}
      <main className="f-main">
        <form onSubmit={submit} noValidate>
          <header className="f-card f-head">
            {owner && <p className="eyebrow">{owner}</p>}
            <h1 className="f-title">{form.title}</h1>
            {form.intro && <p className="f-intro">{form.intro}</p>}
            <p className="f-note"><span className="f-req">*</span> Required{canListen ? <> · Tap <IMic size={13} /> to speak an answer instead of typing</> : null}</p>
          </header>

          {qs.map((q) => (
            <div id={"q-" + q.id} key={q.id}>
              <Question q={q} value={answers[q.id]} set={setAnswer(q.id)} missing={missing.includes(q.id)} />
            </div>
          ))}

          <div className="f-actions">
            <button type="submit" className="btn btn-primary btn-lg">
              <span>{form.interview?.enabled ? "Next: video interview" : "Submit"}</span><IArrowRight size={18} />
            </button>
            {missing.length > 0 && <span className="error">Please answer the required questions.</span>}
          </div>
        </form>
      </main>
      <footer className="f-foot">Made with <a href="#/">Nuvex Forms</a></footer>
    </div>
  );
}

export function Sent({ form, response, preview, onExit }) {
  const link = responseLink(response);
  const text = answersAsText(`${form.title}${response.from ? ` — ${response.from}` : ""}`, [
    ...response.answers,
    ...((response.interview?.turns || []).map((t) => [`Interview${t.follow ? " follow-up" : ""}: ${t.q}`, t.a])),
  ]);
  const message = `${text}\n\nOpen in Nuvex Forms:\n${link}`;
  const wa = digits(form.owner?.whatsapp);
  const email = form.owner?.email;
  const to = form.owner?.name || "the organiser";
  return (
    <div className="f-page">
      {preview && (
        <div className="preview-note"><span>Preview — nothing is saved or sent.</span><button className="text-btn" onClick={onExit}>Close preview</button></div>
      )}
      <main className="f-main">
        <div className="f-card f-head">
          <span className="done-mark"><ICheck size={22} /></span>
          <h1 className="f-title">One last step</h1>
          <p className="f-intro">Send your {response.interview ? "application and interview" : "application"} to {to}.</p>
          <div className="send-list">
            {wa && (
              <a className="send-row" href={whatsappLink(wa, message)} target="_blank" rel="noreferrer">
                <IChat size={20} /><span><strong>Send on WhatsApp</strong><small>{form.owner.whatsapp}</small></span><IArrowRight size={16} />
              </a>
            )}
            {email && (
              <a className="send-row" href={`mailto:${email}?subject=${encodeURIComponent(form.title)}&body=${encodeURIComponent(message)}`}>
                <IMail size={20} /><span><strong>Send by email</strong><small>{email}</small></span><IArrowRight size={16} />
              </a>
            )}
          </div>
          <div className="cover-actions">
            <CopyButton text={message} label={wa || email ? "Copy" : "Copy and send"} className={wa || email ? "btn" : "btn btn-primary"} />
            <button className="btn" onClick={() => download(`${form.title} - my answers.txt`, text)}><IDownload size={16} /><span>Keep a copy</span></button>
          </div>
        </div>
      </main>
    </div>
  );
}
