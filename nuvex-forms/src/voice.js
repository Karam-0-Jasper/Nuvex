// Everything to do with talking and listening.
// Uses the browser's built-in speech tools, so there is nothing to pay for and no server needed.
import { useCallback, useEffect, useRef, useState } from "react";

const SR =
  typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

export const canListen = !!SR;
export const canSpeak = typeof window !== "undefined" && "speechSynthesis" in window;
const LANG = (typeof navigator !== "undefined" && navigator.language) || "en-US";

// ---------- Reading out loud ----------

let speakId = 0;

/** Read text aloud. onEnd only fires if nothing else was spoken or stopped in the meantime. */
export function speak(text, onEnd) {
  const id = ++speakId;
  if (!canSpeak) {
    if (onEnd) setTimeout(() => id === speakId && onEnd(), 0);
    return;
  }
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = LANG;
  u.rate = 1;
  const finish = () => {
    if (id === speakId && onEnd) onEnd();
  };
  u.onend = finish;
  u.onerror = finish;
  window.speechSynthesis.speak(u);
}

export function stopSpeaking() {
  speakId++;
  if (canSpeak) window.speechSynthesis.cancel();
}

// ---------- Listening ----------

/**
 * Voice typing. onFinal(text) is called each time the person finishes a phrase.
 * start(true) keeps the mic on through pauses (hands-free mode).
 */
export function useDictation(onFinal) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState("");
  const recRef = useRef(null);
  const keepRef = useRef(false);
  const cbRef = useRef(onFinal);
  cbRef.current = onFinal;

  const start = useCallback((keep = false) => {
    if (!SR) {
      setError("Voice typing isn't available in this browser. Try Chrome, Edge or Safari.");
      return;
    }
    keepRef.current = keep;
    const old = recRef.current;
    recRef.current = null;
    if (old) try { old.abort(); } catch { /* already stopped */ }

    const r = new SR();
    r.lang = LANG;
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e) => {
      if (recRef.current !== r && !r.flushing) return;
      let partial = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) {
          const t = res[0].transcript.trim();
          if (t) cbRef.current(t);
        } else partial += res[0].transcript;
      }
      setInterim(partial);
    };
    r.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        keepRef.current = false;
        setError("The microphone is blocked. Allow the mic for this site, then try again.");
      } else if (e.error === "audio-capture") {
        keepRef.current = false;
        setError("No microphone found.");
      } else if (e.error !== "no-speech" && e.error !== "aborted") {
        setError("Voice problem: " + e.error);
      }
    };
    r.onend = () => {
      if (recRef.current !== r) return;
      if (keepRef.current) {
        try { r.start(); return; } catch { /* fall through */ }
      }
      recRef.current = null;
      setInterim("");
      setListening(false);
    };
    recRef.current = r;
    setError("");
    try {
      r.start();
      setListening(true);
    } catch {
      recRef.current = null;
      setError("Couldn't start the microphone.");
    }
  }, []);

  /** Stop listening. Words already spoken still come through unless discard is true. */
  const stop = useCallback((discard = false) => {
    keepRef.current = false;
    const r = recRef.current;
    recRef.current = null;
    setListening(false);
    setInterim("");
    if (!r) return;
    try {
      if (discard) r.abort();
      else { r.flushing = true; r.stop(); }
    } catch { /* already stopped */ }
  }, []);

  useEffect(() => () => {
    keepRef.current = false;
    const r = recRef.current;
    recRef.current = null;
    if (r) try { r.abort(); } catch { /* ignore */ }
  }, []);

  return { listening, interim, error, start, stop, setError };
}

// ---------- Understanding what was said ----------

export const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const NUMBERS = {
  zero: 0, one: 1, won: 1, first: 1, two: 2, second: 2, three: 3, third: 3,
  four: 4, fourth: 4, five: 5, fifth: 5, six: 6, sixth: 6, seven: 7, seventh: 7,
  eight: 8, eighth: 8, nine: 9, ninth: 9, ten: 10, tenth: 10, last: -1,
};

function spokenNumber(s) {
  const n = norm(s);
  const digit = n.match(/\b(\d{1,2})\b/);
  if (digit) return Number(digit[1]);
  for (const w of n.split(" ")) if (w in NUMBERS && w !== "last") return NUMBERS[w];
  return null;
}

/** Turn "the second one", "option B", "photography" etc. into an option index, or -1. */
const CARDINALS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twenty: 20, fifty: 50, hundred: 100 };
const withDigits = (s) => norm(s).split(" ").map((w) => (w in CARDINALS ? String(CARDINALS[w]) : w)).join(" ");

export function matchOption(spoken, options) {
  const s = withDigits(spoken);
  if (!s) return -1;
  let best = -1;
  let bestScore = 0;
  options.forEach((o, i) => {
    const n = withDigits(o);
    if (!n) return;
    let score = 0;
    if (s === n) score = 100;
    else if (` ${s} `.includes(` ${n} `)) score = 50 + n.length;
    else {
      const words = n.split(" ").filter((w) => w.length > 2 || /^\d+$/.test(w));
      const said = new Set(s.split(" "));
      const hit = words.filter((w) => said.has(w)).length;
      if (words.length) score = (40 * hit) / words.length;
    }
    if (score > bestScore) { bestScore = score; best = i; }
  });
  if (bestScore >= 20) return best;

  // "the first one", "option two", "number 3", "the last one", "B"
  const words = norm(spoken).split(" ");
  if (words.includes("last")) return options.length - 1;
  if (words.length === 1 && /^[a-j]$/.test(words[0])) {
    const i = words[0].charCodeAt(0) - 97;
    if (i < options.length) return i;
  }
  const ordinal = words.find((w) => /^(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)$/.test(w));
  const num = ordinal ? NUMBERS[ordinal] : /\b(option|number|choice)\b/.test(s) || words.length <= 2 ? spokenNumber(spoken) : null;
  if (num && num >= 1 && num <= options.length) return num - 1;
  return -1;
}

