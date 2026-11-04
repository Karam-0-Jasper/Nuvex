// Interview integrity checks. Deliberately limited to signals that indicate cheating:
// face present, more than one person in view, leaving the tab or window, copying/pasting, leaving full screen.
// Nothing here measures appearance, expression, accent or emotion, and no images leave the device.

let detectorPromise = null;

/** Loads the on-device face detector once (files are self-hosted under /mediapipe). Resolves to null if unavailable. */
export function loadFaceDetector() {
  if (!detectorPromise) {
    detectorPromise = (async () => {
      const { FilesetResolver, FaceDetector } = await import("@mediapipe/tasks-vision");
      const fileset = await FilesetResolver.forVisionTasks("/mediapipe");
      const make = (delegate) => FaceDetector.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: "/mediapipe/face_detector.tflite", delegate },
        runningMode: "VIDEO",
        minDetectionConfidence: 0.5,
      });
      try { return await make("GPU"); } catch { return await make("CPU"); }
    })().catch(() => null);
  }
  return detectorPromise;
}

/** Count faces in the current video frame, or null if detection isn't possible right now. */
export function countFaces(detector, video) {
  if (!detector || !video || video.readyState < 2 || !video.videoWidth) return null;
  try {
    return detector.detectForVideo(video, performance.now()).detections.length;
  } catch {
    return null;
  }
}

export function createMonitor(onEvent) {
  const t0 = Date.now();
  const events = [];
  const s = { samples: 0, withFace: 0, hiddenAt: 0, awayMs: 0, leaves: 0, noFaceAt: 0, noFaceFlag: false, multiAt: 0, multiFlag: false, multiCount: 0, wasFull: false, faceCheck: false };
  const at = () => Math.round((Date.now() - t0) / 1000);
  const log = (type, text) => { events.push({ t: at(), type, text }); onEvent?.(events[events.length - 1]); };

  const onVisibility = () => {
    if (document.hidden) { s.hiddenAt = Date.now(); s.leaves++; log("away", "Left the interview tab"); }
    else if (s.hiddenAt) { const ms = Date.now() - s.hiddenAt; s.awayMs += ms; s.hiddenAt = 0; log("back", `Returned after ${Math.round(ms / 1000)}s`); }
  };
  const onBlur = () => setTimeout(() => { if (!document.hidden && !document.hasFocus()) { s.leaves++; log("away", "Switched to another window"); } }, 120);
  const onFullscreen = () => {
    if (document.fullscreenElement) s.wasFull = true;
    else if (s.wasFull) log("fullscreen", "Exited full screen");
  };
  const block = (label) => (e) => { e.preventDefault(); log("clipboard", label); };
  const onCopy = block("Tried to copy"); const onPaste = block("Tried to paste"); const onCut = block("Tried to cut");
  const onMenu = (e) => e.preventDefault();

  return {
    events,
    start() {
      document.addEventListener("visibilitychange", onVisibility);
      window.addEventListener("blur", onBlur);
      document.addEventListener("fullscreenchange", onFullscreen);
      document.addEventListener("copy", onCopy);
      document.addEventListener("paste", onPaste);
      document.addEventListener("cut", onCut);
      document.addEventListener("contextmenu", onMenu);
    },
    stop() {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("fullscreenchange", onFullscreen);
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("paste", onPaste);
      document.removeEventListener("cut", onCut);
      document.removeEventListener("contextmenu", onMenu);
    },
    /** Feed one face count (or null when detection is unavailable). Returns "ok" | "none" | "multiple" | null. */
    sample(n) {
      if (n == null) return null;
      s.faceCheck = true;
      s.samples++;
      const now = Date.now();
      if (n >= 1) s.withFace++;
      if (n === 0) {
        if (!s.noFaceAt) s.noFaceAt = now;
        else if (!s.noFaceFlag && now - s.noFaceAt > 4000) { s.noFaceFlag = true; log("face", "Face not visible"); }
      } else {
        if (s.noFaceFlag) log("face-back", `Face visible again after ${Math.round((now - s.noFaceAt) / 1000)}s`);
        s.noFaceAt = 0; s.noFaceFlag = false;
      }
      if (n > 1) {
        if (!s.multiAt) s.multiAt = now;
        else if (!s.multiFlag && now - s.multiAt > 2000) { s.multiFlag = true; s.multiCount++; log("people", "More than one person in view"); }
      } else { s.multiAt = 0; s.multiFlag = false; }
      return n === 0 ? "none" : n > 1 ? "multiple" : "ok";
    },
    summary() {
      return {
        durationSec: at(),
        faceCheck: s.faceCheck,
        facePct: s.samples ? Math.round((s.withFace / s.samples) * 100) : null,
        leaves: s.leaves,
        awaySec: Math.round(s.awayMs / 1000),
        multiplePeople: s.multiCount,
        clipboard: events.filter((e) => e.type === "clipboard").length,
        events: events.slice(0, 200),
      };
    },
  };
}

/** Plain-language flags for the hiring team. Empty array means nothing unusual was seen. */
export function integrityFlags(sum) {
  if (!sum) return [];
  const f = [];
  if (sum.leaves) f.push(`Left the interview ${sum.leaves} time${sum.leaves > 1 ? "s" : ""}${sum.awaySec ? ` (${sum.awaySec}s away)` : ""}`);
  if (sum.multiplePeople) f.push("Another person appeared on camera");
  if (sum.faceCheck && sum.facePct != null && sum.facePct < 80) f.push(`Face visible ${sum.facePct}% of the time`);
  if (sum.clipboard) f.push(`${sum.clipboard} copy or paste attempt${sum.clipboard > 1 ? "s" : ""}`);
  if (sum.events?.some((e) => e.type === "fullscreen")) f.push("Exited full screen");
  return f;
}
