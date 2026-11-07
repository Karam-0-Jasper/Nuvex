// What applicants see: one simple page, then the video interview if the form has one, then send.
import { useEffect, useRef, useState } from "react";
import { canListen, useDictation } from "./voice.js";
import { answersAsText, clearDraft, download, loadDraft, loadProfile, responseLink, saveDraft, saveProfile, uid } from "./store.js";
import Interview, { callApi } from "./Interview.jsx";
import { CopyButton, appendText, digits, useAutoGrow, whatsappLink } from "./ui.jsx";
import { IArrowRight, IChat, ICheck, IDoc, IDownload, IMail, IMic, IStop, IUpload, IX } from "./icons.jsx";
import { uploadFile } from "./upload.js";
import { UPLOADS } from "./config.js";

export const OTHER = "\u0000other";
const otherKey = (id) => id + "#other";
const isEmpty = (v) => v == null || v === "" || (Array.isArray(v) && v.length === 0);

/** Has this question been answered (an "Other" pick needs its text too)? */
function answered(q, answers) {
  const v = answers[q.id];
  if (isEmpty(v)) return false;
  const other = String(answers[otherKey(q.id)] || "").trim();
  if (v === OTHER) return !!other;
  if (Array.isArray(v) && v.includes(OTHER) && !other) return v.length > 1;
  if (q.type === "file") return !!v?.url;
  return true;
}

export function answerText(q, v, otherText = "") {
  if (isEmpty(v)) return "";
  const show = (x) => (x === OTHER ? `Other: ${otherText}`.trim() : x);
  if (q.type === "file") return v?.url ? `${v.name} — ${v.url}` : "";
  if (Array.isArray(v)) return v.map(show).join(", ");
  if (q.type === "rating") return `${v} / 5`;
  if (q.type === "date") {
    const d = new Date(v + "T12:00:00");
    return isNaN(d) ? String(v) : d.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
  }
  return String(show(v));
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

function FileAnswer({ q, value, set }) {
  const [state, setState] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef(null);
  const pick = async (file) => {
    if (!file) return;
    setError("");
    setState("uploading");
    try {
      set(await uploadFile(file));
      setState("");
    } catch (e) {
      setError(e.message);
      setState("");
    }
    if (inputRef.current) inputRef.current.value = "";
  };
  return (
    <div className="f-file">
      <input ref={inputRef} type="file" accept={UPLOADS.accept} hidden onChange={(e) => pick(e.target.files?.[0])} aria-label={q.text} />
      {value?.url ? (
        <div className="f-file-chip">
          <IDoc size={18} />
          <span className="f-file-name">{value.name}</span>
          <button type="button" className="icon-btn" onClick={() => set("")} aria-label="Remove file"><IX size={15} /></button>
        </div>
      ) : (
        <button type="button" className="btn" disabled={state === "uploading"} onClick={() => inputRef.current?.click()}>
          <IUpload size={16} /><span>{state === "uploading" ? "Uploading…" : "Add file"}</span>
        </button>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  );
}

function OtherInput({ q, other, setOther, onFocus }) {
  return (
    <input className="f-other-input" value={other || ""} placeholder="" aria-label={`${q.text} — other`}
      onFocus={onFocus} onChange={(e) => setOther(e.target.value)} />
  );
}

function Question({ q, options, value, set, other, setOther, missing }) {
  const toggle = (o) => set((prev) => ((prev || []).includes(o) ? prev.filter((x) => x !== o) : [...(prev || []), o]));
  return (
    <fieldset className={`f-card ${missing ? "is-missing" : ""}`}>
      <legend className="f-q">{q.text}{q.required && <span className="f-req" aria-label="required"> *</span>}</legend>
      {q.hint && <p className="f-hint">{q.hint}</p>}

      {(q.type === "short" || q.type === "long") && <TextAnswer q={q} value={value} onChange={set} />}

      {(q.type === "choice" || q.type === "yesno") && (
        <div className="f-opts">
          {(q.type === "yesno" ? ["Yes", "No"] : options).map((o) => (
            <label key={o} className="f-opt">
              <input type="radio" name={q.id} checked={value === o} onChange={() => set(o)} />
              <span>{o}</span>
            </label>
          ))}
          {q.type === "choice" && q.other && (
            <label className="f-opt">
              <input type="radio" name={q.id} checked={value === OTHER} onChange={() => set(OTHER)} />
              <span>Other:</span>
              <OtherInput q={q} other={other} setOther={setOther} onFocus={() => set(OTHER)} />
            </label>
          )}
        </div>
      )}

      {q.type === "multi" && (
        <div className="f-opts">
          {options.map((o) => (
            <label key={o} className="f-opt">
              <input type="checkbox" checked={(value || []).includes(o)} onChange={() => toggle(o)} />
              <span>{o}</span>
            </label>
          ))}
          {q.other && (
            <label className="f-opt">
              <input type="checkbox" checked={(value || []).includes(OTHER)} onChange={() => toggle(OTHER)} />
              <span>Other:</span>
              <OtherInput q={q} other={other} setOther={setOther}
                onFocus={() => set((prev) => ((prev || []).includes(OTHER) ? prev : [...(prev || []), OTHER]))} />
            </label>
          )}
        </div>
      )}

      {q.type === "dropdown" && (
        <>
          <select className="f-select" value={value || ""} onChange={(e) => set(e.target.value)} aria-label={q.text}>
            <option value="">Choose</option>
            {options.map((o) => <option key={o} value={o}>{o}</option>)}
            {q.other && <option value={OTHER}>Other</option>}
          </select>
          {value === OTHER && <input className="ans-line f-other-line" value={other || ""} placeholder="Please specify" onChange={(e) => setOther(e.target.value)} aria-label={`${q.text} — other`} />}
        </>
      )}

      {q.type === "file" && <FileAnswer q={q} value={value} set={set} />}

      {q.type === "rating" && (
        <div className="f-scale" role="radiogroup" aria-label={q.text}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button type="button" key={n} role="radio" aria-checked={value === n} className={value === n ? "is-on" : ""} onClick={() => set(n)}>{n}</button>
          ))}
        </div>
      )}

      {q.type === "date" && <input type="date" className="ans-line is-date" value={value || ""} aria-label={q.text} onChange={(e) => set(e.target.value)} />}

      {missing && <p className="error">This question is required.</p>}
    </fieldset>
  );
}

