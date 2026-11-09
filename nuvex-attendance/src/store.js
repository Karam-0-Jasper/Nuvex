// Everything is saved on this device. No account, no server.
const KEY = "na.groups";

const read = () => {
  try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; }
};
const write = (v) => {
  try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* storage full or blocked */ }
};

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export const loadRegisters = read;
export const getRegister = (id) => read().find((r) => r.id === id);
export function saveRegister(reg) {
  write([{ ...reg, updated: Date.now() }, ...read().filter((r) => r.id !== reg.id)]);
}
export const deleteRegister = (id) => write(read().filter((r) => r.id !== id));

export function download(filename, text, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const timeAgo = (t) => {
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short", year: new Date(t).getFullYear() === new Date().getFullYear() ? undefined : "numeric" });
};
