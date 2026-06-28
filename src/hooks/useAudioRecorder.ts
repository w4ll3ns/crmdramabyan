import { useCallback, useEffect, useRef, useState } from "react";

function pickMime(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
    "audio/mpeg",
  ];
  for (const m of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(m)) return m;
    } catch {
      /* ignore */
    }
  }
  return "";
}

export function extFromMime(mime: string) {
  if (mime.includes("webm")) return "webm";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("mp4")) return "m4a";
  if (mime.includes("mpeg")) return "mp3";
  return "bin";
}

export type RecordingResult = { blob: Blob; mime: string; durationMs: number };

export function useAudioRecorder() {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startedAtRef = useRef<number>(0);
  const cancelledRef = useRef<boolean>(false);
  const resolveRef = useRef<((r: RecordingResult | null) => void) | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const tickRef = useRef<number | null>(null);

  const cleanup = useCallback(() => {
    if (tickRef.current) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
    chunksRef.current = [];
    setIsRecording(false);
    setElapsedMs(0);
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  const start = useCallback(async () => {
    if (recorderRef.current) return;
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      throw new Error("Gravação de áudio não suportada neste navegador.");
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;
    const mime = pickMime();
    const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    chunksRef.current = [];
    cancelledRef.current = false;
    rec.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };
    rec.onstop = () => {
      const finalMime = rec.mimeType || mime || "audio/webm";
      const blob = new Blob(chunksRef.current, { type: finalMime });
      const duration = Date.now() - startedAtRef.current;
      const result: RecordingResult | null = cancelledRef.current
        ? null
        : { blob, mime: finalMime, durationMs: duration };
      cleanup();
      resolveRef.current?.(result);
      resolveRef.current = null;
    };
    recorderRef.current = rec;
    startedAtRef.current = Date.now();
    rec.start();
    setIsRecording(true);
    setElapsedMs(0);
    tickRef.current = window.setInterval(() => {
      setElapsedMs(Date.now() - startedAtRef.current);
    }, 200);
  }, [cleanup]);

  const stop = useCallback((): Promise<RecordingResult | null> => {
    return new Promise((resolve) => {
      const rec = recorderRef.current;
      if (!rec) {
        resolve(null);
        return;
      }
      resolveRef.current = resolve;
      cancelledRef.current = false;
      try {
        rec.stop();
      } catch {
        cleanup();
        resolve(null);
      }
    });
  }, [cleanup]);

  const cancel = useCallback(() => {
    const rec = recorderRef.current;
    if (!rec) return;
    cancelledRef.current = true;
    try {
      rec.stop();
    } catch {
      cleanup();
    }
  }, [cleanup]);

  return { isRecording, elapsedMs, start, stop, cancel };
}
