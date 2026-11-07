import { UPLOADS } from "./config.js";
import { uid } from "./store.js";

export const uploadsReady = () => !!(UPLOADS.url && UPLOADS.key);

const TYPES = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
};

/** Upload one file; resolves to { name, size, url }. Throws an Error with a message fit to show applicants. */
export async function uploadFile(file) {
  if (!uploadsReady()) throw new Error("File uploads aren't switched on for this form yet.");
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  if (!TYPES[ext]) throw new Error("Please upload a PDF, Word document or image.");
  if (file.size > UPLOADS.maxBytes) throw new Error("That file is over 10 MB. Please upload a smaller one.");
  const path = `uploads/${uid()}${uid()}/${file.name.replace(/[^\w.\-]+/g, "_").slice(-80)}`;
  const res = await fetch(`${UPLOADS.url}/storage/v1/object/${UPLOADS.bucket}/${path}`, {
    method: "POST",
    headers: { apikey: UPLOADS.key, "content-type": TYPES[ext], "x-upsert": "false" },
    body: file,
  });
  if (!res.ok) throw new Error("The upload didn't go through. Check your connection and try again.");
  return { name: file.name, size: file.size, url: `${UPLOADS.url}/storage/v1/object/public/${UPLOADS.bucket}/${path}` };
}
