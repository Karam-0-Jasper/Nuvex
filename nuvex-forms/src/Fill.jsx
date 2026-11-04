// The screen applicants see. One question at a time; answer by typing, recording, tapping, or reusing.
import { useEffect, useRef, useState } from "react";
import {
  canListen, canSpeak, isoDate, matchOption, matchRating, matchYesNo, norm,
  parseSpokenDate, speak, splitTrailingNext, stopSpeaking, tidySpoken, useDictation, voiceCommand,
} from "./voice.js";
import {
  answersAsText, clearDraft, download, findPastAnswer, loadDraft, loadProfile,
  rememberAnswers, responseLink, saveDraft, saveProfile, uid,
} from "./store.js";
import { CopyButton, appendText, clock, digits, useAutoGrow, useElapsed, whatsappLink } from "./ui.jsx";
import {
  IArrowLeft, IArrowRight, ICheck, IChat, IDownload, IHeadset, IMail, IMic, IPen, IReturn, IShare, ISpeaker, IStop,
} from "./icons.jsx";

const isAnswered = (v) => v != null && v !== "" && !(Array.isArray(v) && v.length === 0);
const pad2 = (n) => String(n).padStart(2, "0");

export function answerText(q, v) {
  if (!isAnswered(v)) return "";
  if (Array.isArray(v)) return v.join(", ");
  if (q.type === "rating") return `${v} / 5`;
  if (q.type === "date") {
    const d = new Date(v + "T12:00:00");
    return isNaN(d) ? String(v) : d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "long", year: "numeric" });
  }
  return String(v);
}

/** Which options were mentioned: "photos and video editing" → both. */
function matchMany(spoken, options) {
  const s = ` ${norm(spoken)} `;
  const found = options.filter((o) => {
    const n = norm(o);
    if (s.includes(` ${n} `)) return true;
    const words = n.split(" ").filter((w) => w.length > 3);
    return words.length > 0 && words.some((w) => s.includes(` ${w} `));
  });
  if (found.length) return found;
  const i = matchOption(spoken, options);
  return i >= 0 ? [options[i]] : [];
}

const isTyping = (el) => el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);

