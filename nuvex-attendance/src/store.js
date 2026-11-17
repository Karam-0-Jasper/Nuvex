// Everything is saved on this device. No account, no server.
const KEY = "na.sheets";
const OLD_KEY = "na.groups";

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

const pad = (n) => String(n).padStart(2, "0");
export const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fromKey = (k) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };

export function newSheet(name) {
  return { id: uid(), name, people: [], cols: [dayKey(new Date())], marks: {} };
}

/** Registers from the first version of the app become sheets (late counts as present, excused as absent). */
function fromOld(groups) {
  return groups.map((g) => {
    const marks = {};
    for (const [day, m] of Object.entries(g.days || {})) {
      for (const [pid, s] of Object.entries(m)) marks[`${pid}|${day}`] = s === "p" || s === "l" ? "p" : "a";
    }
    return { id: g.id, name: g.name || "Class", people: g.people || [], cols: Object.keys(g.days || {}).sort(), marks };
  });
}

export function loadSheets() {
  try {
    const now = JSON.parse(localStorage.getItem(KEY));
    if (Array.isArray(now) && now.length) return now;
    const old = JSON.parse(localStorage.getItem(OLD_KEY));
    if (Array.isArray(old) && old.length) return fromOld(old);
  } catch { /* blocked or broken storage */ }
  return [newSheet("Class 1")];
}
export function saveSheets(sheets) {
  try { localStorage.setItem(KEY, JSON.stringify(sheets)); } catch { /* storage full or blocked */ }
}
export function loadActive() { try { return localStorage.getItem("na.active"); } catch { return null; } }
export function saveActive(id) { try { localStorage.setItem("na.active", id); } catch { /* ignore */ } }

export function download(filename, text, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text; document.body.appendChild(ta); ta.select();
      const ok = document.execCommand("copy"); ta.remove(); return ok;
    } catch { return false; }
  }
}
