// Video interview that follows the form. The interviewer asks each question aloud, the applicant answers on camera
// against a timer, answers are transcribed, and the AI may ask one follow-up. Integrity checks run on-device.
import { useEffect, useRef, useState } from "react";
import { canListen, speak, stopSpeaking, useDictation } from "./voice.js";
import { getForm, updateInbox } from "./store.js";
import { countFaces, createMonitor, integrityFlags, loadFaceDetector } from "./proctor.js";
import { appendText, clock, useElapsed } from "./ui.jsx";
import { IArrowRight } from "./icons.jsx";
import { themeStyle } from "./templates.js";

const API = "/api/interview";
export async function callApi(body, ms = 15000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(API, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: ctl.signal });
    const j = await r.json().catch(() => null);
    if (!r.ok) throw new Error(j?.error || `Request failed (${r.status})`);
    return j;
  } finally {
    clearTimeout(t);
  }
}

const speakAsync = (text) => new Promise((res) => speak(text, res));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const countWords = (t) => (String(t).trim().match(/\S+/g) || []).length;
const pad2 = (n) => String(n).padStart(2, "0");
export const fmtDuration = (s) => (s < 60 ? `${s} seconds` : s % 60 === 0 ? `${s / 60} minute${s === 60 ? "" : "s"}` : `${Math.floor(s / 60)} min ${s % 60} s`);
const followSeconds = (secs) => Math.max(45, Math.round(secs * 0.6));
const attemptKey = (id) => "nf.attempt." + id;
const readAttempts = (id) => { try { return Number(localStorage.getItem(attemptKey(id)) || 0); } catch { return 0; } };