export default function Fill({ form, preview = false, onExit }) {
  const qs = form.questions;
  const total = qs.length;
  const [profile] = useState(loadProfile);

  const [answers, setAnswersState] = useState(() => {
    const a = { ...((!preview && loadDraft(form.id)) || {}) };
    for (const q of qs) if (q.autofill && !isAnswered(a[q.id]) && profile[q.autofill]) a[q.id] = profile[q.autofill];
    return a;
  });
  const answersRef = useRef(answers);
  const setAnswer = (id, v) => {
    const prev = answersRef.current;
    const next = { ...prev, [id]: typeof v === "function" ? v(prev[id]) : v };
    answersRef.current = next;
    setAnswersState(next);
  };

  const [step, setStep] = useState(-1); // -1 = cover, 0..total-1 = questions, total = review
  const stepRef = useRef(step);
  const goTo = (i) => { stepRef.current = i; setStep(i); };

  const [handsFree, setHandsFree] = useState(false);
  const handsRef = useRef(false);
  handsRef.current = handsFree;
  const [readAloud, setReadAloud] = useState(false);
  const [missing, setMissing] = useState(null);
  const [heard, setHeard] = useState("");
  const [remember, setRemember] = useState(true);
  const [sent, setSent] = useState(null);

  const dict = useDictation((t) => onSpeech(t));
  const recording = dict.listening && !handsFree;
  const elapsed = useElapsed(recording);
  const areaRef = useAutoGrow(step >= 0 && step < total ? answers[qs[step].id] : "");

  useEffect(() => { if (!preview && !sent) saveDraft(form.id, answers); }, [answers, preview, sent, form.id]);
  useEffect(() => () => stopSpeaking(), []);

  // ---- Reading questions aloud ----

  const promptFor = (i) => {
    if (i < 0) return `${form.title}. ${form.intro || ""}`;
    if (i >= total) return "That's every question. Say submit to send your answers, or say go back to change something.";
    const q = qs[i];
    const cur = answersRef.current[q.id];
    const end = (t) => (/[.?!]$/.test(t.trim()) ? t.trim() : t.trim() + ".");
    let s = `Question ${i + 1} of ${total}. ${end(q.text)}`;
    if (q.hint) s += ` ${end(q.hint)}`;
    if (q.type === "choice" || q.type === "multi") s += ` The options are: ${q.options.join(", ")}.`;
    if (isAnswered(cur)) return `${s} Your answer is: ${answerText(q, cur)}. Say next to keep it, or say clear to change it.`;
    if (q.type === "yesno") s += " Say yes or no.";
    if (q.type === "rating") s += " Say a number from 1 to 5.";
    if (q.type === "date") s += " Say a date, like March 5th, or next Monday.";
    if (q.type === "multi") s += " Say all that apply, then say next.";
    if (q.type === "short" || q.type === "long") s += " Say your answer, then say next.";
    return s;
  };

  const listenAgain = () => { if (handsRef.current) dict.start(true); };
  const sayThen = (text, after = listenAgain) => { dict.stop(true); speak(text, after); };

  useEffect(() => {
    if (sent) return;
    if (handsFree) sayThen(promptFor(step));
    else {
      dict.stop(true);
      if (readAloud && step >= 0) speak(promptFor(step));
      else stopSpeaking();
    }
    setHeard("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, handsFree, readAloud]);

  // ---- Navigation ----

  const next = () => {
    const i = stepRef.current;
    if (i >= 0 && i < total) {
      const q = qs[i];
      if (q.required && !isAnswered(answersRef.current[q.id])) {
        setMissing(q.id);
        if (handsRef.current) sayThen("This one needs an answer before we move on.");
        return;
      }
    }
    setMissing(null);
    goTo(Math.min(i + 1, total));
  };
  const back = () => { setMissing(null); goTo(Math.max(stepRef.current - 1, 0)); };

  const startHandsFree = () => {
    if (stepRef.current < 0) goTo(0);
    setHandsFree(true);
  };
  const stopHandsFree = () => {
    setHandsFree(false);
    stopSpeaking();
    dict.stop(true);
  };

  // ---- Understanding spoken answers ----

  function onSpeech(text) {
    setHeard(text);
    const i = stepRef.current;
    const cmd = voiceCommand(text);
    if (cmd === "stop") return stopHandsFree();
    if (cmd === "next") return next();
    if (cmd === "back") return back();
    if (cmd === "repeat") return handsRef.current ? sayThen(promptFor(i)) : speak(promptFor(i));
    if (cmd === "submit") return i >= total ? submit() : next();
    if (i < 0 || i >= total) return;

    const q = qs[i];
    if (cmd === "clear") {
      setAnswer(q.id, q.type === "multi" ? [] : "");
      if (handsRef.current) sayThen("Cleared. Go ahead.");
      return;
    }
    const confirm = (label) => {
      setMissing(null);
      if (handsRef.current) sayThen(`Got it: ${label}.`, next);
      else dict.stop();
    };
    const retry = (msg) => { if (handsRef.current) sayThen(msg); };

    if (q.type === "choice") {
      const idx = matchOption(text, q.options);
      if (idx >= 0) { setAnswer(q.id, q.options[idx]); confirm(q.options[idx]); }
      else retry(`Sorry, which one? ${q.options.join(", ")}.`);
    } else if (q.type === "multi") {
      const picked = matchMany(text, q.options);
      if (picked.length) {
        setAnswer(q.id, (prev = []) => [...new Set([...(prev || []), ...picked])]);
        if (handsRef.current) sayThen(`Added ${picked.join(" and ")}. Say more, or say next.`);
      } else retry(`I didn't catch that. The options are ${q.options.join(", ")}.`);
    } else if (q.type === "yesno") {
      const v = matchYesNo(text);
      if (v) { setAnswer(q.id, v); confirm(v); } else retry("Please say yes or no.");
    } else if (q.type === "rating") {
      const n = matchRating(text, 5);
      if (n) { setAnswer(q.id, n); confirm(`${n} out of 5`); } else retry("Say a number from 1 to 5.");
    } else if (q.type === "date") {
      const d = parseSpokenDate(text);
      if (d) { setAnswer(q.id, d); confirm(answerText(q, d)); } else retry("Try saying a date, like March 5th, or next Monday.");
    } else {
      const { text: words, next: goNext } = splitTrailingNext(text);
      if (words) {
        const tidy = tidySpoken(words, q.autofill);
        setAnswer(q.id, (prev) => (tidy !== words ? (prev || "") + tidy : appendText(prev, words)));
      }
      setMissing(null);
      if (goNext) next();
    }
  }

  // ---- Submitting ----

  function submit() {
    const a = answersRef.current;
    const firstMissing = qs.findIndex((q) => q.required && !isAnswered(a[q.id]));
    if (firstMissing >= 0) {
      setMissing(qs[firstMissing].id);
      goTo(firstMissing);
      return;
    }
    const wasHandsFree = handsRef.current;
    setHandsFree(false);
    dict.stop(true);
    const nameQ = qs.find((q) => q.autofill === "name");
    const response = {
      v: 1,
      id: uid(),
      formId: form.id,
      title: form.title,
      at: Date.now(),
      from: nameQ ? a[nameQ.id] || "" : "",
      answers: qs.map((q) => [q.text, answerText(q, a[q.id])]),
    };
    if (!preview) {
      if (remember) {
        const p = { ...loadProfile() };
        for (const q of qs) if (q.autofill && isAnswered(a[q.id])) p[q.autofill] = String(a[q.id]);
        saveProfile(p);
        rememberAnswers(qs.filter((q) => !q.autofill && (q.type === "long" || q.type === "short")).map((q) => ({ question: q.text, answer: a[q.id] })));
      }
      clearDraft(form.id);
    }
    setSent(response);
    if (wasHandsFree) speak("Done. Choose how to send your answers.");
    else stopSpeaking();
  }

  // ---- Keyboard ----

  useEffect(() => {
    const onKey = (e) => {
      if (sent || e.altKey) return;
      const i = stepRef.current;
      const typing = isTyping(e.target);
      if (e.key === "Enter") {
        // Enter on an answer control (a choice, a quick date) means "continue"; on any other button, let it click.
        if (e.target.tagName === "BUTTON" && !e.target.closest(".question .choices, .question .scale, .question .quick-dates")) return;
        if (i < 0) { e.preventDefault(); goTo(0); return; }
        if (i >= total) { if (e.metaKey || e.ctrlKey) { e.preventDefault(); submit(); } return; }
        const q = qs[i];
        if (e.target.tagName === "TEXTAREA" && !(e.metaKey || e.ctrlKey)) return;
        if (q && !(e.shiftKey)) { e.preventDefault(); next(); }
        return;
      }
      if (typing || e.metaKey || e.ctrlKey || i < 0 || i >= total) return;
      const q = qs[i];
      const k = e.key.toLowerCase();
      if (q.type === "choice" || q.type === "multi") {
        const idx = k.charCodeAt(0) - 97;
        if (k.length === 1 && idx >= 0 && idx < q.options.length) {
          const o = q.options[idx];
          if (q.type === "choice") setAnswer(q.id, o);
          else setAnswer(q.id, (prev = []) => ((prev || []).includes(o) ? prev.filter((x) => x !== o) : [...(prev || []), o]));
          setMissing(null);
        }
      } else if (q.type === "yesno" && (k === "y" || k === "n")) {
        setAnswer(q.id, k === "y" ? "Yes" : "No");
        setMissing(null);
      } else if (q.type === "rating" && /^[1-5]$/.test(k)) {
        setAnswer(q.id, Number(k));
        setMissing(null);
      }
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  });

  const owner = form.owner?.name || "";

  if (sent) return <Sent form={form} response={sent} preview={preview} onExit={onExit} />;

  const autoCount = qs.filter((q) => q.autofill && profile[q.autofill]).length;
  const answeredCount = qs.filter((q) => isAnswered(answers[q.id])).length;
  const mins = Math.max(1, Math.round(total * 0.4));

  const Top = (
    <header className="fill-top">
      <div className="fill-top-inner">
        <span className="fill-owner">{owner || form.title}</span>
        {step >= 0 && (
          <div className="fill-tools">
            {canSpeak && !handsFree && (
              <button className={`tool ${readAloud ? "is-on" : ""}`} onClick={() => setReadAloud(!readAloud)} aria-pressed={readAloud}>
                <ISpeaker size={16} /><span>Read aloud</span>
              </button>
            )}
            {canListen && (
              <button className={`tool ${handsFree ? "is-on" : ""}`} onClick={handsFree ? stopHandsFree : startHandsFree} aria-pressed={handsFree}>
                <IHeadset size={16} /><span>Voice mode</span>
              </button>
            )}
          </div>
        )}
      </div>
      {step >= 0 && <div className="progress" aria-hidden="true"><span style={{ width: `${(Math.min(step, total) / total) * 100}%` }} /></div>}
      {preview && (
        <div className="preview-note">
          <span>Preview — nothing is saved or sent.</span>
          <button className="text-btn" onClick={onExit}>Close preview</button>
        </div>
      )}
    </header>
  );

  const VoiceBar = handsFree && (
    <div className="voice-bar" role="status">
      <span className={`rec-dot ${dict.listening ? "is-live" : ""}`} />
      <div className="voice-bar-text">
        <strong>{dict.listening ? "Listening" : "Reading question"}</strong>
        <span>{dict.interim || (heard ? `“${heard}”` : "Say “next”, “back”, “repeat” or “stop”")}</span>
      </div>
      <button className="text-btn" onClick={stopHandsFree}>Exit</button>
    </div>
  );

  // ---- Cover ----
  if (step < 0) {
    return (
      <div className="fill-page">
        {Top}
        <main className="fill-main">
          <section className="cover">
            {owner && <p className="eyebrow">{owner}</p>}
            <h1 className="cover-title">{form.title}</h1>
            {form.intro && <p className="cover-intro">{form.intro}</p>}
            <dl className="cover-meta">
              <div><dt>Questions</dt><dd>{total}</dd></div>
              <div><dt>Time</dt><dd>About {mins} min</dd></div>
              <div><dt>Account</dt><dd>Not needed</dd></div>
            </dl>
            {(autoCount > 0 || answeredCount > 0) && (
              <p className="cover-note">
                {answeredCount > autoCount ? `You have ${answeredCount} answers saved from last time.` : `${autoCount} answers will be filled in from your saved details.`}
              </p>
            )}
            <div className="cover-actions">
              <button className="btn btn-primary btn-lg" onClick={() => goTo(0)}>
                <span>Start</span><IArrowRight size={18} />
              </button>
              {canListen && (
                <button className="btn btn-lg" onClick={startHandsFree}>
                  <IHeadset size={18} /><span>Answer by voice</span>
                </button>
              )}
            </div>
            <p className="fine">
              {canListen
                ? "In voice mode each question is read aloud and you answer out loud. You can switch back to typing at any time."
                : "Press Enter to begin. Voice answers are available in Chrome, Edge and Safari."}
            </p>
          </section>
        </main>
      </div>
    );
  }

  // ---- Review ----
  if (step >= total) {
    const missingCount = qs.filter((q) => q.required && !isAnswered(answers[q.id])).length;
    return (
      <div className="fill-page">
        {Top}
        <main className="fill-main">
          <section className="review">
            <p className="eyebrow">Review</p>
            <h1 className="cover-title">Check your answers</h1>
            <p className="cover-intro">Select any answer to change it. Nothing is sent until you submit.</p>
            <ol className="review-list">
              {qs.map((q, i) => {
                const empty = !isAnswered(answers[q.id]);
                return (
                  <li key={q.id}>
                    <button className={`review-row ${q.required && empty ? "is-missing" : ""}`} onClick={() => goTo(i)}>
                      <span className="review-num">{pad2(i + 1)}</span>
                      <span className="review-body">
                        <span className="review-q">{q.text}</span>
                        <span className={`review-a ${empty ? "is-empty" : ""}`}>{empty ? (q.required ? "Required — not answered" : "Skipped") : answerText(q, answers[q.id])}</span>
                      </span>
                      <IPen size={16} className="review-edit" />
                    </button>
                  </li>
                );
              })}
            </ol>
            {!preview && (
              <label className="check">
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                <span>Save my details and longer answers on this device, so the next application is faster.</span>
              </label>
            )}
          </section>
        </main>
        <footer className="fill-nav">
          <div className="fill-nav-inner">
            <button className="btn" onClick={back}><IArrowLeft size={16} /><span>Back</span></button>
            <span className="fill-count">{missingCount ? `${missingCount} required left` : "Ready to submit"}</span>
            <button className="btn btn-primary" onClick={submit}><span>Submit</span><IArrowRight size={16} /></button>
          </div>
        </footer>
        {VoiceBar}
      </div>
    );
  }

  // ---- Question ----
  const q = qs[step];
  const value = answers[q.id];
  const isText = q.type === "short" || q.type === "long";
  const past = isText && !q.autofill ? findPastAnswer(q.text) : null;
  const fromProfile = q.autofill && profile[q.autofill] && value === profile[q.autofill];
  const optKey = (i) => String.fromCharCode(65 + i);

  const Record = canListen && !handsFree && (
    <button className={`record ${recording ? "is-live" : ""}`} onClick={() => (recording ? dict.stop() : dict.start(true))}>
      {recording ? <><span className="rec-dot is-live" /><span>Stop</span><span className="record-time">{clock(elapsed)}</span></> : <><IMic size={17} /><span>{isText ? (value ? "Record more" : "Record answer") : "Say it instead"}</span></>}
    </button>
  );

  return (
    <div className="fill-page">
      {Top}
      <main className="fill-main">
        <section className={`question ${missing === q.id ? "is-missing" : ""}`} key={q.id}>
          <p className="q-meta">
            <span className="q-num">{pad2(step + 1)}</span>
            <span className="q-of">of {pad2(total)}</span>
            {q.required && <span className="q-req">Required</span>}
          </p>
          <h1 className="q-title">{q.text}</h1>
          {q.hint && <p className="q-hint">{q.hint}</p>}

          {isText && (
            <div className="answer">
              {q.type === "long" ? (
                <textarea ref={areaRef} className="answer-area" rows={6} value={value || ""} aria-label={q.text}
                  placeholder="Type your answer, or record it" onChange={(e) => setAnswer(q.id, e.target.value)} />
              ) : (
                <input className="answer-line" value={value || ""} aria-label={q.text}
                  placeholder="Type your answer"
                  type={q.autofill === "email" ? "email" : q.autofill === "phone" ? "tel" : "text"}
                  autoComplete={{ name: "name", email: "email", phone: "tel", location: "address-level2", link: "url" }[q.autofill] || "off"}
                  onChange={(e) => setAnswer(q.id, e.target.value)} />
              )}
              {recording && <p className="live-text">{dict.interim || "Listening…"}</p>}
              {fromProfile && <p className="answer-note">Filled in from your saved details.</p>}

              <div className="answer-tools">
                {Record}
                {value && <button className="text-btn" onClick={() => setAnswer(q.id, "")}>Clear</button>}
                <span className="kbd-hint">
                  {q.type === "long" ? <>Press <kbd>Ctrl</kbd> <kbd>Enter</kbd></> : <>Press <kbd>Enter</kbd></>}
                </span>
              </div>

              {past && past.answer !== value && (
                <div className="reuse">
                  <p className="reuse-label">From an earlier application</p>
                  <p className="reuse-text">{past.answer.length > 220 ? past.answer.slice(0, 220) + "…" : past.answer}</p>
                  <button className="text-btn" onClick={() => setAnswer(q.id, past.answer)}>Use this answer</button>
                </div>
              )}
              {q.starters?.length > 0 && !value && (
                <div className="starters">
                  <span className="starters-label">Start with</span>
                  {q.starters.map((s) => (
                    <button key={s} className="starter" onClick={() => setAnswer(q.id, s.replace(/…$/, "").trimEnd() + " ")}>{s}</button>
                  ))}
                </div>
              )}
            </div>
          )}

          {(q.type === "choice" || q.type === "multi") && (
            <div className="choices" role={q.type === "choice" ? "radiogroup" : "group"} aria-label={q.text}>
              {q.type === "multi" && <p className="choices-note">Select all that apply</p>}
              {q.options.map((o, i) => {
                const on = q.type === "choice" ? value === o : (value || []).includes(o);
                return (
                  <button key={o} className={`choice ${on ? "is-on" : ""}`} role={q.type === "choice" ? "radio" : "checkbox"} aria-checked={on}
                    onClick={() => {
                      if (q.type === "choice") setAnswer(q.id, o);
                      else setAnswer(q.id, (prev = []) => (on ? (prev || []).filter((x) => x !== o) : [...(prev || []), o]));
                      setMissing(null);
                    }}>
                    <kbd className="choice-key">{optKey(i)}</kbd>
                    <span className="choice-label">{o}</span>
                    {on && <ICheck size={18} className="choice-check" />}
                  </button>
                );
              })}
            </div>
          )}

          {q.type === "yesno" && (
            <div className="choices is-row" role="radiogroup" aria-label={q.text}>
              {["Yes", "No"].map((o) => (
                <button key={o} className={`choice ${value === o ? "is-on" : ""}`} role="radio" aria-checked={value === o}
                  onClick={() => { setAnswer(q.id, o); setMissing(null); }}>
                  <kbd className="choice-key">{o[0]}</kbd>
                  <span className="choice-label">{o}</span>
                  {value === o && <ICheck size={18} className="choice-check" />}
                </button>
              ))}
            </div>
          )}

          {q.type === "rating" && (
            <div className="scale">
              <div className="scale-row" role="radiogroup" aria-label={q.text}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} className={`scale-step ${value === n ? "is-on" : ""}`} role="radio" aria-checked={value === n}
                    onClick={() => { setAnswer(q.id, n); setMissing(null); }}>{n}</button>
                ))}
              </div>
              <div className="scale-ends"><span>Not at all</span><span>Completely</span></div>
            </div>
          )}

          {q.type === "date" && (
            <div className="date-answer">
              <input type="date" className="answer-line is-date" value={value || ""} aria-label={q.text} onChange={(e) => setAnswer(q.id, e.target.value)} />
              <div className="quick-dates">
                {[["Today", 0], ["Tomorrow", 1], ["In one week", 7], ["In two weeks", 14], ["In one month", 30]].map(([label, days]) => {
                  const d = new Date();
                  d.setDate(d.getDate() + days);
                  const iso = isoDate(d);
                  return <button key={label} className={`starter ${value === iso ? "is-on" : ""}`} onClick={() => setAnswer(q.id, iso)}>{label}</button>;
                })}
              </div>
            </div>
          )}

          {!isText && Record && (
            <div className="answer-tools">
              {Record}
              {recording && <span className="live-inline">{dict.interim || "Listening…"}</span>}
            </div>
          )}
          {dict.error && <p className="error">{dict.error}</p>}
          {missing === q.id && <p className="error" role="alert">Please answer this question to continue.</p>}
        </section>
      </main>

      <footer className="fill-nav">
        <div className="fill-nav-inner">
          <button className="btn" onClick={() => (step === 0 ? goTo(-1) : back())}><IArrowLeft size={16} /><span>Back</span></button>
          <span className="fill-count">{step + 1} / {total}</span>
          <button className="btn btn-primary" onClick={next}>
            <span>{step === total - 1 ? "Review" : isAnswered(value) || q.required ? "Continue" : "Skip"}</span>
            {isText && q.type === "short" ? <IReturn size={16} /> : <IArrowRight size={16} />}
          </button>
        </div>
      </footer>
      {VoiceBar}
    </div>
  );
}

