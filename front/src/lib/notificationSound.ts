/**
 * Lightweight notification beep using the Web Audio API.
 *
 * We intentionally avoid shipping an audio file: the sound is synthesized
 * on-the-fly so no extra asset / bundler config is needed. The tone is a
 * short, friendly two-note "ding" that works well on both desktop and mobile.
 *
 * Usage:
 *   import { playNotificationSound } from "@/lib/notificationSound";
 *   playNotificationSound(); // safe to call anywhere in the app
 *
 * Notes:
 * - Most browsers block audio until the user has interacted with the page.
 *   The first `playNotificationSound()` call that happens before any user
 *   gesture will be silently dropped; subsequent ones after a click/tap/key
 *   press will work.
 * - This file is side-effect-free on import (the AudioContext is created
 *   lazily only the first time we need to play).
 */

let sharedCtx: AudioContext | null = null;

const getContext = (): AudioContext | null => {
  if (typeof window === "undefined") return null;
  if (sharedCtx) return sharedCtx;
  const Ctor: typeof AudioContext | undefined =
    (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!Ctor) return null;
  try {
    sharedCtx = new Ctor();
    return sharedCtx;
  } catch {
    return null;
  }
};

const playTone = (
  ctx: AudioContext,
  startAt: number,
  frequency: number,
  duration: number,
  gainPeak = 0.25,
) => {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(frequency, startAt);

  // Quick attack, gentle release — avoids audible clicks.
  gain.gain.setValueAtTime(0, startAt);
  gain.gain.linearRampToValueAtTime(gainPeak, startAt + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(startAt);
  osc.stop(startAt + duration + 0.05);
};

export const playNotificationSound = (): void => {
  const ctx = getContext();
  if (!ctx) return;

  // Browsers may have suspended the context until a user gesture happens.
  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {
      /* silently ignore — will work on next user interaction */
    });
  }

  try {
    const now = ctx.currentTime;
    // Two-note "ding": G5 then C6 (pleasant rising interval).
    playTone(ctx, now, 784.0, 0.18);
    playTone(ctx, now + 0.14, 1046.5, 0.22);
  } catch {
    /* silent — audio is a nice-to-have */
  }
};