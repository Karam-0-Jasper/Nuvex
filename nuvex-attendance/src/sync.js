// Talking to the school database, and keeping this phone's copy in step with it.
// Every change is saved on the phone first, queued, and uploaded when there is a connection.
import { SUPABASE } from "./config.js";
import { uid } from "./store.js";

export const ONLINE = !!(SUPABASE.url && SUPABASE.key) && import.meta.env.VITE_ARTIFACT !== "1";

export class ApiError extends Error {
  constructor(code, network = false) { super(code); this.code = code; this.network = network; }
}

/** Calls one of the database functions. Throws ApiError("offline", true) when there is no connection. */
export async function rpc(fn, args) {
  let res;
  try {
    res = await fetch(`${SUPABASE.url}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: { apikey: SUPABASE.key, "Content-Type": "application/json" },
      body: JSON.stringify(args),
    });
  } catch { throw new ApiError("offline", true); }
  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { /* not JSON */ }
  if (!res.ok) throw new ApiError(body?.message || `http_${res.status}`, res.status >= 500);
  return body;
}

// ---------- what is kept on the phone ----------
const read = (key, fallback) => { try { const v = JSON.parse(localStorage.getItem(key)); return v ?? fallback; } catch { return fallback; } };
const write = (key, v) => { try { localStorage.setItem(key, JSON.stringify(v)); return true; } catch { return false; } };
const drop = (key) => { try { localStorage.removeItem(key); } catch { /* ignore */ } };

export const loadSession = () => { const s = read("na.session", null); return s && s.token && s.id ? s : null; };
export const saveSession = (s) => write("na.session", s);
export const lastSchool = () => read("na.school", "");
export const rememberSchool = (code) => write("na.school", code);

export const loadCache = (id) => read(`na.cache.${id}`, { info: null, sheets: [] });
export const saveCache = (id, cache) => write(`na.cache.${id}`, cache);
export const loadQueue = (id) => read(`na.queue.${id}`, []);
export const pushQueue = (id, ops) => write(`na.queue.${id}`, [...loadQueue(id), ...ops]);
export const shiftQueue = (id, n) => write(`na.queue.${id}`, loadQueue(id).slice(n));

/** Logging out removes this account's copy from the phone, so the next person can't read it. */
export function forget(id) {
  drop(`na.cache.${id}`); drop(`na.queue.${id}`); drop("na.session");
}

/** Signs in (or starts a school), then downloads everything the account may see. */
export async function signIn(fn, args) {
  const res = await rpc(fn, args);
  if (res?.error) throw new ApiError(res.error === "locked" ? `locked:${res.seconds}` : res.error);
  const data = await rpc("get_data", { p_token: res.token });
  const session = { token: res.token, id: data.me.id };
  saveCache(session.id, { info: infoOf(data), sheets: sheetsOf(data, []) });
  saveSession(session);
  return session;
}

export const infoOf = (data) => ({ me: data.me, school: data.school, team: data.team || null });
/** Server registers in the app's shape, keeping when each was last opened on this phone. */
export function sheetsOf(data, local) {
  const opened = Object.fromEntries(local.map((s) => [s.id, s.opened]));
  return data.registers.map((r) => ({ ...r, cols: r.cols || [], opened: opened[r.id] }));
}

// ---------- turning a change into small uploads ----------
/** Compares two versions of all registers and lists only what changed (a tap is one small op, not the whole sheet). */
export function diff(prev, next, meId) {
  const ops = [];
  const before = new Map(prev.map((s) => [s.id, s]));
  const after = new Set(next.map((s) => s.id));
  for (const s of next) {
    const p = before.get(s.id);
    const reg = s.id;
    if (!p || p.name !== s.name) ops.push({ t: "reg", id: reg, name: s.name || "" });
    if (p ? p.owner !== s.owner && s.owner : s.owner && s.owner !== meId) ops.push({ t: "owner", id: reg, owner: s.owner });
    const cols = s.cols || [];
    if (!p || (p.cols || []).join() !== cols.join()) ops.push({ t: "cols", reg, cols });
    const oldPeople = new Map((p?.people || []).map((x, i) => [x.id, { ...x, i }]));
    s.people.forEach((x, i) => {
      const o = oldPeople.get(x.id);
      if (!o || o.name !== x.name || o.i !== i) ops.push({ t: "person", reg, id: x.id, name: x.name || "", pos: i });
    });
    const gone = new Set([...oldPeople.keys()].filter((id) => !s.people.some((x) => x.id === id)));
    const oldMarks = p?.marks || {};
    for (const key of new Set([...Object.keys(oldMarks), ...Object.keys(s.marks)])) {
      if (oldMarks[key] === s.marks[key]) continue;
      const cut = key.indexOf("|");
      const pid = key.slice(0, cut);
      if (gone.has(pid)) continue;
      ops.push({ t: "mark", reg, p: pid, d: key.slice(cut + 1), s: s.marks[key] || null });
    }
    for (const id of gone) ops.push({ t: "delperson", id });
  }
  for (const p of prev) if (!after.has(p.id)) ops.push({ t: "delreg", id: p.id });
  return ops;
}

/** Copies registers made before logins existed into the account, with fresh ids so two accounts never clash. */
export function adopt(sheets, me) {
  return sheets.map((s) => {
    const ids = new Map(s.people.map((p) => [p.id, uid()]));
    const marks = {};
    for (const [key, v] of Object.entries(s.marks || {})) {
      const cut = key.indexOf("|");
      const pid = ids.get(key.slice(0, cut));
      if (pid) marks[`${pid}|${key.slice(cut + 1)}`] = v;
    }
    return {
      id: uid(), name: s.name || "Register", cols: s.cols || [], marks, created: s.created || Date.now(),
      people: s.people.map((p) => ({ id: ids.get(p.id), name: p.name })), owner: me.id, ownerName: me.name,
    };
  });
}

const MESSAGES = {
  offline: "No internet connection. Connect and try again.",
  wrong: "The school code, username or password is wrong.",
  school_code_taken: "That school code is already used. Pick another one.",
  bad_school_code: "School code: 3 to 30 small letters, numbers or dashes (for example st-mary).",
  bad_username: "Username: 2 to 30 small letters or numbers, no spaces.",
  username_taken: "Someone at this school already has that username.",
  password_too_short: "The password needs at least 6 characters.",
  password_too_long: "That password is too long.",
  wrong_password: "Your current password is wrong.",
  name_required: "Please fill in the names.",
  not_allowed: "Only the school admin can do that.",
  signed_out: "You were logged out. Please log in again.",
  too_many_accounts: "This school has reached the limit of 300 accounts.",
};
export function message(err) {
  const code = err?.code || "";
  if (code.startsWith("locked:")) {
    const min = Math.max(1, Math.ceil(Number(code.slice(7)) / 60));
    return `Too many wrong tries. Try again in ${min} minute${min === 1 ? "" : "s"}.`;
  }
  return MESSAGES[code] || "Something went wrong. Please try again.";
}