function Sent({ form, response, preview, onExit }) {
  const link = responseLink(response);
  const text = answersAsText(`${form.title}${response.from ? ` — ${response.from}` : ""}`, response.answers);
  const message = `${text}\n\nView these answers in Nuvex Forms:\n${link}`;
  const wa = digits(form.owner?.whatsapp);
  const email = form.owner?.email;
  const to = form.owner?.name || "the organiser";
  return (
    <div className="fill-page">
      <header className="fill-top"><div className="fill-top-inner"><span className="fill-owner">{form.owner?.name || form.title}</span></div></header>
      <main className="fill-main">
        <section className="cover">
          <span className="done-mark"><ICheck size={22} /></span>
          <p className="eyebrow">{preview ? "Preview complete" : "Last step"}</p>
          <h1 className="cover-title">Send your answers to {to}</h1>
          <p className="cover-intro">
            {preview ? "Applicants choose one of these options to deliver their answers to you." : "Your answers are ready. Choose how to deliver them — they arrive formatted and easy to read."}
          </p>
          <div className="send-list">
            {wa && (
              <a className="send-row" href={whatsappLink(wa, message)} target="_blank" rel="noreferrer">
                <IChat size={20} /><span><strong>WhatsApp</strong><small>Opens a message to {form.owner?.whatsapp}</small></span><IArrowRight size={16} />
              </a>
            )}
            {email && (
              <a className="send-row" href={`mailto:${email}?subject=${encodeURIComponent(form.title)}&body=${encodeURIComponent(message)}`}>
                <IMail size={20} /><span><strong>Email</strong><small>Opens a message to {email}</small></span><IArrowRight size={16} />
              </a>
            )}
            {navigator.share && (
              <button className="send-row" onClick={() => navigator.share({ title: form.title, text: message }).catch(() => {})}>
                <IShare size={20} /><span><strong>Another app</strong><small>Use your phone's share sheet</small></span><IArrowRight size={16} />
              </button>
            )}
          </div>
          <div className="cover-actions">
            <CopyButton text={message} label="Copy answers" />
            <button className="btn" onClick={() => download(`${form.title} - answers.txt`, text)}><IDownload size={16} /><span>Keep a copy</span></button>
            {preview && <button className="btn btn-primary" onClick={onExit}><span>Back to editor</span></button>}
          </div>
        </section>
      </main>
    </div>
  );
}
