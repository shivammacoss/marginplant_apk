import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";
import * as Haptics from "expo-haptics";
import { mmkv } from "@core/storage/mmkv";

// Trade-action tones. Plays a short audible cue (and a matching haptic
// pulse) so the user knows the press registered even when the screen is
// in the middle of an animation. Three logical events:
//
//   • buy   — green confirmation
//   • sell  — red/orange confirmation
//   • close — softer click for position close / cancel
//
// Sources are wired at RUNTIME via `setSoundSource(kind, source)` rather
// than `require()`'d at module load. Metro resolves require() paths at
// build time, so referencing missing files (`assets/sounds/buy.mp3`)
// would have hard-failed the whole bundle — that's the
// "UnableToResolveError ../../../assets/sounds/buy.mp3" the user hit.
// Runtime registration means the bundle compiles fine even with zero
// sound files, AND any of:
//   • Bundled asset:  setSoundSource('buy', require('@/assets/...mp3'))
//   • Remote URL:     setSoundSource('buy', 'https://example.com/buy.mp3')
//   • URI object:     setSoundSource('buy', { uri: 'file://...' })
// can be plugged in from `app/_layout.tsx` or AppProviders.
//
// Until something is registered the service runs haptic-only — every
// BUY/SELL/close still gives the user a tactile pulse, just no tone.

type SoundKind = "buy" | "sell" | "close";

// expo-audio accepts a string (URL/path), a number (require()'d asset),
// `null`, or an object with a `uri` field. We accept the union so any
// source type works.
type SoundSource = string | number | { uri: string } | null | undefined;

const STORAGE_KEY = "nb.soundsEnabled";

const SOURCES: Record<SoundKind, SoundSource> = {
  buy: null,
  sell: null,
  close: null,
};

/**
 * Register the audio source for a sound. Call this once during app boot
 * (e.g. in app/_layout.tsx). Pass `null` to clear and fall back to
 * haptic-only. Re-registering replaces the previous source — the
 * cached player is torn down so the next play uses the new source.
 */
export function setSoundSource(kind: SoundKind, source: SoundSource): void {
  SOURCES[kind] = source;
  const old = PLAYERS[kind];
  if (old) {
    try {
      old.remove();
    } catch {
      /* ignore — player may already be released */
    }
    delete PLAYERS[kind];
  }
  // Re-preload immediately if preload was already triggered, so the
  // first tap after a setSoundSource call is still instant.
  if (preloadStarted && source != null) {
    try {
      PLAYERS[kind] = createAudioPlayer(source);
    } catch {
      /* invalid source — silent fallback */
    }
  }
}

// One AudioPlayer per sound is enough — calling `seekTo(0) + play()` on
// the cached player is what gives the "click → tone immediately" feel.
// Recreating the player every call has a noticeable lag on Android.
const PLAYERS: Partial<Record<SoundKind, AudioPlayer>> = {};
let audioModeReady = false;
let preloadStarted = false;

/**
 * Eagerly initialise the audio session and decode every bundled tone.
 * Call this ONCE early in the app lifecycle (e.g. in AppProviders mount)
 * so the very first BUY/SELL/close press fires its tone on the same
 * frame as the tap. Without preload the first tap pays for:
 *   • `setAudioModeAsync` (~50-100ms on Android)
 *   • `createAudioPlayer` decode of the MP3 (~30-80ms)
 * which together feel like a "tone arrived 100-200 ms late" miss.
 * Subsequent taps are already fast — preload removes the first-tap tax.
 */
export function preloadSounds(): void {
  if (preloadStarted) return;
  preloadStarted = true;
  // Set audio mode synchronously-fire-async so subsequent plays don't
  // need to wait on the promise.
  void setAudioModeAsync({
    playsInSilentMode: true,
    shouldPlayInBackground: false,
    interruptionMode: "mixWithOthers",
  }).then(() => {
    audioModeReady = true;
  }).catch(() => {
    // Even if setAudioMode fails, mark ready so plays don't block.
    audioModeReady = true;
  });
  // Decode every registered tone up front. Each createAudioPlayer call
  // blocks for ~30-80 ms decode on Android — doing it now (during the
  // splash → home transition) is invisible; doing it on the first tap
  // is the lag the user is complaining about.
  for (const kind of ["buy", "sell", "close"] as const) {
    const src = SOURCES[kind];
    if (src == null) continue;
    try {
      PLAYERS[kind] = createAudioPlayer(src);
    } catch {
      /* invalid source is fine — falls back to haptic-only */
    }
  }
}

function getPlayer(kind: SoundKind): AudioPlayer | null {
  if (PLAYERS[kind]) return PLAYERS[kind] as AudioPlayer;
  const src = SOURCES[kind];
  if (src == null) return null;
  try {
    const p = createAudioPlayer(src);
    PLAYERS[kind] = p;
    return p;
  } catch {
    return null;
  }
}

function hapticFor(kind: SoundKind): void {
  // Haptic always fires regardless of audio availability — gives users
  // on Android (without bundled sound files) the same instant feedback.
  switch (kind) {
    case "buy":
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return;
    case "sell":
      // Use Warning for SELL so it feels distinct from BUY without
      // sounding alarming the way Error does.
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    case "close":
      void Haptics.selectionAsync();
      return;
  }
}

function soundsEnabled(): boolean {
  // Default ON. Stored as boolean in mmkv so the Settings → Sounds toggle
  // can flip it without a roundtrip.
  const v = mmkv.getBoolean(STORAGE_KEY);
  return v == null ? true : v;
}

export function setSoundsEnabled(enabled: boolean): void {
  mmkv.setBoolean(STORAGE_KEY, enabled);
}

export function areSoundsEnabled(): boolean {
  return soundsEnabled();
}

export function play(kind: SoundKind): void {
  // Haptic first — cheap, synchronous, fires on the same JS tick as the
  // press regardless of whether audio is ready.
  hapticFor(kind);
  if (!soundsEnabled()) return;
  // Kick off preload on demand if the app forgot to call it during boot.
  // After the first invocation this is a no-op so it's cheap to call
  // unconditionally here as a safety net.
  if (!preloadStarted) preloadSounds();
  const player = getPlayer(kind);
  if (player == null) return;
  // Synchronous play — no awaiting setAudioModeAsync. expo-audio's
  // play() returns immediately and the OS schedules the actual audio
  // on its own thread, so even if audio mode is still in flight the
  // tone lands the same frame as the press on warmed-up devices.
  try {
    player.seekTo(0);
    player.play();
  } catch {
    /* swallow — a missing/corrupt sound must not break trading */
  }
}

export const sounds = {
  buy: () => play("buy"),
  sell: () => play("sell"),
  close: () => play("close"),
  play,
};
