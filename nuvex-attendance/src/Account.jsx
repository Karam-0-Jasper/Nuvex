// The account menu: who is logged in, the school's teachers (admin only), password, log out.
import { useState } from "react";
import { Field } from "./Auth.jsx";
import { message, rpc } from "./sync.js";

function Sheet({ title, onClose, children }) {
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><h2>{title}</h2><button className="link" onClick={onClose}>Close</button></div>
        {children}
      </div>
    </div>
  );
}

function Team({ session, info, onTeam, onClose }) {
  const [f, setF] = useState({ name: "", username: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState("");
  const [reset, setReset] = useState(null); // { id, password }
  const [removing, setRemoving] = useState(null);
  const call = async (fn, args, ok) => {
    setBusy(true); setErr(""); setDone("");
    try { const res = await rpc(fn, { p_token: session.token, ...args }); ok(res); } catch (x) { setErr(message(x)); }
    setBusy(false);
  };
  const add = (e) => {
    e.preventDefault();
    call("add_teacher", { p_name: f.name, p_username: f.username, p_password: f.password }, (team) => {
      onTeam(team);
      setDone(`Added ${f.name.trim()}. They log in with school code “${info.school.code}”, username “${f.username.trim().toLowerCase()}” and the password you chose.`);
      setF({ name: "", username: "", password: "" });
    });
  };

  return (
    <Sheet title="Teachers" onClose={onClose}>
      <ul className="team">
        {(info.team || []).map((t) => (
          <li key={t.id}>
            <div className="team-who">
              <b>{t.name}</b>
              <span>{t.username}{t.role === "admin" ? " · school admin" : ""}</span>
            </div>
            {t.role !== "admin" && (
              <div className="team-act">
                <button className="link" onClick={() => { setReset({ id: t.id, password: "" }); setRemoving(null); }}>New password</button>
                <button className="link is-danger" onClick={() => { setRemoving(t.id); setReset(null); }}>Remove</button>
              </div>
            )}
            {reset?.id === t.id && (
              <form className="inline-form" onSubmit={(e) => {
                e.preventDefault();
                call("reset_password", { p_account: t.id, p_new: reset.password }, () => { setDone(`${t.name} can now log in with the new password.`); setReset(null); });
              }}>
                <Field label={`New password for ${t.name}`} value={reset.password} onChange={(e) => setReset({ ...reset, password: e.target.value })} autoComplete="off" maxLength={72} />
                <button className="btn-primary sm" disabled={busy}>Save</button>
              </form>
            )}
            {removing === t.id && (
              <div className="inline-form">
                <p>Remove {t.name}'s login? Their registers are kept and move to you.</p>
                <button className="btn-danger sm" disabled={busy} onClick={() => call("remove_teacher", { p_account: t.id }, (team) => { onTeam(team, true); setRemoving(null); })}>Remove</button>
                <button className="link" onClick={() => setRemoving(null)}>Cancel</button>
              </div>
            )}
          </li>
        ))}
      </ul>

      <form className="add-teacher" onSubmit={add}>
        <h3>Add a teacher</h3>
        <Field label="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} maxLength={80} placeholder="e.g. Mr Kollie" />
        <Field label="Username" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} maxLength={30}
          autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="e.g. kollie" />
        <Field label="Password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} maxLength={72}
          autoComplete="off" hint="At least 6 characters. Tell the teacher in person, not in a group chat." />
        <button className="btn-primary" disabled={busy}>Add teacher</button>
      </form>
      {err && <p className="auth-err" role="alert">{err}</p>}
      {done && <p className="auth-ok" role="status">{done}</p>}
    </Sheet>
  );
}

function Password({ session, onClose }) {
  const [f, setF] = useState({ old: "", next: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState(false);
  return (
    <Sheet title="Change password" onClose={onClose}>
      {ok ? <p className="auth-ok">Password changed. Other phones logged in to your account were logged out.</p> : (
        <form onSubmit={async (e) => {
          e.preventDefault(); setBusy(true); setErr("");
          try { await rpc("change_password", { p_token: session.token, p_old: f.old, p_new: f.next }); setOk(true); } catch (x) { setErr(message(x)); }
          setBusy(false);
        }}>
          <Field label="Current password" type="password" value={f.old} onChange={(e) => setF({ ...f, old: e.target.value })} autoComplete="current-password" maxLength={72} />
          <Field label="New password" type="password" value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} autoComplete="new-password" maxLength={72} hint="At least 6 characters." />
          {err && <p className="auth-err" role="alert">{err}</p>}
          <button className="btn-primary" disabled={busy}>Change password</button>
        </form>
      )}
    </Sheet>
  );
}

export default function Account({ session, info, onTeam, onLogout }) {
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState(null);
  const [err, setErr] = useState("");
  const me = info.me;
  const initials = me.name.split(/\s+/).filter(Boolean).slice(-2).map((w) => w[0]).join("").toUpperCase() || "?";
  return (
    <span className="acct" onClick={(e) => e.stopPropagation()}>
      <button className="avatar" onClick={() => { setOpen(!open); setErr(""); }} aria-label={`Account: ${me.name}`} aria-expanded={open}>{initials}</button>
      {open && (
        <div className="pop acct-pop">
          <div className="acct-who"><b>{me.name}</b><span>{me.username} · {me.role === "admin" ? "School admin" : "Teacher"}</span><span>{info.school.name}</span></div>
          {me.role === "admin" && <button onClick={() => { setPanel("team"); setOpen(false); }}>Teachers</button>}
          <button onClick={() => { setPanel("password"); setOpen(false); }}>Change password</button>
          <button onClick={async () => { const e = await onLogout(); if (e) setErr(e); }}>Log out</button>
          {err && <p className="acct-err">{err}</p>}
        </div>
      )}
      {panel === "team" && <Team session={session} info={info} onTeam={onTeam} onClose={() => setPanel(null)} />}
      {panel === "password" && <Password session={session} onClose={() => setPanel(null)} />}
    </span>
  );
}