export default function Interview({ form, name = "", preview = false, onExit, onDone }) {
  const main = form.interview?.questions || [];
  const secs = form.interview?.seconds || 120;
  const owner = form.owner?.name || "";

  const [phase, setPhase] = useState("ready"); // ready → live
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const [attempt] = useState(() => (preview ? 1 : readAttempts(form.id) + 1));

  const streamRef = useRef(null);
  const videoRef = useRef(null);
  const detectorRef = useRef(undefined);
  const monitorRef = useRef(null);
  const [faceState, setFaceState] = useState("checking");

  const [stage, setStage] = useState("idle"); // greeting | speaking | answering | thinking | closing
  const [current, setCurrent] = useState(null);
  const currentRef = useRef(null);
  const [transcript, setTranscript] = useState("");
  const transcriptRef = useRef("");
  const [remaining, setRemaining] = useState(0);
  const [allowed, setAllowed] = useState(secs);
  const deadlineRef = useRef(0);
  const answerStartRef = useRef(0);
  const finishingRef = useRef(false);
  const turnsRef = useRef([]);
  const aliveRef = useRef(true);
  const elapsed = useElapsed(phase === "live");

  const dict = useDictation((t) => {
    transcriptRef.current = appendText(transcriptRef.current, t);
    setTranscript(transcriptRef.current);
  });

  const releaseDevices = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      stopSpeaking();
      monitorRef.current?.stop();
      releaseDevices();
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    };
  }, []);

  // Turn on the camera as soon as the ready screen opens.
  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia) { setError("This browser can't use a camera. Open the link in Chrome, Edge or Safari."); return; }
    let active = true;
    navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" }, audio: { echoCancellation: true, noiseSuppression: true } })
      .then((s) => {
        if (!active) { s.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = s;
        setError("");
        loadFaceDetector().then((d) => { detectorRef.current = d; });
      })
      .catch((e) => setError(e?.name === "NotAllowedError"
        ? "Camera and microphone are blocked. Allow both for this site in your browser settings, then reload."
        : "No camera or microphone was found."));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (videoRef.current && streamRef.current && videoRef.current.srcObject !== streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play?.().catch(() => {});
    }
  });

  useEffect(() => {
    const id = setInterval(() => {
      const det = detectorRef.current;
      if (det === undefined) return;
      if (det === null) { setFaceState("unavailable"); return; }
      const n = countFaces(det, videoRef.current);
      if (n == null) return;
      setFaceState(monitorRef.current ? monitorRef.current.sample(n) : n === 0 ? "none" : n > 1 ? "multiple" : "ok");
    }, 600);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (phase !== "live") return;
    const onUnload = (e) => { e.preventDefault(); e.returnValue = ""; };
    addEventListener("beforeunload", onUnload);
    return () => removeEventListener("beforeunload", onUnload);
  }, [phase]);

  // ---- Running the interview ----

  async function begin() {
    if (!preview) { try { localStorage.setItem(attemptKey(form.id), String(attempt)); } catch { /* ignore */ } }
    const monitor = createMonitor();
    monitorRef.current = monitor;
    monitor.start();
    try { await document.documentElement.requestFullscreen?.(); } catch { /* not on every phone */ }
    setPhase("live");
    setStage("greeting");
    const first = name.trim().split(/\s+/)[0];
    await speakAsync(`Hi${first ? ` ${first}` : ""}, thanks for joining. I'll ask you ${main.length} question${main.length > 1 ? "s" : ""}, and you'll have ${fmtDuration(secs)} for each answer. Press Finish answer when you're done. Let's begin.`);
    if (aliveRef.current) runTurn(main[0], false, 0);
  }

  async function runTurn(q, follow, n) {
    const cur = { id: q.id, text: q.text, follow, n };
    currentRef.current = cur;
    setCurrent(cur);
    setStage("speaking");
    transcriptRef.current = "";
    setTranscript("");
    await speakAsync(q.text);
    if (!aliveRef.current) return;
    const limit = follow ? followSeconds(secs) : secs;
    setAllowed(limit);
    setRemaining(limit * 1000);
    finishingRef.current = false;
    answerStartRef.current = Date.now();
    deadlineRef.current = Date.now() + limit * 1000;
    setStage("answering");
    dict.start(true);
  }

  async function finishAnswer() {
    if (finishingRef.current) return;
    finishingRef.current = true;
    dict.stop();
    setStage("thinking");
    await wait(800);
    if (!aliveRef.current) return;
    const cur = currentRef.current;
    const answer = transcriptRef.current.trim();
    turnsRef.current.push({ qid: cur.id, q: cur.text, a: answer, follow: cur.follow, secs: Math.round((Date.now() - answerStartRef.current) / 1000), words: countWords(answer) });
    if (!cur.follow && countWords(answer) >= 8) {
      try {
        const r = await callApi({ action: "followup", title: form.title, question: cur.text, answer }, 9000);
        if (aliveRef.current && r?.ask && r.question) return runTurn({ id: cur.id, text: r.question }, true, cur.n);
      } catch { /* no follow-up when the AI isn't available */ }
    }
    if (!aliveRef.current) return;
    if (cur.n + 1 < main.length) runTurn(main[cur.n + 1], false, cur.n + 1);
    else complete();
  }
  const finishRef = useRef(finishAnswer);
  finishRef.current = finishAnswer;

  useEffect(() => {
    if (stage !== "answering") return;
    const id = setInterval(() => {
      const left = deadlineRef.current - Date.now();
      setRemaining(Math.max(0, left));
      if (left <= 0) finishRef.current();
    }, 200);
    return () => clearInterval(id);
  }, [stage]);

  async function complete() {
    setStage("closing");
    dict.stop(true);
    setCurrent({ text: "That's the end of the interview. Thank you.", follow: false, n: main.length - 1 });
    await speakAsync("That's the end of the interview. Thank you for your time.");
    const monitor = monitorRef.current;
    monitor?.stop();
    releaseDevices();
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    if (aliveRef.current) onDone({ seconds: secs, attempt, turns: turnsRef.current, integrity: monitor?.summary() || null });
  }

  // ---- Screens ----

  const PreviewBar = preview && (
    <div className="preview-note"><span>Preview — nothing is saved or sent.</span><button className="text-btn" onClick={onExit}>Close preview</button></div>
  );

  if (phase === "ready") {
    const faceText = { checking: "Checking camera…", ok: "Camera ready", none: "We can't see your face — sit facing the camera", multiple: "Only you should be in view", unavailable: "Camera ready" }[faceState];
    return (
      <div className="f-page" style={themeStyle(form)}>
        {PreviewBar}
        <main className="f-main">
          <div className="f-card f-head">
            <p className="eyebrow">{owner ? `${owner} · ` : ""}Video interview</p>
            <h1 className="f-title">Ready for your interview?</h1>
            <p className="f-intro">
              {main.length} question{main.length > 1 ? "s" : ""}, read out loud. You have {fmtDuration(secs)} to answer each one by speaking.
              Once you start, you can't pause. Stay in this tab, keep your face in view, and make sure no one else is in the room.
            </p>
            <div className="iv-ready">
              <div className="iv-preview">
                <video ref={videoRef} autoPlay muted playsInline />
                <span className={`iv-ready-status ${faceState === "none" || faceState === "multiple" ? "is-warn" : faceState === "ok" || faceState === "unavailable" ? "is-ok" : ""}`}>{error ? "Camera off" : faceText}</span>
              </div>
            </div>
            {error && <p className="error">{error}</p>}
            {!canListen && <p className="notice">This browser can't transcribe speech. Open the link in Chrome, Edge or Safari.</p>}
            {attempt > 1 && <p className="notice">You've started this interview before on this device. The hiring team will see this is attempt {attempt}.</p>}
            <label className="check">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span>I agree that my answers are transcribed and reviewed with AI. Only what I say is assessed — never my appearance or accent. My video isn't recorded.</span>
            </label>
            <div className="cover-actions">
              <button className="btn btn-primary btn-lg" onClick={begin} disabled={!consent || !!error || !canListen || faceState === "multiple"}>
                <span>Start interview</span><IArrowRight size={18} />
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const hostSpeaking = stage === "speaking" || stage === "greeting" || stage === "closing";
  const stageText = { greeting: "Interviewer is speaking", speaking: "Interviewer is asking", answering: "Your turn — speak your answer", thinking: "One moment…", closing: "Finishing up" }[stage] || "";
  const fraction = stage === "answering" ? remaining / (allowed * 1000) : stage === "thinking" ? 0 : 1;
  const R = 22, C = 2 * Math.PI * R;

  return (
    <div className="iv-page" style={themeStyle(form)}>
      <header className="iv-top">
        <span className="fill-owner">{form.title}</span>
        <span className="iv-live"><span className="rec-dot is-live" /><span>Live</span><span className="iv-clock">{clock(elapsed)}</span></span>
      </header>
      <main className="iv-main">
        <div className="iv-tiles">
          <div className={`iv-tile iv-host ${hostSpeaking ? "is-speaking" : ""}`}>
            <div className="iv-avatar" aria-hidden="true">{(owner || "I").trim().charAt(0).toUpperCase()}</div>
            <div className="iv-voice" aria-hidden="true"><span /><span /><span /><span /><span /></div>
            <span className="iv-label">{owner ? `${owner} · Interviewer` : "Interviewer"}</span>
          </div>
          <div className={`iv-tile iv-self ${faceState === "none" || faceState === "multiple" ? "is-warn" : ""}`}>
            <video ref={videoRef} autoPlay muted playsInline />
            <span className="iv-label">{name ? name.split(/\s+/)[0] : "You"}</span>
          </div>
          {faceState === "none" && <span className="iv-flag">Move into view of the camera</span>}
          {faceState === "multiple" && <span className="iv-flag">Only you should be in view</span>}
        </div>
        <section className="iv-q" aria-live="polite">
          <p className="q-meta">
            {stage === "greeting" ? <span className="q-num">Welcome</span>
              : current?.follow ? <span className="q-num">Follow-up</span>
              : current ? <><span className="q-num">{pad2(current.n + 1)}</span><span className="q-of">of {pad2(main.length)}</span></> : null}
          </p>
          <h1 className="iv-q-text">{stage === "greeting" ? "The interviewer is explaining how this works." : current?.text}</h1>
          {(stage === "answering" || stage === "thinking") && (
            <p className="iv-transcript">
              {transcript}
              {dict.interim && <span className="iv-interim"> {dict.interim}</span>}
              {!transcript && !dict.interim && <span className="muted">Start speaking — your words appear here.</span>}
            </p>
          )}
          {dict.error && <p className="error">{dict.error}</p>}
        </section>
      </main>
      <footer className="iv-bar">
        <div className="iv-bar-inner">
          <div className={`iv-timer ${stage === "answering" && remaining < 15000 ? "is-low" : ""}`} role="timer" aria-label="Time left">
            <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true">
              <circle cx="28" cy="28" r={R} className="iv-ring-bg" />
              <circle cx="28" cy="28" r={R} className="iv-ring" strokeDasharray={C} strokeDashoffset={C * (1 - fraction)} />
            </svg>
            <span>{stage === "answering" ? clock(Math.ceil(remaining / 1000)) : "–:––"}</span>
          </div>
          <span className="iv-stage">{stageText}</span>
          <button className="btn btn-primary" disabled={stage !== "answering"} onClick={finishAnswer}>
            <span>Finish answer</span><IArrowRight size={16} />
          </button>
        </div>
      </footer>
    </div>
  );
}

// ---------- What the form owner sees ----------

const sealedPayload = (r) => { const { seal, review, received, ...rest } = r; return rest; };

export function InterviewReport({ response }) {
  const iv = response.interview || {};
  const flags = integrityFlags(iv.integrity);
  if (iv.attempt > 1) flags.unshift(`Attempt ${iv.attempt} on the applicant's device`);
  const [review, setReview] = useState(response.review || null);
  const [reviewState, setReviewState] = useState(response.review ? "done" : "loading");
  const [verified, setVerified] = useState(response.seal ? "checking" : "unsealed");

  useEffect(() => {
    let live = true;
    if (response.seal) {
      callApi({ action: "verify", payload: sealedPayload(response), seal: response.seal }, 8000)
        .then((r) => live && setVerified(r.valid ? "valid" : "invalid"))
        .catch(() => live && setVerified("unknown"));
    }
    return () => { live = false; };
  }, [response]);

  const runReview = () => {
    // The owner's expected answers live only on the owner's device, in their copy of the form.
    const ownerForm = getForm(response.formId);
    const expectFor = (qid) => ownerForm?.interview?.questions?.find((q) => q.id === qid)?.expect || "";
    setReviewState("loading");
    callApi({ action: "evaluate", title: response.title, items: (iv.turns || []).map((t) => ({ question: t.q, answer: t.a, expect: t.follow ? "" : expectFor(t.qid) })) }, 60000)
      .then((r) => { setReview(r); setReviewState("done"); updateInbox(response.id, { review: r }); })
      .catch((e) => setReviewState(e.message || "failed"));
  };
  useEffect(() => { if (!response.review) runReview(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [response.id]);

  const scoreFor = (i) => review?.answers?.find((a) => a.index === i);
  const verifiedText = { checking: "Checking…", valid: "Unedited", invalid: "Edited after sending", unsealed: "Not sealed", unknown: "Couldn't check" }[verified];

  return (
    <div className="report">
      <div className="report-stats">
        <div><dt>AI score</dt><dd>{review ? <>{review.overall}<small> / 5</small></> : reviewState === "loading" ? "…" : "—"}</dd></div>
        <div><dt>Integrity</dt><dd className={flags.length ? "is-warn" : "is-ok"}>{flags.length ? `${flags.length} flag${flags.length > 1 ? "s" : ""}` : "Clear"}</dd></div>
        <div><dt>Results</dt><dd className={verified === "invalid" ? "is-warn" : verified === "valid" ? "is-ok" : ""}>{verifiedText}</dd></div>
      </div>
      {review && <p className="report-summary">{review.summary}</p>}
      {!review && reviewState !== "loading" && <p className="muted report-summary">AI review isn't available yet. <button className="text-btn" onClick={runReview}>Try again</button></p>}
      {flags.length > 0 && <ul className="report-list is-warn">{flags.map((f) => <li key={f}>{f}</li>)}</ul>}
      <ol className="report-turns">
        {(iv.turns || []).map((t, i) => {
          const s = scoreFor(i);
          return (
            <li key={i} className={t.follow ? "is-follow" : ""}>
              <div className="turn-head">
                <span className="turn-q">{t.follow ? <em>Follow-up · </em> : null}{t.q}</span>
                {s && <span className="turn-score">{s.score}/5</span>}
              </div>
              <p className={t.a ? "turn-a" : "turn-a muted"}>{t.a || "No answer given"}</p>
              {s && <p className="turn-meta">{s.note}</p>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
