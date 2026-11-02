import { useState } from "react";
import { useDictation } from "./voice.js";

export const MicIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
    <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" stroke="none" />
    <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M9 21h6" />
  </svg>
);

/** Adds spoken words onto what is already written. */
export function appendText(prev, words) {
  const t = words.trim();
  if (!t) return prev || "";
  const p = (prev || "").trimEnd();
  if (!p) return t.charAt(0).toUpperCase() + t.slice(1);
  const newSentence = /[.!?]$/.test(p);
  return `${p} ${newSentence ? t.charAt(0).toUpperCase() + t.slice(1) : t}`;
}

/** A mic button that types what you say into a field via onText. */
export function MicButton({ onText, label = "Speak", small = false }) {
  const d = useDictation(onText);
  return (
    <span className="mic-wrap">
      <button
        type="button"
        className={`mic ${d.listening ? "on" : ""} ${small ? "small" : ""}`}
        onClick={() => (d.listening ? d.stop() : d.start(true))}
        aria-label={d.listening ? "Stop listening" : label}
        title={d.listening ? "Stop listening" : label}
      >
        <MicIcon size={small ? 18 : 22} />
        {!small && <span>{d.listening ? "Stop" : label}</span>}
      </button>
      {d.listening && d.interim && <span className="interim">{d.interim}…</span>}
      {d.error && <span className="err small-text">{d.error}</span>}
    </span>
  );
}

/** Text box (one line or many) with a mic built in. */
export function VoiceField({ value, onChange, multiline, placeholder, type = "text", autoComplete, id }) {
  const Tag = multiline ? "textarea" : "input";
  return (
    <div className={`voice-field ${multiline ? "multi" : ""}`}>
      <Tag
        id={id}
        type={multiline ? undefined : type}
        value={value || ""}
        placeholder={placeholder}
        autoComplete={autoComplete}
        rows={multiline ? 3 : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      <MicButton small onText={(t) => onChange(appendText(value, t))} />
    </div>
  );
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}

export function CopyButton({ text, label = "Copy", className = "btn" }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        if (await copyText(text)) {
          setDone(true);
          setTimeout(() => setDone(false), 1800);
        }
      }}
    >
      {done ? "Copied ✓" : label}
    </button>
  );
}

export const digits = (s) => String(s || "").replace(/\D/g, "");
export const whatsappLink = (number, text) =>
  `https://wa.me/${digits(number)}?text=${encodeURIComponent(text)}`;
