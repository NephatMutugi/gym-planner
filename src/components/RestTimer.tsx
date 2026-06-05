"use client";

/**
 * Floating rest-timer chip. Sits at the bottom-right of the screen, above the
 * mobile bottom nav and the iOS home-indicator safe area. The parent controls
 * the timer via two props:
 *
 *   - `duration`: total seconds to count down from (set when a set is logged)
 *   - `restartKey`: any value that changes when the parent wants the timer
 *     reset/restarted (typically a stable key for the just-logged set)
 *
 * When the timer hits zero it plays a soft beep, vibrates (if supported), and
 * stays at "Done" until the user dismisses or another set is logged. Tapping
 * the chip expands a small panel with Skip / +30s / Restart actions.
 *
 * The Web Audio context can only be created after a user gesture. We create it
 * lazily on the first user interaction with the chip and reuse it from then
 * on; this matches what every audio-using PWA does.
 */

import { useCallback, useEffect, useRef, useState } from "react";

export interface RestTimerProps {
  duration: number | null; // seconds; null = idle
  restartKey: string | null; // bump to restart
  enabled?: boolean; // false hides the chip entirely
}

export default function RestTimer({
  duration,
  restartKey,
  enabled = true,
}: RestTimerProps) {
  // Remaining seconds. -1 = idle/hidden.
  const [remaining, setRemaining] = useState<number>(-1);
  const [open, setOpen] = useState(false);
  // Track the end timestamp so backgrounding/foregrounding the tab doesn't drift.
  const endAtRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const beepedRef = useRef(false);

  // Start / restart whenever the (duration, restartKey) combo changes.
  useEffect(() => {
    if (!enabled || duration == null || duration <= 0 || !restartKey) return;
    endAtRef.current = Date.now() + duration * 1000;
    beepedRef.current = false;
    setRemaining(duration);
    setOpen(false);
    // Loop
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(tick, 250);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration, restartKey, enabled]);

  // tick — read from endAt so accuracy survives backgrounding.
  // beep/vibrate are intentionally stable closures (they only touch refs and
  // browser globals), so the empty dep array is correct here.
  const tick = useCallback(() => {
    if (endAtRef.current == null) return;
    const remainingMs = endAtRef.current - Date.now();
    const next = Math.max(0, Math.ceil(remainingMs / 1000));
    setRemaining(next);
    if (next === 0 && !beepedRef.current) {
      beepedRef.current = true;
      beep();
      vibrate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      audioCtxRef.current?.close().catch(() => {});
    };
  }, []);

  // Resume audio context on visibilitychange — iOS sometimes suspends it.
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible" && audioCtxRef.current?.state === "suspended") {
        audioCtxRef.current.resume().catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  function ensureAudio() {
    if (audioCtxRef.current) return audioCtxRef.current;
    try {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctor) return null;
      audioCtxRef.current = new Ctor();
      return audioCtxRef.current;
    } catch {
      return null;
    }
  }

  function beep() {
    const ctx = ensureAudio();
    if (!ctx) return;
    // Two short tones — gentle, not alarming. ~150ms each, ~120ms gap.
    const now = ctx.currentTime;
    const tone = (start: number, freq: number, dur: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.connect(ctx.destination);
      // Gentle attack/release envelope to avoid clicks
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.18, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      osc.start(start);
      osc.stop(start + dur + 0.02);
    };
    tone(now, 660, 0.16);
    tone(now + 0.22, 880, 0.16);
  }

  function vibrate() {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate?.([180, 80, 180]);
      } catch {
        /* ignore */
      }
    }
  }

  function skip() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    endAtRef.current = null;
    setRemaining(-1);
    setOpen(false);
  }

  function addSeconds(s: number) {
    if (endAtRef.current == null) return;
    endAtRef.current += s * 1000;
    beepedRef.current = false; // re-arm beep if we crossed back above 0
    tick();
  }

  function restart() {
    if (!duration) return;
    endAtRef.current = Date.now() + duration * 1000;
    beepedRef.current = false;
    setRemaining(duration);
    setOpen(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(tick, 250);
  }

  // Prime audio context the first time the user touches the chip — this turns
  // the tap into the "user gesture" the AudioContext needs.
  function handleChipClick() {
    ensureAudio();
    setOpen((v) => !v);
  }

  if (!enabled || remaining < 0) return null;

  const total = duration ?? remaining;
  const pct = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0;
  const isDone = remaining === 0;

  return (
    <div
      className="fixed z-40 right-4 select-none"
      style={{
        // Float above bottom nav on mobile (~56px tall + safe area) and above
        // the keyboard / page bottom on desktop.
        bottom: `calc(env(safe-area-inset-bottom, 0px) + 72px)`,
      }}
      aria-live="polite"
    >
      {open && (
        <div className="mb-2 card flex flex-col gap-2 p-3 shadow-lg">
          <button
            type="button"
            onClick={skip}
            className="text-sm text-left py-1 px-2 rounded-md hover:bg-[var(--bg)]"
          >
            Skip rest
          </button>
          <button
            type="button"
            onClick={() => addSeconds(30)}
            className="text-sm text-left py-1 px-2 rounded-md hover:bg-[var(--bg)]"
          >
            +30s
          </button>
          <button
            type="button"
            onClick={restart}
            className="text-sm text-left py-1 px-2 rounded-md hover:bg-[var(--bg)]"
          >
            Restart
          </button>
        </div>
      )}
      <button
        type="button"
        onClick={handleChipClick}
        aria-label={
          isDone
            ? "Rest done — tap to dismiss or extend"
            : `Rest timer: ${remaining} seconds remaining`
        }
        className={
          "flex items-center gap-2 rounded-full pl-2 pr-3 py-2 shadow-lg transition-colors " +
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] " +
          (isDone
            ? "bg-[var(--accent)] text-[var(--accent-fg)] font-semibold"
            : "bg-[var(--bg-elev)] border border-[var(--border)] text-[var(--fg)]")
        }
      >
        <RingProgress pct={pct} done={isDone} />
        <span className="font-mono text-sm tabular-nums">
          {isDone ? "Done" : `${formatTime(remaining)}`}
        </span>
      </button>
    </div>
  );
}

function formatTime(s: number): string {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

function RingProgress({ pct, done }: { pct: number; done: boolean }) {
  const r = 10;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pct);
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
      <circle
        cx="12"
        cy="12"
        r={r}
        fill="none"
        stroke="var(--border)"
        strokeWidth="2.5"
      />
      <circle
        cx="12"
        cy="12"
        r={r}
        fill="none"
        stroke={done ? "var(--accent-fg)" : "var(--accent)"}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        transform="rotate(-90 12 12)"
        style={{ transition: "stroke-dashoffset 0.25s linear" }}
      />
    </svg>
  );
}
