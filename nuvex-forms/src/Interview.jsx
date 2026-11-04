// Timed video interview: an interviewer asks each question aloud, the applicant answers on camera,
// answers are transcribed, follow-ups come from Claude, and integrity checks run on-device.
import { useEffect, useRef, useState } from "react";
import { canListen, speak, stopSpeaking, useDictation } from "./voice.js";
import { loadProfile, saveProfile, uid, updateInbox } from "./store.js";
import { Sent } from "./Fill.jsx";
import { countFaces, createMonitor, integrityFlags, loadFaceDetector } from "./proctor.js";
import { appendText, clock, useElapsed } from "./ui.jsx";
import { IArrowRight, ICheck, IMic, IX } from "./icons.jsx";

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

export const interviewQuestions = (form) => form.questions.filter((q) => (q.type === "short" || q.type === "long") && !q.autofill);
const speakAsync = (text) => new Promise((res) => speak(text, res));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const countWords = (t) => (String(t).trim().match(/\S+/g) || []).length;
const pad2 = (n) => String(n).padStart(2, "0");
export const fmtDuration = (s) => (s < 60 ? `${s} seconds` : s % 60 === 0 ? `${s / 60} minute${s === 60 ? "" : "s"}` : `${Math.floor(s / 60)} min ${s % 60} s`);
const followSeconds = (secs) => Math.max(45, Math.round(secs * 0.6));
const attemptKey = (id) => "nf.attempt." + id;
const readAttempts = (id) => { try { return Number(localStorage.getItem(attemptKey(id)) || 0); } catch { return 0; } };

