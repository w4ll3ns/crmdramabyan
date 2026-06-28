import { useCallback, useEffect, useRef, useState } from "react";
import { Play, Pause, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { downloadMedia, filenameFromUrl } from "@/lib/downloadMedia";

// Singleton: garante que apenas um player toca por vez
const activeAudios = new Set<HTMLAudioElement>();
function registerActive(el: HTMLAudioElement) {
  activeAudios.forEach((a) => {
    if (a !== el && !a.paused) a.pause();
  });
  activeAudios.add(el);
}

function fmt(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) seconds = 0;
  const s = Math.floor(seconds % 60);
  const m = Math.floor(seconds / 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function AudioPlayer({
  src,
  filename,
  outbound,
}: {
  src: string;
  filename?: string;
  outbound?: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onLoaded = () => {
      if (!isFinite(el.duration) || el.duration === 0) {
        // Hack para WebM/OGG com duração desconhecida
        const onSeek = () => {
          el.currentTime = 0;
          setDuration(isFinite(el.duration) ? el.duration : 0);
          setReady(true);
          el.removeEventListener("seeked", onSeek);
        };
        el.addEventListener("seeked", onSeek);
        try {
          el.currentTime = 1e9;
        } catch {
          setReady(true);
        }
      } else {
        setDuration(el.duration);
        setReady(true);
      }
    };
    const onTime = () => setCurrent(el.currentTime);
    const onPlay = () => {
      registerActive(el);
      setPlaying(true);
    };
    const onPause = () => setPlaying(false);
    const onEnded = () => {
      setPlaying(false);
      setCurrent(0);
    };
    el.addEventListener("loadedmetadata", onLoaded);
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("ended", onEnded);
    activeAudios.add(el);
    return () => {
      el.removeEventListener("loadedmetadata", onLoaded);
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("ended", onEnded);
      activeAudios.delete(el);
    };
  }, []);

  const toggle = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) el.play().catch(() => {});
    else el.pause();
  }, []);

  const onSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const el = audioRef.current;
    if (!el || !duration) return;
    const v = Number(e.target.value);
    el.currentTime = (v / 100) * duration;
    setCurrent(el.currentTime);
  };

  const progress = duration > 0 ? (current / duration) * 100 : 0;
  const remaining = playing ? duration - current : duration;

  return (
    <div className={cn("flex items-center gap-3 min-w-[220px] py-1")}>
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Pausar" : "Reproduzir"}
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors",
          outbound
            ? "bg-primary text-primary-foreground hover:bg-primary/90"
            : "bg-primary text-primary-foreground hover:bg-primary/90",
        )}
      >
        {playing ? (
          <Pause className="h-5 w-5" strokeWidth={2} />
        ) : (
          <Play className="h-5 w-5 translate-x-0.5" strokeWidth={2} />
        )}
      </button>

      <div className="flex-1 flex flex-col gap-1">
        <div className="relative h-1 w-full rounded-full bg-muted-foreground/25 overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-primary rounded-full"
            style={{ width: `${progress}%` }}
          />
          <input
            type="range"
            min={0}
            max={100}
            step={0.1}
            value={progress}
            onChange={onSeek}
            disabled={!ready || !duration}
            aria-label="Posição do áudio"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
        </div>
        <div className="text-[10px] tabular-nums text-muted-foreground">
          {playing ? `-${fmt(remaining)}` : fmt(duration)}
        </div>
      </div>

      <button
        type="button"
        onClick={() => downloadMedia(src, filename || filenameFromUrl(src, "audio"))}
        aria-label="Baixar áudio"
        className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
      >
        <Download className="h-4 w-4" strokeWidth={1.75} />
      </button>

      <audio ref={audioRef} src={src} preload="metadata" className="hidden" />
    </div>
  );
}
