// The screen people use to answer a form: talk, tap, or reuse what they said before.
import { useEffect, useRef, useState } from "react";
import {
  canListen, canSpeak, isoDate, matchOption, matchRating, matchYesNo, norm,
  parseSpokenDate, speak, splitTrailingNext, stopSpeaking, tidySpoken, useDictation, voiceCommand,
} from "./voice.js";
import {
  answersAsText, clearDraft, download, findPastAnswer, loadDraft, loadProfile,
  rememberAnswers, responseLink, saveDraft, saveProfile, uid,
} from "./store.js";
import { CopyButton, MicIcon, appendText, digits, whatsappLink } from "./ui.jsx";

const isAnswered = (v) => v != null && v !== "" && !(Array.isArray(v) && v.length === 0);

function answerText(q, v) {
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

  const [step, setStep] = useState(-1); // -1 = welcome, 0..total-1 = questions, total = review
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

  useEffect(() => { if (!preview && !sent) saveDraft(form.id, answers); }, [answers, preview, sent, form.id]);
  useEffect(() => () => stopSpeaking(), []);

  // ---- Talking back ----

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

  // ---- Moving around ----

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

  // ---- Understanding answers ----

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

  // ---- Sending ----

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
    if (wasHandsFree) speak("Done! Now choose how to send your answers.");
    else stopSpeaking();
  }

  if (sent) return <Sent form={form} response={sent} preview={preview} onExit={onExit} />;

  const autoCount = qs.filter((q) => q.autofill && profile[q.autofill]).length;
  const answeredCount = qs.filter((q) => isAnswered(answers[q.id])).length;

  // ---- Welcome ----
  if (step < 0) {
    const mins = Math.max(1, Math.round(total * 0.4));
    return (
      <div className="fill">
        {preview && <div className="preview-bar">Preview — this is what people see. <button className="link" onClick={onExit}>Back to editing</button></div>}
        <div className="card welcome">
          <div className="big-icon"><MicIcon size={34} /></div>
          <h1>{form.title}</h1>
          {form.owner?.name && <p className="muted">from {form.owner.name}</p>}
          {form.intro && <p className="intro">{form.intro}</p>}
          <p className="muted">{total} questions · about {mins} min{mins > 1 ? "s" : ""}{answeredCount ? ` · ${answeredCount} already filled in` : ""}</p>
          {autoCount > 0 && <p className="good">✨ {autoCount} answer{autoCount > 1 ? "s" : ""} filled in from your saved info.</p>}

          <div className="ways">
            {canListen && (
              <button className="way primary" onClick={startHandsFree}>
                <span className="way-icon">🎧</span>
                <span><b>Talk the whole way</b><small>I read each question, you answer out loud. No hands.</small></span>
              </button>
            )}
            <button className="way" onClick={() => goTo(0)}>
              <span className="way-icon">👆</span>
              <span><b>Tap & speak</b><small>One question at a time. Mic on every answer.</small></span>
            </button>
          </div>
          {!canListen && <p className="muted small-text">Voice answers work in Chrome, Edge and Safari. You can still tap and type here.</p>}
        </div>
      </div>
    );
  }

  // ---- Review ----
  if (step >= total) {
    return (
      <div className="fill">
        <Toolbar {...{ step, total, handsFree, readAloud, setReadAloud, startHandsFree, stopHandsFree, dict, heard }} />
        <div className="card">
          <h2>Check your answers</h2>
          <p className="muted">Tap any answer to change it.</p>
          <ol className="review">
            {qs.map((q, i) => (
              <li key={q.id} onClick={() => goTo(i)} className={q.required && !isAnswered(answers[q.id]) ? "missing" : ""}>
                <span className="rq">{q.text}{q.required && " *"}</span>
                <span className="ra">{answerText(q, answers[q.id]) || <em>No answer</em>}</span>
              </li>
            ))}
          </ol>
          {!preview && (
            <label className="check">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
              Remember my info and answers on this phone, so the next form is faster
            </label>
          )}
          <div className="row">
            <button className="btn" onClick={back}>← Back</button>
            <button className="btn primary grow" onClick={submit}>Submit answers</button>
          </div>
        </div>
      </div>
    );
  }

  // ---- One question ----
  const q = qs[step];
  const value = answers[q.id];
  const isText = q.type === "short" || q.type === "long";
  const past = isText && !q.autofill ? findPastAnswer(q.text) : null;
  const fromProfile = q.autofill && profile[q.autofill] && value === profile[q.autofill];
  const micOn = dict.listening && !handsFree;

  return (
    <div className="fill">
      {preview && <div className="preview-bar">Preview <button className="link" onClick={onExit}>Back to editing</button></div>}
      <Toolbar {...{ step, total, handsFree, readAloud, setReadAloud, startHandsFree, stopHandsFree, dict, heard }} />

      <div className={`card question ${missing === q.id ? "shake" : ""}`} key={q.id}>
        <p className="qnum">Question {step + 1} of {total}{q.required && <span className="req"> · required</span>}</p>
        <h2 className="qtext">{q.text}</h2>
        {q.hint && <p className="muted">{q.hint}</p>}

        {isText && (
          <>
            {q.type === "long" ? (
              <textarea className="answer" rows={5} value={value || ""} placeholder="Tap the mic and talk, or type here…" onChange={(e) => setAnswer(q.id, e.target.value)} />
            ) : (
              <input className="answer" value={value || ""} placeholder="Tap the mic and say it, or type…"
                type={q.autofill === "email" ? "email" : q.autofill === "phone" ? "tel" : "text"}
                autoComplete={{ name: "name", email: "email", phone: "tel", location: "address-level2", link: "url" }[q.autofill] || "off"}
                onChange={(e) => setAnswer(q.id, e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && next()} />
            )}
            {fromProfile && <p className="good small-text">✨ Filled in from your saved info</p>}
            {micOn && <p className="interim live">{dict.interim || "Listening… speak now"}</p>}
            {canListen && !handsFree && (
              <button className={`mic big ${micOn ? "on" : ""}`} onClick={() => (micOn ? dict.stop() : dict.start(true))}>
                <MicIcon size={26} /> <span>{micOn ? "Done talking" : value ? "Add more by voice" : "Tap to speak your answer"}</span>
              </button>
            )}
            {past && past.answer !== value && (
              <div className="suggest">
                <p className="small-text muted">You answered a similar question before:</p>
                <p className="past">“{past.answer.length > 160 ? past.answer.slice(0, 160) + "…" : past.answer}”</p>
                <button className="btn small" onClick={() => setAnswer(q.id, past.answer)}>Use this answer</button>
              </div>
            )}
            {q.starters?.length > 0 && !value && (
              <div className="chips">
                <span className="small-text muted">Not sure how to start? Tap one:</span>
                {q.starters.map((s) => (
                  <button key={s} className="chip" onClick={() => setAnswer(q.id, s.replace(/…$/, "").trimEnd() + " ")}>{s}</button>
                ))}
              </div>
            )}
            {value && <button className="link small-text" onClick={() => setAnswer(q.id, "")}>Clear answer</button>}
          </>
        )}

        {q.type === "choice" && (
          <div className="options">
            {q.options.map((o, i) => (
              <button key={o} className={`option ${value === o ? "picked" : ""}`} onClick={() => { setAnswer(q.id, o); setMissing(null); }}>
                <span className="letter">{String.fromCharCode(65 + i)}</span>{o}
              </button>
            ))}
          </div>
        )}

        {q.type === "multi" && (
          <div className="options">
            {q.options.map((o, i) => {
              const on = (value || []).includes(o);
              return (
                <button key={o} className={`option ${on ? "picked" : ""}`}
                  onClick={() => setAnswer(q.id, (prev = []) => (on ? (prev || []).filter((x) => x !== o) : [...(prev || []), o]))}>
                  <span className="letter">{on ? "✓" : String.fromCharCode(65 + i)}</span>{o}
                </button>
              );
            })}
            <p className="small-text muted">Pick as many as you like.</p>
          </div>
        )}

        {q.type === "yesno" && (
          <div className="options two">
            {["Yes", "No"].map((o) => (
              <button key={o} className={`option big-choice ${value === o ? "picked" : ""}`} onClick={() => { setAnswer(q.id, o); setMissing(null); }}>
                {o === "Yes" ? "👍" : "👎"} {o}
              </button>
            ))}
          </div>
        )}

        {q.type === "rating" && (
          <div className="rating">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} className={`star ${value >= n ? "on" : ""}`} onClick={() => { setAnswer(q.id, n); setMissing(null); }} aria-label={`${n} of 5`}>★</button>
            ))}
          </div>
        )}

        {q.type === "date" && (
          <div className="date-pick">
            <input type="date" className="answer" value={value || ""} onChange={(e) => setAnswer(q.id, e.target.value)} />
            <div className="chips">
              {[["Today", 0], ["Tomorrow", 1], ["In a week", 7], ["In 2 weeks", 14], ["In a month", 30]].map(([label, days]) => {
                const d = new Date();
                d.setDate(d.getDate() + days);
                return <button key={label} className="chip" onClick={() => setAnswer(q.id, isoDate(d))}>{label}</button>;
              })}
            </div>
          </div>
        )}

        {!isText && canListen && !handsFree && (
          <button className={`mic ${micOn ? "on" : ""}`} onClick={() => (micOn ? dict.stop() : dict.start(true))}>
            <MicIcon /> <span>{micOn ? (dict.interim || "Listening…") : "Or just say it"}</span>
          </button>
        )}
        {dict.error && <p className="err small-text">{dict.error}</p>}
        {missing === q.id && <p className="err">This question needs an answer.</p>}
      </div>

      <div className="nav">
        <button className="btn" onClick={back} disabled={step === 0}>← Back</button>
        <button className="btn primary grow" onClick={next}>
          {step === total - 1 ? "Review answers →" : isAnswered(value) || q.required ? "Next →" : "Skip →"}
        </button>
      </div>
    </div>
  );
}