export default function Interview({ form, preview = false, onExit }) {
  const main = interviewQuestions(form);
  const secs = form.interview?.seconds || 120;
  const followups = form.interview?.followups !== false;
  const owner = form.owner?.name || "";
  const [profile] = useState(loadProfile);

  const [phase, setPhase] = useState("intro"); // intro → check → live → done
  const [name, setName] = useState(profile.name || "");
  const [email, setEmail] = useState(profile.email || "");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const [priorAttempts] = useState(() => (preview ? 0 : readAttempts(form.id)));

  const streamRef = useRef(null);
  const videoRef = useRef(null);
  const detectorRef = useRef(undefined);
  const monitorRef = useRef(null);
  const [faceState, setFaceState] = useState("checking");
  const [level, setLevel] = useState(0);

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
  const [response, setResponse] = useState(null);
  const elapsed = useElapsed(phase === "live");

  const dict = useDictation((t) => {
    transcriptRef.current = appendText(transcriptRef.current, t);
    setTranscript(transcriptRef.current);
  });

  // ---- Devices ----

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

  // Attach the camera to whichever <video> is on screen.
  useEffect(() => {
    if (videoRef.current && streamRef.current && videoRef.current.srcObject !== streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play?.().catch(() => {});
    }
  });

  // Microphone level meter on the check screen.
  useEffect(() => {
    if (phase !== "check" || !streamRef.current) return;
    let ctx, raf;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      ctx.createMediaStreamSource(streamRef.current).connect(analyser);
      const data = new Uint8Array(analyser.fftSize);
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let peak = 0;
        for (const v of data) peak = Math.max(peak, Math.abs(v - 128));
        setLevel(Math.min(1, peak / 64));
        raf = requestAnimationFrame(tick);
      };
      tick();
    } catch { /* meter is optional */ }
    return () => { cancelAnimationFrame(raf); ctx?.close?.(); };
  }, [phase]);

  // Face checks, on the check screen and throughout the interview.
  useEffect(() => {
    if (phase !== "check" && phase !== "live") return;
    const id = setInterval(() => {
      const det = detectorRef.current;
      if (det === undefined) return;
      if (det === null) { setFaceState("unavailable"); return; }
      const n = countFaces(det, videoRef.current);
      if (n == null) return;
      const state = phase === "live" && monitorRef.current ? monitorRef.current.sample(n) : n === 0 ? "none" : n > 1 ? "multiple" : "ok";
      setFaceState(state);
    }, 600);
    return () => clearInterval(id);
  }, [phase]);

  // Warn before leaving mid-interview.
  useEffect(() => {
    if (phase !== "live") return;
    const onUnload = (e) => { e.preventDefault(); e.returnValue = ""; };
    addEventListener("beforeunload", onUnload);
    return () => removeEventListener("beforeunload", onUnload);
  }, [phase]);

  async function openDevices() {
    setError("");
    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      setPhase("check");
      loadFaceDetector().then((d) => { detectorRef.current = d; });
    } catch (e) {
      setError(e?.name === "NotAllowedError"
        ? "Camera and microphone access is blocked. Allow both for this site in your browser settings, then try again."
        : "No camera or microphone was found. Connect one and try again.");
    }
  }

  // ---- The interview ----

  async function begin() {
    if (!preview) {
      saveProfile({ ...loadProfile(), name: name.trim(), email: email.trim() });
      try { localStorage.setItem(attemptKey(form.id), String(priorAttempts + 1)); } catch { /* ignore */ }
    }
    const monitor = createMonitor();
    monitorRef.current = monitor;
    monitor.start();
    try { await document.documentElement.requestFullscreen?.(); } catch { /* not supported on every phone */ }
    setPhase("live");
    setStage("greeting");
    const first = name.trim().split(/\s+/)[0];
    await speakAsync(
      `Hi${first ? ` ${first}` : ""}, thank you for joining${owner ? ` ${owner}` : ""}. I'll ask you ${main.length} question${main.length > 1 ? "s" : ""}. ` +
      `You'll have ${fmtDuration(secs)} for each answer${followups ? ", and I may ask a short follow-up" : ""}. When you've finished an answer, press Finish answer. Let's begin.`,
    );
    if (aliveRef.current) runTurn(main[0].text, false, 0);
  }

  async function runTurn(text, follow, n) {
    const cur = { text, follow, n };
    currentRef.current = cur;
    setCurrent(cur);
    setStage("speaking");
    transcriptRef.current = "";
    setTranscript("");
    await speakAsync(text);
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
    await wait(800); // let the last spoken words arrive
    if (!aliveRef.current) return;
    const cur = currentRef.current;
    const answer = transcriptRef.current.trim();
    turnsRef.current.push({
      q: cur.text, a: answer, follow: cur.follow, n: cur.n,
      secs: Math.round((Date.now() - answerStartRef.current) / 1000), words: countWords(answer),
    });
    if (!cur.follow && followups && countWords(answer) >= 8) {
      try {
        const r = await callApi({ action: "followup", title: form.title, question: cur.text, answer }, 9000);
        if (aliveRef.current && r?.ask && r.question) return runTurn(r.question, true, cur.n);
      } catch { /* no follow-up if the AI is unavailable */ }
    }
    if (!aliveRef.current) return;
    const nextIndex = cur.n + 1;
    if (nextIndex < main.length) runTurn(main[nextIndex].text, false, nextIndex);
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
    setCurrent({ text: "Thank you — that's the end of the interview.", follow: false, n: main.length - 1 });
    await speakAsync("That's the end of the interview. Thank you for your time.");
    const monitor = monitorRef.current;
    monitor?.stop();
    const integrity = monitor?.summary() || null;
    releaseDevices();
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    const turns = turnsRef.current;
    const payload = {
      v: 1, kind: "interview", id: uid(), formId: form.id, title: form.title, at: Date.now(),
      from: name.trim(), email: email.trim(),
      answers: turns.map((t) => [(t.follow ? "Follow-up: " : "") + t.q, t.a]),
      interview: { seconds: secs, attempt: priorAttempts + 1, turns, integrity },
    };
    try {
      const { seal } = await callApi({ action: "seal", payload }, 8000);
      payload.seal = seal;
    } catch { /* unsealed results are marked as such for the hiring team */ }
    if (!aliveRef.current) return;
    setResponse(payload);
    setPhase("done");
  }

  // ---- Screens ----

  if (phase === "done" && response) return <Sent form={form} response={response} preview={preview} onExit={onExit} />;

  const Top = (
    <header className="fill-top">
      <div className="fill-top-inner"><span className="fill-owner">{owner || form.title}</span></div>
      {preview && (
        <div className="preview-note">
          <span>Preview — nothing is saved or sent.</span>
          <button className="text-btn" onClick={onExit}>Close preview</button>
        </div>
      )}
    </header>
  );

  if (!main.length) {
    return (
      <div className="fill-page">{Top}<main className="fill-main"><section className="cover">
        <h1 className="cover-title">This interview has no questions yet</h1>
        <p className="cover-intro">Ask the organiser to add at least one written question.</p>
      </section></main></div>
    );
  }

  if (phase === "intro") {
    const totalMax = Math.ceil((main.length * (secs + (followups ? followSeconds(secs) : 0)) + main.length * 20) / 60);
    return (
      <div className="fill-page">
        {Top}
        <main className="fill-main">
          <section className="cover">
            <p className="eyebrow">{owner ? `${owner} · ` : ""}Video interview</p>
            <h1 className="cover-title">{form.title}</h1>
            {form.intro && <p className="cover-intro">{form.intro}</p>}
            <dl className="cover-meta">
              <div><dt>Questions</dt><dd>{main.length}{followups ? " + follow-ups" : ""}</dd></div>
              <div><dt>Per answer</dt><dd>{fmtDuration(secs)}</dd></div>
              <div><dt>Total</dt><dd>Up to {totalMax} min</dd></div>
            </dl>

            <div className="iv-rules">
              <div>
                <h2>How it works</h2>
                <ol>
                  <li>The interviewer reads each question aloud. It also appears on screen.</li>
                  <li>Answer out loud. A timer shows how long you have left.</li>
                  <li>Your words are transcribed as you speak. Press Finish answer when you're done.</li>
                  <li>Once started, the interview can't be paused or restarted.</li>
                </ol>
              </div>
              <div>
                <h2>What is checked</h2>
                <ol>
                  <li>Your face stays visible on camera.</li>
                  <li>No one else is in view.</li>
                  <li>You stay in this tab until the end.</li>
                  <li>No copying or pasting.</li>
                </ol>
                <p className="fine">Never assessed: your appearance, accent, background or way of speaking. Your video isn't recorded or uploaded — the face check runs on this device.</p>
              </div>
            </div>

            <div className="grid-2">
              <label className="lbl">Full name
                <input className="field" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
              </label>
              <label className="lbl">Email
                <input className="field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
              </label>
            </div>

            {priorAttempts > 0 && <p className="notice">This interview was already started on this device. Starting again will be shown to the hiring team as attempt {priorAttempts + 1}.</p>}
            {!canListen && <p className="notice">This browser can't transcribe speech. Open the link in Chrome, Edge or Safari to take the interview.</p>}

            <label className="check">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span>I agree to the checks above and to my spoken answers being transcribed{followups ? ", followed up" : ""} and reviewed with AI for {owner || "the hiring team"}. A person makes the decision.</span>
            </label>
            {error && <p className="error">{error}</p>}
            <div className="cover-actions">
              <button className="btn btn-primary btn-lg" disabled={!consent || !name.trim() || !canListen} onClick={openDevices}>
                <span>Check camera and microphone</span><IArrowRight size={18} />
              </button>
            </div>
          </section>
        </main>
      </div>
    );
  }

  if (phase === "check") {
    const faceText = {
      checking: "Looking for your face…",
      ok: "Face detected",
      none: "Face not detected — face the camera with light in front of you",
      multiple: "More than one person in view",
      unavailable: "Face check isn't available on this device",
    }[faceState];
    return (
      <div className="fill-page">
        {Top}
        <main className="fill-main is-wide">
          <section>
            <p className="eyebrow">Before you start</p>
            <h1 className="cover-title">Check your camera and microphone</h1>
            <div className="iv-check">
              <div className="iv-preview"><video ref={videoRef} autoPlay muted playsInline /></div>
              <ul className="iv-checklist">
                <li className="is-ok"><ICheck size={16} /><span><strong>Camera</strong><small>Working</small></span></li>
                <li className={level > 0.08 ? "is-ok" : ""}>
                  {level > 0.08 ? <ICheck size={16} /> : <IMic size={16} />}
                  <span><strong>Microphone</strong><small>{level > 0.08 ? "We can hear you" : "Say a few words to test"}</small>
                    <span className="iv-meter"><span style={{ width: `${Math.round(level * 100)}%` }} /></span></span>
                </li>
                <li className={faceState === "ok" ? "is-ok" : faceState === "none" || faceState === "multiple" ? "is-warn" : ""}>
                  {faceState === "ok" ? <ICheck size={16} /> : faceState === "none" || faceState === "multiple" ? <IX size={16} /> : <span className="rec-dot" />}
                  <span><strong>Face check</strong><small>{faceText}</small></span>
                </li>
                <li><span className="rec-dot" /><span><strong>Your space</strong><small>A quiet room, notes and other devices away</small></span></li>
              </ul>
            </div>
            <div className="cover-actions">
              <button className="btn btn-primary btn-lg" onClick={begin} disabled={faceState === "multiple"}>
                <span>Start interview</span><IArrowRight size={18} />
              </button>
              <button className="btn btn-lg" onClick={() => { releaseDevices(); setPhase("intro"); }}>Back</button>
            </div>
            <p className="fine">The interview starts as soon as you press Start, opens in full screen, and can't be paused.</p>
          </section>
        </main>
      </div>
    );
  }

  // Live
  const hostSpeaking = stage === "speaking" || stage === "greeting" || stage === "closing";
  const stageText = {
    greeting: "The interviewer is introducing the interview",
    speaking: "The interviewer is asking the question",
    answering: "Recording your answer",
    thinking: "One moment…",
    closing: "Wrapping up",
  }[stage] || "";
  const fraction = stage === "answering" ? remaining / (allowed * 1000) : stage === "thinking" ? 0 : 1;
  const R = 22, C = 2 * Math.PI * R;
  const lowTime = stage === "answering" && remaining < 15000;

  return (
    <div className="iv-page">
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
            {stage === "greeting" ? <span className="q-num">Introduction</span>
              : current?.follow ? <><span className="q-num">Follow-up</span><span className="q-of">to question {pad2(current.n + 1)}</span></>
              : current ? <><span className="q-num">{pad2(current.n + 1)}</span><span className="q-of">of {pad2(main.length)}</span></> : null}
          </p>
          <h1 className="iv-q-text">{stage === "greeting" ? "Welcome. The interviewer is explaining how this works." : current?.text}</h1>
          {(stage === "answering" || stage === "thinking") && (
            <p className="iv-transcript">
              {transcript}
              {dict.interim && <span className="iv-interim"> {dict.interim}</span>}
              {!transcript && !dict.interim && <span className="muted">Start speaking — your answer appears here as you talk.</span>}
            </p>
          )}
          {dict.error && <p className="error">{dict.error}</p>}
        </section>
      </main>

      <footer className="iv-bar">
        <div className="iv-bar-inner">
          <div className={`iv-timer ${lowTime ? "is-low" : ""}`} role="timer" aria-label="Time left">
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

// ---------- What the hiring team sees ----------

function sealedPayload(r) {
  const { v, kind, id, formId, title, at, from, email, answers, interview } = r;
  return { v, kind, id, formId, title, at, from, email, answers, interview };
}

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
    setReviewState("loading");
    callApi({ action: "evaluate", title: response.title, items: (iv.turns || []).map((t) => ({ question: t.q, answer: t.a })) }, 60000)
      .then((r) => { setReview(r); setReviewState("done"); updateInbox(response.id, { review: r }); })
      .catch((e) => setReviewState(e.message || "failed"));
  };
  useEffect(() => { if (!response.review) runReview(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [response.id]);

  const verifiedText = { checking: "Checking…", valid: "Unedited", invalid: "Edited after submission", unsealed: "Not sealed", unknown: "Couldn't check" }[verified];
  const scoreFor = (i) => review?.answers?.find((a) => a.index === i);

  return (
    <div className="report">
      <div className="report-stats">
        <div><dt>AI review</dt><dd>{review ? <>{review.overall}<small> / 5</small></> : reviewState === "loading" ? "…" : "—"}</dd></div>
        <div><dt>Integrity</dt><dd className={flags.length ? "is-warn" : "is-ok"}>{flags.length ? `${flags.length} flag${flags.length > 1 ? "s" : ""}` : "Clear"}</dd></div>
        <div><dt>Results</dt><dd className={verified === "invalid" ? "is-warn" : verified === "valid" ? "is-ok" : ""}>{verifiedText}</dd></div>
        <div><dt>Duration</dt><dd>{iv.integrity ? clock(iv.integrity.durationSec) : "—"}</dd></div>
      </div>

      <section className="report-block">
        <h3>Integrity</h3>
        {flags.length ? <ul className="report-list is-warn">{flags.map((f) => <li key={f}>{f}</li>)}</ul> : <p className="muted">Nothing unusual was recorded.</p>}
        {iv.integrity && !iv.integrity.faceCheck && <p className="fine">The face check wasn't available on the applicant's device.</p>}
        {iv.integrity?.events?.length > 0 && (
          <details className="report-log">
            <summary>Event log ({iv.integrity.events.length})</summary>
            <ol>{iv.integrity.events.map((e, i) => <li key={i}><span>{clock(e.t)}</span>{e.text}</li>)}</ol>
          </details>
        )}
      </section>

      <section className="report-block">
        <h3>AI review</h3>
        {review ? (
          <>
            <p className="report-summary">{review.summary}</p>
            <div className="grid-2">
              <div><p className="report-label">Strengths</p><ul className="report-list">{review.strengths.map((s) => <li key={s}>{s}</li>)}</ul></div>
              <div><p className="report-label">Worth exploring</p><ul className="report-list">{review.gaps.map((s) => <li key={s}>{s}</li>)}</ul></div>
            </div>
            <p className="fine">Confidence: {review.confidence}. A decision aid only — it judges what was said, never accent, grammar or appearance. Read the answers before deciding.</p>
          </>
        ) : reviewState === "loading" ? (
          <p className="muted">Reviewing the answers…</p>
        ) : (
          <p className="muted">AI review unavailable ({reviewState}). <button className="text-btn" onClick={runReview}>Try again</button></p>
        )}
      </section>

      <section className="report-block">
        <h3>Answers</h3>
        <ol className="report-turns">
          {(iv.turns || []).map((t, i) => {
            const s = scoreFor(i);
            return (
              <li key={i} className={t.follow ? "is-follow" : ""}>
                <div className="turn-head">
                  <span className="turn-q">{t.follow ? <em>Follow-up · </em> : null}{t.q}</span>
                  {s && <span className="turn-score" title={s.note}>{s.score}/5</span>}
                </div>
                <p className={t.a ? "turn-a" : "turn-a muted"}>{t.a || "No answer given"}</p>
                <p className="turn-meta">{t.secs}s · {t.words} words{s ? ` · ${s.note}` : ""}</p>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
