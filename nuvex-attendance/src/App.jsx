import { useEffect, useState } from "react";
import { AttendanceHome, Register } from "./Attendance.jsx";
import { getRegister } from "./store.js";
import { IMoon, ISun } from "./icons.jsx";

function useHash() {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const on = () => { setHash(location.hash); window.scrollTo(0, 0); };
    addEventListener("hashchange", on);
    return () => removeEventListener("hashchange", on);
  }, []);
  return hash;
}

export default function App() {
  const hash = useHash();
  const [, page, id] = hash.split("/");
  let body = <AttendanceHome />;
  if (page === "g") {
    const r = getRegister(id);
    body = r ? <Register key={id} initial={r} /> : <Missing />;
  }
  return (
    <div className="site">
      <header className="nav">
        <div className="nav-inner">
          <a href="#/" className="wordmark"><Mark /><span>Nuvex Attendance</span></a>
          <span className="grow" />
          <ModeButton />
        </div>
      </header>
      <main>{body}</main>
    </div>
  );
}

function Mark({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <rect width="24" height="24" rx="6" fill="currentColor" />
      <path d="M7 12.5l3 3 7-7" stroke="var(--paper)" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ModeButton() {
  const [mode, setMode] = useState(() => document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
  const flip = () => {
    const next = mode === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("na.mode", next); } catch { /* ignore */ }
    setMode(next);
  };
  const label = mode === "dark" ? "Light mode" : "Dark mode";
  return (
    <button type="button" className="icon-btn" onClick={flip} aria-label={label} title={label}>
      {mode === "dark" ? <ISun size={18} /> : <IMoon size={18} />}
    </button>
  );
}

function Missing() {
  return (
    <section className="page narrow">
      <h1 className="page-title">This group isn't here</h1>
      <p className="lede">Groups are saved on the device they were made on. It may have been deleted, or made on another phone.</p>
      <div className="row-start"><a className="btn" href="#/">See your groups</a></div>
    </section>
  );
}
