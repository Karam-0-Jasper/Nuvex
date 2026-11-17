// Log in, or set up a new school (the person who sets it up becomes its admin).
import { useState } from "react";
import { lastSchool, message, rememberSchool, signIn } from "./sync.js";

const slug = (s) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30);

export function Field({ label, hint, ...props }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <input {...props} />
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export default function Auth({ onSignedIn, Logo, note }) {
  const [view, setView] = useState("login");
  const [f, setF] = useState({ code: lastSchool(), username: "", password: "", school: "", name: "" });
  const [codeTouched, setCodeTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setErr("");
    const code = f.code.trim().toLowerCase();
    try {
      const session = view === "login"
        ? await signIn("login", { p_code: code, p_username: f.username, p_password: f.password })
        : await signIn("create_school", { p_code: code, p_school: f.school, p_name: f.name, p_username: f.username, p_password: f.password });
      rememberSchool(code);
      onSignedIn(session);
    } catch (x) {
      setErr(message(x));
      setBusy(false);
    }
  };
  const swap = (v) => { setView(v); setErr(""); setF((x) => ({ ...x, password: "" })); };
  const isNew = view === "new";

  return (
    <div className="auth">
      <form className="auth-card" onSubmit={submit} noValidate>
        <div className="auth-brand"><Logo size={36} /><span>Attendance</span></div>
        <h1 className="auth-h">{isNew ? "Set up your school" : "Log in"}</h1>
        <p className="auth-sub">{isNew ? "You will be the school admin. You add the teachers after this." : "Use the details your school admin gave you."}</p>

        {isNew && <>
          <Field label="School name" value={f.school} required maxLength={120} autoComplete="organization"
            onChange={(e) => { set("school")(e); if (!codeTouched) setF((x) => ({ ...x, code: slug(e.target.value) })); }} />
          <Field label="Your name" value={f.name} onChange={set("name")} required maxLength={80} autoComplete="name" placeholder="e.g. Mrs Johnson" />
        </>}
        <Field label="School code" value={f.code} required maxLength={30} autoCapitalize="none" autoCorrect="off" spellCheck={false}
          onChange={(e) => { setCodeTouched(true); set("code")(e); }} placeholder="e.g. st-mary"
          hint={isNew ? "Short and simple. Every teacher types it to log in." : undefined} />
        <Field label="Username" value={f.username} onChange={set("username")} required maxLength={30} autoCapitalize="none" autoCorrect="off"
          spellCheck={false} autoComplete="username" placeholder={isNew ? "e.g. admin" : ""} />
        <Field label="Password" type="password" value={f.password} onChange={set("password")} required maxLength={72}
          autoComplete={isNew ? "new-password" : "current-password"} hint={isNew ? "At least 6 characters." : undefined} />

        {(err || note) && <p className="auth-err" role="alert">{err || note}</p>}
        <button className="btn-primary" disabled={busy}>{busy ? (isNew ? "Setting up…" : "Logging in…") : isNew ? "Set up school" : "Log in"}</button>

        <p className="auth-alt">
          {isNew
            ? <>Already set up? <button type="button" className="link" onClick={() => swap("login")}>Log in</button></>
            : <>New school? <button type="button" className="link" onClick={() => swap("new")}>Set up your school</button></>}
        </p>
        {!isNew && <p className="auth-note">Forgot your password? Ask your school admin to give you a new one.</p>}
      </form>
    </div>
  );
}
