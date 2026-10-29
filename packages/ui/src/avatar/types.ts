// packages/ui/src/avatar/types.ts
//
// Shared vocabulary for the MonteAI 3D mascot (web + mobile).
//
// The avatar is a glossy procedural orb rendered with three.js — no binary
// model assets ship in the repo. Chat surfaces drive it with a two-axis
// model:
//   activity — what it is doing right now (idle / thinking / speaking)
//   emotion  — persistent mood derived from the latest answer
//              (cheerful when relevant theses were found, sad when not)

/** What the avatar is doing right now. */
export type AvatarActivity = "idle" | "thinking" | "speaking";

/** Mood inferred from the assistant's latest response. */
export type AvatarEmotion = "neutral" | "cheerful" | "sad";

export interface AvatarState {
  activity: AvatarActivity;
  emotion: AvatarEmotion;
}

/** Optional cursor direction; the engine limits its length to 1. */
export interface AvatarGazeTarget {
  /** Positive looks toward the viewer's right. */
  x: number;
  /** Positive looks up. */
  y: number;
}

/**
 * Imperative surface every host (web canvas / expo-gl) uses to drive the
 * scene. The host owns the requestAnimationFrame loop and calls tick()+render()
 * each frame.
 */
export interface AvatarEngineHandle {
  /** Merge a partial state — unmapped fields keep their current value. */
  setState(state: Partial<AvatarState>): void;
  getState(): AvatarState;
  /** Follow a cursor direction; null restores the autonomous gaze. */
  setGazeTarget(target: AvatarGazeTarget | null): void;
  /** Nudge the mouth — call per streamed delta so speech tracks token cadence. */
  noteDelta(): void;
  /** Play the one-shot greeting wave; speech can continue during the wave. */
  playGreeting(): void;
  /** Advance animations to `nowMs` (milliseconds, any monotonic clock). */
  tick(nowMs: number): void;
  /** Draw one frame. */
  render(): void;
  /** Resize the drawing buffer (and camera aspect). */
  setSize(width: number, height: number, pixelRatio?: number): void;
  /** Release GPU resources — the host stops its own loop separately. */
  dispose(): void;
}