function Toolbar({ step, total, handsFree, readAloud, setReadAloud, startHandsFree, stopHandsFree, dict, heard }) {
  const pct = Math.round((Math.min(step, total) / total) * 100);
  return (
    <>
      <div className="progress"><div style={{ width: pct + "%" }} /></div>
      <div className="toolbar">
        {canSpeak && !handsFree && (
          <button className={`pill ${readAloud ? "on" : ""}`} onClick={() => setReadAloud(!readAloud)}>🔊 Read to me</button>
        )}
        {canListen && (
          <button className={`pill ${handsFree ? "on" : ""}`} onClick={handsFree ? stopHandsFree : startHandsFree}>
            🎧 {handsFree ? "Hands-free on" : "Hands-free"}
          </button>
        )}
      </div>
      {handsFree && (
        <div className="handsfree">
          <span className={`dot ${dict.listening ? "live" : ""}`} />
          <div>
            <b>{dict.listening ? "Listening…" : "Speaking…"}</b>
            <p className="small-text">{dict.interim || (heard ? `Heard: “${heard}”` : "Say “next”, “back”, “repeat”, “clear” or “stop”.")}</p>
          </div>
        </div>
      )}
    </>
  );
}

function Sent({ form, response, preview, onExit }) {
  const link = responseLink(response);
  const text = answersAsText(`Answers to: ${form.title}${response.from ? ` — from ${response.from}` : ""}`, response.answers);
  const message = `${text}\n\nOpen these answers in Nuvex Forms:\n${link}`;
  const wa = digits(form.owner?.whatsapp);
  const email = form.owner?.email;
  return (
    <div className="fill">
      <div className="card welcome">
        <div className="big-icon done">✓</div>
        <h1>{preview ? "Preview finished" : "Almost done!"}</h1>
        <p>{preview ? "This is where people send their answers to you." : `Send your answers to ${form.owner?.name || "the form owner"}:`}</p>
        <div className="send">
          {wa && <a className="btn primary wa" href={whatsappLink(wa, message)} target="_blank" rel="noreferrer">Send on WhatsApp</a>}
          {email && (
            <a className="btn primary" href={`mailto:${email}?subject=${encodeURIComponent("Answers: " + form.title)}&body=${encodeURIComponent(message)}`}>Send by email</a>
          )}
          <CopyButton text={message} label={wa || email ? "Copy answers" : "Copy answers to send"} className={`btn ${wa || email ? "" : "primary"}`} />
          {navigator.share && <button className="btn" onClick={() => navigator.share({ title: form.title, text: message }).catch(() => {})}>Share another way</button>}
        </div>
        <p className="muted small-text">Keep a copy for yourself:</p>
        <button className="link" onClick={() => download(`${form.title} - my answers.txt`, text)}>Download my answers</button>
        {preview && <div className="row"><button className="btn grow" onClick={onExit}>Back to editing</button></div>}
      </div>
    </div>
  );
}