/** "yeah I can" → "Yes", "not really" → "No", otherwise null. */
export function matchYesNo(spoken) {
  const s = norm(spoken);
  const no = /^(no|nope|nah|not)\b|\b(not really|i dont|i do not|i cant|i cannot|i wont|never|no way)\b/;
  const yes = /^(yes|yeah|yep|yup|sure|ok|okay|correct|right|definitely|absolutely|of course)\b|\b(i do|i am|i can|i have|i will)\b/;
  if (no.test(s)) return "No";
  if (yes.test(s)) return "Yes";
  return null;
}

export function matchRating(spoken, max) {
  const n = spokenNumber(spoken);
  return n && n >= 1 && n <= max ? n : null;
}

const MONTHS = ["january","february","march","april","may","june","july","august","september","october","november","december"];
const pad = (n) => String(n).padStart(2, "0");
export const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** "today", "next monday", "march 5th", "5 march 2027" → "2027-03-05", or null. */
export function parseSpokenDate(spoken) {
  const s = norm(spoken).replace(/\b(\d+)(st|nd|rd|th)\b/g, "$1");
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  if (/\btoday\b|\bright now\b|\bimmediately\b|\basap\b/.test(s)) return isoDate(today);
  if (/\btomorrow\b/.test(s)) { today.setDate(today.getDate() + 1); return isoDate(today); }
  if (/\bnext week\b/.test(s)) { today.setDate(today.getDate() + 7); return isoDate(today); }
  if (/\bnext month\b/.test(s)) { today.setMonth(today.getMonth() + 1, 1); return isoDate(today); }
  const days = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
  const day = days.findIndex((d) => s.includes(d));
  if (day >= 0) {
    let diff = (day - today.getDay() + 7) % 7 || 7;
    today.setDate(today.getDate() + diff);
    return isoDate(today);
  }
  const month = MONTHS.findIndex((m) => s.includes(m) || s.split(" ").includes(m.slice(0, 3)));
  if (month >= 0) {
    const nums = (s.match(/\b\d{1,4}\b/g) || []).map(Number);
    const year = nums.find((n) => n > 1900) || today.getFullYear();
    const date = nums.find((n) => n >= 1 && n <= 31) || 1;
    const d = new Date(year, month, date, 12);
    if (!nums.some((n) => n > 1900) && d < today) d.setFullYear(d.getFullYear() + 1);
    return isoDate(d);
  }
  return null;
}

/** Spoken commands that move around the form. */
export function voiceCommand(spoken) {
  const s = norm(spoken).replace(/^(ok|okay|um|uh) /, "").replace(/ please$/, "");
  if (/^(next|next one|next question|skip|skip it|skip this|continue|go on|move on)$/.test(s)) return "next";
  if (/^(back|go back|previous|previous question|last question)$/.test(s)) return "back";
  if (/^(repeat|again|say (it|that) again|repeat (it|that|the question)|what was the question)$/.test(s)) return "repeat";
  if (/^(clear|clear (it|that)|erase|erase (it|that)|delete (it|that)|start over|redo)$/.test(s)) return "clear";
  if (/^(submit|send|send it|submit it|done|finish|im done|thats all|thats it)$/.test(s)) return "submit";
  if (/^(stop|stop listening|pause|hands free off)$/.test(s)) return "stop";
  return null;
}

/** "...and that's my answer. Next" → { text: "...and that's my answer.", next: true } */
export function splitTrailingNext(spoken) {
  const m = spoken.match(/^(.*?)[\s,.;!]*\b(next question|next)[.!]?$/i);
  return m ? { text: m[1].trim(), next: true } : { text: spoken, next: false };
}

/** "karamba at gmail dot com" → "karamba@gmail.com", "instagram dot com slash nuvex" → "instagram.com/nuvex" */
export function tidySpoken(text, kind) {
  if (kind === "email" || kind === "link") {
    let t = text.toLowerCase()
      .replace(/\s+(at sign|at)\s+/g, kind === "email" ? "@" : " at ")
      .replace(/\s*\b(dot|period|point)\b\s*/g, ".")
      .replace(/\s*\b(forward slash|slash)\b\s*/g, "/")
      .replace(/\s*\b(underscore)\b\s*/g, "_")
      .replace(/\s*\b(dash|hyphen)\b\s*/g, "-");
    if (kind === "email" || !/\s/.test(t.trim()) || /\.[a-z]{2,}/.test(t)) t = t.replace(/\s+/g, "");
    return t;
  }
  if (kind === "phone") return text.replace(/\bplus\s*/gi, "+").replace(/(\d)\s+(?=\d)/g, "$1").trim();
  return text;
}