function shuffled(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Split the form into pages at each section, like Google Forms. */
function toPages(items) {
  const pages = [{ section: null, items: [] }];
  for (const it of items) {
    if (it.type === "section") pages.push({ section: it, items: [] });
    else pages[pages.length - 1].items.push(it);
  }
  return pages.filter((p, i) => p.items.length || (i === 0 && pages.length === 1));
}

export default function Fill({ form, preview = false, onExit }) {
  const qs = form.questions.filter((q) => q.type !== "section");
  const pages = toPages(form.questions);
  const [order] = useState(() => Object.fromEntries(qs.filter((q) => q.options?.length).map((q) => [q.id, q.shuffle ? shuffled(q.options) : q.options])));
  const [answers, setAnswers] = useState(() => {
    const profile = loadProfile();
    const a = { ...((!preview && loadDraft(form.id)) || {}) };
    for (const q of qs) if (q.autofill && isEmpty(a[q.id]) && profile[q.autofill]) a[q.id] = profile[q.autofill];
    return a;
  });
  const [page, setPage] = useState(0);
  const [missing, setMissing] = useState([]);
  const [stage, setStage] = useState("form"); // form → interview → sending → done
  const [response, setResponse] = useState(null);

  useEffect(() => { if (!preview && stage === "form") saveDraft(form.id, answers); }, [answers, preview, stage, form.id]);

  const setKey = (key) => (v) => setAnswers((prev) => ({ ...prev, [key]: typeof v === "function" ? v(prev[key]) : v }));
  const field = (key) => { const q = qs.find((x) => x.autofill === key); return q ? String(answers[q.id] || "").trim() : ""; };

  const base = () => ({
    v: 1, kind: "application", id: uid(), formId: form.id, title: form.title, at: Date.now(),
    from: field("name"), email: field("email"),
    answers: qs.map((q) => [q.text, answerText(q, answers[q.id], answers[otherKey(q.id)])]),
  });

  const checkPage = () => {
    const miss = pages[page].items.filter((q) => q.required && !answered(q, answers)).map((q) => q.id);
    setMissing(miss);
    if (miss.length) document.getElementById("q-" + miss[0])?.scrollIntoView({ behavior: "smooth", block: "center" });
    return !miss.length;
  };

  const submit = (e) => {
    e.preventDefault();
    if (!checkPage()) return;
    if (page < pages.length - 1) { setPage(page + 1); window.scrollTo(0, 0); return; }
    if (!preview) {
      const p = { ...loadProfile() };
      for (const q of qs) if (q.autofill && !isEmpty(answers[q.id])) p[q.autofill] = String(answers[q.id]).trim();
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

  const current = pages[page];
  const last = page === pages.length - 1;
  return (
    <div className="f-page">
      {PreviewBar}
      <main className="f-main">
        <form onSubmit={submit} noValidate>
          <header className="f-card f-head">
            {owner && <p className="eyebrow">{owner}</p>}
            <h1 className="f-title">{form.title}</h1>
            {page === 0 && form.intro && <p className="f-intro">{form.intro}</p>}
            <p className="f-note"><span className="f-req">*</span> Required{canListen ? <> · Tap <IMic size={13} /> to speak an answer instead of typing</> : null}</p>
          </header>

          {current.section && (
            <div className="f-section">
              <p className="f-section-tag">Section {page + 1} of {pages.length}</p>
              <div className="f-card">
                <h2 className="f-section-title">{current.section.text || "Untitled section"}</h2>
                {current.section.hint && <p className="f-intro">{current.section.hint}</p>}
              </div>
            </div>
          )}

          {current.items.map((q) => (
            <div id={"q-" + q.id} key={q.id}>
              <Question q={q} options={order[q.id] || q.options || []} value={answers[q.id]} set={setKey(q.id)}
                other={answers[otherKey(q.id)]} setOther={setKey(otherKey(q.id))} missing={missing.includes(q.id)} />
            </div>
          ))}

          <div className="f-actions">
            {page > 0 && <button type="button" className="btn btn-lg" onClick={() => { setMissing([]); setPage(page - 1); window.scrollTo(0, 0); }}>Back</button>}
            <button type="submit" className="btn btn-primary btn-lg">
              <span>{!last ? "Next" : form.interview?.enabled ? "Next: video interview" : "Submit"}</span><IArrowRight size={18} />
            </button>
            {pages.length > 1 && (
              <span className="f-progress" aria-label={`Page ${page + 1} of ${pages.length}`}>
                <span className="f-progress-bar"><span style={{ width: `${((page + 1) / pages.length) * 100}%` }} /></span>
                Page {page + 1} of {pages.length}
              </span>
            )}
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
