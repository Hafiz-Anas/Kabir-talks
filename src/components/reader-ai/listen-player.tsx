"use client";

import { Headphones, Pause, Play, RotateCcw, X } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import type { Locale } from "@/i18n";
import type { ListenResponse, ReaderAiError } from "@/lib/ai/reader";
import { CHUNK_PAUSE_MS } from "@/lib/ai/speech";
import { cn } from "@/lib/utils";

import { pickVoice } from "./browser-voice";
import { errorMessage, type ReaderAiLabels, responseError } from "./labels";

/**
 * Listen (lazy-loaded when the reader presses Listen): a small player fixed
 * to the bottom of the screen, so it keeps playing while the reader scrolls.
 *
 * Plays the generated audio when the server has a current file for this
 * language; otherwise reads the title and paragraphs with the browser's own
 * voice (Web Speech API), sentence by sentence. Readers never cause audio
 * to be generated: the endpoint is read-only.
 */

const SPEEDS = [0.75, 1, 1.25, 1.5] as const;
/** Rough speaking pace for the browser voice's time display (characters per second at 1x). */
const CHARS_PER_SECOND = 14;

type Engine = {
  kind: "audio" | "speech";
  play: () => void;
  pause: () => void;
  /** 0-1 */
  seek: (fraction: number) => void;
  setRate: (rate: number) => void;
  destroy: () => void;
};

type Progress = { position: number; duration: number; playing: boolean };

