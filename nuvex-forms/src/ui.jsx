import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { canListen, useDictation } from "./voice.js";
import { ICheck, ICopy, IMic, IStop } from "./icons.jsx";

/** Adds spoken words onto what is already written. */
export function appendText(prev, words) {
  const t = words.trim();
  if (!t) return prev || "";
  const p = (prev || "").trimEnd();
  if (!p) return t.charAt(0).toUpperCase() + t.slice(1);
  return /[.!?]$/.test(p) ? `${p} ${t.charAt(0).toUpperCase() + t.slice(1)}` : `${p} ${t}`;
}

/** Grows a textarea to fit its content (and shrinks it back), on every value change and resize. */
export function useAutoGrow(value) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || el.tagName !== "TEXTAREA") return;
    const fit = () => { el.style.height = "auto"; el.style.height = el.scrollHeight + 2 + "px"; };
    fit();
    addEventListener("resize", fit);
    return () => removeEventListener("resize", fit);
  }, [value]);
  return ref;
}

/** Seconds since `active` became true. */
export function useElapsed(active) {
  const [s, setS] = useState(0);
  useEffect(() => {
    if (!active) { setS(0); return; }
    const start = Date.now();
    const id = setInterval(() => setS(Math.floor((Date.now() - start) / 1000)), 250);
    return () => clearInterval(id);
  }, [active]);
  return s;
}
export const clock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/** Small icon button that dictates into a field. */
export function MicButton({ onText, label = "Dictate" }) {
  const d = useDictation(onText);
  if (!canListen) return null;
  return (
    <button
      type="button"
      className={`icon-btn mic-inline ${d.listening ? "is-live" : ""}`}
      onClick={() => (d.listening ? d.stop() : d.start(true))}
      aria-label={d.listening ? "Stop dictation" : label}
      title={d.error || (d.listening ? "Stop dictation" : label)}
    >
      {d.listening ? <IStop size={14} /> : <IMic size={16} />}
    </button>
  );
}

/** Text input or textarea with dictation built in. */
export function VoiceField({ value, onChange, multiline, placeholder, type = "text", autoComplete, id, className = "", rows = 3, ...rest }) {
  const Tag = multiline ? "textarea" : "input";
  const ref = useAutoGrow(value);
  return (
    <div className={`field-wrap ${multiline ? "is-multi" : ""}`}>
      <Tag
        ref={ref}
        id={id}
        className={`field ${className}`}
        type={multiline ? undefined : type}
        value={value || ""}
        placeholder={placeholder}
        autoComplete={autoComplete}
        rows={multiline ? rows : undefined}
        onChange={(e) => onChange(e.target.value)}
        {...rest}
      />
      <MicButton onText={(t) => onChange(appendText(value, t))} />
    </div>
  );
}

export function Switch({ checked, onChange, label, hint }) {
  return (
    <label className="switch">
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="switch-track" aria-hidden="true"><span className="switch-thumb" /></span>
      <span className="switch-text">{label}{hint && <small>{hint}</small>}</span>
    </label>
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

export function CopyButton({ text, label = "Copy", className = "btn", icon = true }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        if (await copyText(text)) {
          setDone(true);
          setTimeout(() => setDone(false), 1600);
        }
      }}
    >
      {icon && (done ? <ICheck size={16} /> : <ICopy size={16} />)}
      <span>{done ? "Copied" : label}</span>
    </button>
  );
}

export const digits = (s) => String(s || "").replace(/\D/g, "");
export const whatsappLink = (number, text) => `https://wa.me/${digits(number)}?text=${encodeURIComponent(text)}`;

export const timeAgo = (t) => {
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short", year: new Date(t).getFullYear() === new Date().getFullYear() ? undefined : "numeric" });
};