const time = (seconds: number) => {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

function audioEngine(url: string, onProgress: (p: Progress) => void, onError: () => void): Engine {
  const audio = new Audio();
  audio.preload = "metadata";
  audio.src = url;
  const report = () =>
    onProgress({ position: audio.currentTime, duration: Number.isFinite(audio.duration) ? audio.duration : 0, playing: !audio.paused && !audio.ended });
  for (const event of ["timeupdate", "loadedmetadata", "play", "pause", "ended", "ratechange"]) audio.addEventListener(event, report);
  audio.addEventListener("error", onError);
  return {
    kind: "audio",
    play: () => void audio.play().catch(onError),
    pause: () => audio.pause(),
    seek: (fraction) => {
      if (Number.isFinite(audio.duration)) audio.currentTime = fraction * audio.duration;
    },
    setRate: (rate) => {
      audio.playbackRate = rate;
    },
    destroy: () => {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    },
  };
}

/** Sentence-sized pieces: long utterances stop early in some browsers. */
function segmentsOf(paragraphs: string[]) {
  const out: { text: string; paragraphEnd: boolean }[] = [];
  for (const paragraph of paragraphs) {
    const sentences = paragraph.split(/(?<=[.!?۔؟])\s+/).flatMap((s) => s.match(/.{1,220}(?=\s|$)/gu) ?? [s]);
    sentences.forEach((text, i) => out.push({ text: text.trim(), paragraphEnd: i === sentences.length - 1 }));
  }
  return out.filter((segment) => segment.text);
}

function speechEngine(paragraphs: string[], locale: Locale, onProgress: (p: Progress) => void): Engine {
  const synth = window.speechSynthesis;
  const segments = segmentsOf(paragraphs);
  const starts: number[] = [];
  let total = 0;
  for (const segment of segments) {
    starts.push(total);
    total += segment.text.length;
  }
  let index = 0;
  let rate = 1;
  let playing = false;
  let run = 0; // ignores end events from utterances we cancelled
  let pauseTimer: ReturnType<typeof setTimeout> | undefined;

  const report = () =>
    onProgress({ position: (starts[index] ?? total) / CHARS_PER_SECOND, duration: total / CHARS_PER_SECOND, playing });

  const speak = () => {
    const current = ++run;
    clearTimeout(pauseTimer);
    synth.cancel();
    if (index >= segments.length) {
      playing = false;
      index = 0;
      report();
      return;
    }
    const utterance = new SpeechSynthesisUtterance(segments[index].text);
    const voice = pickVoice(locale);
    if (voice) utterance.voice = voice;
    utterance.lang = voice?.lang ?? (locale === "ur" ? "ur-PK" : "en-GB");
    utterance.rate = rate;
    utterance.onend = () => {
      if (current !== run || !playing) return;
      const pause = segments[index].paragraphEnd ? CHUNK_PAUSE_MS : 0;
      index++;
      report();
      pauseTimer = setTimeout(() => current === run && playing && speak(), pause);
    };
    utterance.onerror = () => {
      if (current !== run) return;
      playing = false;
      report();
    };
    synth.speak(utterance);
    report();
  };

  return {
    kind: "speech",
    play: () => {
      playing = true;
      speak();
    },
    // Cancelling (rather than synth.pause) works with every voice; Play resumes at the current sentence.
    pause: () => {
      playing = false;
      run++;
      clearTimeout(pauseTimer);
      synth.cancel();
      report();
    },
    seek: (fraction) => {
      const target = fraction * total;
      index = Math.max(0, starts.findLastIndex((start) => start <= target));
      if (playing) speak();
      else report();
    },
    setRate: (next) => {
      rate = next;
      if (playing) speak();
    },
    destroy: () => {
      playing = false;
      run++;
      clearTimeout(pauseTimer);
      synth.cancel();
    },
  };
}

export default function ListenPlayer({
  articleId,
  locale,
  labels,
  onClose,
}: {
  articleId: string;
  locale: Locale;
  labels: ReaderAiLabels;
  onClose: () => void;
}) {
  const [status, setStatus] = useState<"loading" | "ready" | ReaderAiError | "offline">("loading");
  const [kind, setKind] = useState<Engine["kind"] | null>(null);
  const [progress, setProgress] = useState<Progress>({ position: 0, duration: 0, playing: false });
  const [rate, setRate] = useState(1);
  const engine = useRef<Engine | null>(null);
  const playButton = useRef<HTMLButtonElement>(null);
  const speedId = useId();

  const load = useCallback(async (signal: AbortSignal) => {
    setStatus("loading");
    let data: ListenResponse;
    try {
      const res = await fetch(`/api/ai/listen?articleId=${articleId}&locale=${locale}`, { cache: "no-store", signal });
      if (!res.ok) {
        setStatus(await responseError(res));
        return;
      }
      data = (await res.json()) as ListenResponse;
    } catch {
      if (!signal.aborted) setStatus("offline");
      return;
    }
    if (signal.aborted) return;
    engine.current?.destroy();
    if (data.audio) {
      engine.current = audioEngine(data.audio.url, setProgress, () => setStatus("unavailable"));
      setProgress({ position: 0, duration: data.audio.durationMs / 1000, playing: false });
    } else if (pickVoice(locale)) {
      engine.current = speechEngine(data.speech.paragraphs, locale, setProgress);
    } else {
      setStatus("not_found");
      return;
    }
    setKind(engine.current.kind);
    setStatus("ready");
    engine.current.play();
  }, [articleId, locale]);

  useEffect(() => {
    const controller = new AbortController();
    // Loading on mount is the player's whole job: it only mounts when the reader presses Listen.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(controller.signal);
    return () => {
      controller.abort();
      engine.current?.destroy();
      engine.current = null;
    };
  }, [load]);

  useEffect(() => {
    if (status === "ready") playButton.current?.focus();
  }, [status]);

  // Keep the page's last lines (footer) reachable above the fixed player.
  useEffect(() => {
    const previous = document.body.style.paddingBottom;
    document.body.style.paddingBottom = "6rem";
    return () => {
      document.body.style.paddingBottom = previous;
    };
  }, []);

  const fraction = progress.duration ? Math.min(1, progress.position / progress.duration) : 0;
  const control =
    "grid size-10 shrink-0 place-items-center rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

  return (
    <div
      role="region"
      aria-label={labels.listenTitle}
      dir={locale === "ur" ? "rtl" : "ltr"}
      data-testid="listen-player"
      data-engine={kind ?? undefined}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-gold-muted/40 bg-obsidian/95 shadow-[0_-8px_24px_rgba(0,0,0,0.4)] backdrop-blur"
    >
      <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3 sm:px-6">
        {status === "ready" ? (
          <button
            ref={playButton}
            type="button"
            data-testid="listen-toggle"
            aria-label={progress.playing ? labels.pause : labels.play}
            onClick={() => (progress.playing ? engine.current?.pause() : engine.current?.play())}
            className={cn(control, "bg-gold text-black hover:bg-gold-soft")}
          >
            {progress.playing ? <Pause aria-hidden className="size-5 fill-current" /> : <Play aria-hidden className="size-5 fill-current rtl:-scale-x-100" />}
          </button>
        ) : (
          <span className={cn(control, "bg-obsidian-raised text-gold")}>
            <Headphones aria-hidden className="size-5" />
          </span>
        )}

        <div className="min-w-0 flex-1 space-y-1">
          <p className="flex items-center gap-2 truncate text-sm text-ivory">
            {labels.listenTitle}
            {kind && <span className="text-xs text-grey">· {kind === "audio" ? labels.aiVoice : labels.browserVoice}</span>}
          </p>
          {status === "ready" ? (
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={1000}
                step={1}
                value={Math.round(fraction * 1000)}
                onChange={(event) => engine.current?.seek(Number(event.target.value) / 1000)}
                aria-label={labels.position}
                aria-valuetext={`${time(progress.position)} / ${time(progress.duration)}`}
                data-testid="listen-progress"
                className="h-1.5 min-w-0 flex-1 cursor-pointer accent-[var(--color-gold)]"
              />
              <span className="shrink-0 text-xs text-grey tabular-nums" dir="ltr" data-testid="listen-time">
                {time(progress.position)} / {time(progress.duration)}
              </span>
            </div>
          ) : status === "loading" ? (
            <div role="status" className="flex items-center gap-2 text-xs text-grey">
              <span className="h-1.5 flex-1 animate-pulse rounded-full bg-obsidian-raised" />
              {labels.listenLoading}
            </div>
          ) : (
            <div role="alert" className="flex flex-wrap items-center gap-2 text-xs text-destructive" data-testid="listen-error">
              {errorMessage(status, labels)}
              {status !== "not_found" && status !== "resting" && (
                <button
                  type="button"
                  onClick={() => void load(new AbortController().signal)}
                  className="inline-flex items-center gap-1 text-gold hover:text-gold-soft focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <RotateCcw aria-hidden className="size-3" />
                  {labels.retry}
                </button>
              )}
            </div>
          )}
        </div>

        {status === "ready" && (
          <>
            <label htmlFor={speedId} className="sr-only">
              {labels.speed}
            </label>
            <select
              id={speedId}
              dir="ltr"
              value={rate}
              data-testid="listen-speed"
              onChange={(event) => {
                const next = Number(event.target.value);
                setRate(next);
                engine.current?.setRate(next);
              }}
              className="h-9 shrink-0 rounded-sm border border-border bg-obsidian px-2 text-sm text-ivory focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {SPEEDS.map((speed) => (
                <option key={speed} value={speed}>
                  {speed}×
                </option>
              ))}
            </select>
          </>
        )}

        <button
          type="button"
          onClick={onClose}
          aria-label={labels.closePlayer}
          data-testid="listen-close"
          className={cn(control, "size-9 text-grey hover:text-ivory")}
        >
          <X aria-hidden className="size-4" />
        </button>
      </div>
    </div>
  );
}
