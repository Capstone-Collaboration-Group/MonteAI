// packages/ui/src/avatar/director.ts
//
// Horizontal "wander" behaviour shared by the web and mobile hosts: the
// avatar strolls within the free space beside the conversation and pauses.
// With an avoid zone it switches bands without crossing the message column.
// A second director can drive the vertical coordinate with the same API.
//
// The director works in plain pixels relative to the host container — it
// never touches the DOM. Hosts own drag input: call beginDrag()/setX()/
// endDrag() from pointer handlers and apply the value returned by tick() to
// their box each frame.

export interface WanderBounds {
  /** Left edge (px) the avatar box may occupy. */
  minX: number;
  /** Right edge (px) for the avatar box's left offset. */
  maxX: number;
  /**
   * Forbidden range for the box's LEFT OFFSET, not its center. The host
   * subtracts the box width from the message column's left edge. Falls
   * back to the full range only when neither side band is available.
   */
  avoidMin?: number;
  avoidMax?: number;
}

export interface WanderDirector {
  /** Advance the walk by `dtSeconds`; returns the new x (px) for the host to apply. */
  tick(dtSeconds: number): number;
  /** Update the allowed range (e.g. on resize); the current x is re-clamped. */
  setBounds(bounds: WanderBounds): void;
  /** Snap x to the nearest allowed band — used while dragging. */
  setX(x: number): void;
  getX(): number;
  /** Hold wandering for at least `seconds` (e.g. right after a drag). */
  pauseFor(seconds: number): void;
  beginDrag(): void;
  endDrag(): void;
}

interface Band {
  start: number;
  end: number;
}

/** Walking speed toward a wander target (px/s). */
const WALK_SPEED = 64;
/** Pause range between strolls (s). */
const IDLE_MIN = 1.6;
const IDLE_JITTER = 2.8;
/** Extra pause after the user drops a drag. */
const AFTER_DRAG_PAUSE = 2.4;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function createWanderDirector(options: {
  bounds: WanderBounds;
  /** Initial x; defaults to the left edge. */
  startX?: number;
}): WanderDirector {
  let bounds: WanderBounds = { ...options.bounds };
  let x = options.startX ?? bounds.minX;
  let target: number | null = null;
  let cooldown = IDLE_MIN * 0.6;
  let dragging = false;
  /** Band chosen last time — the director prefers alternating sides. */
  let lastBand = -1;

  const bands = (): Band[] => {
    const left = bounds.avoidMin;
    const right = bounds.avoidMax;
    if (left == null || right == null) {
      return [{ start: bounds.minX, end: bounds.maxX }];
    }
    const candidates = [
      { start: bounds.minX, end: Math.min(left, bounds.maxX) },
      { start: Math.max(right, bounds.minX), end: bounds.maxX },
    ];
    // Even a zero-width band is usable: the host has already accounted
    // for the avatar footprint, so this represents one safe position.
    const usable = candidates.filter((band) => band.end >= band.start);
    return usable.length > 0 ? usable : [{ start: bounds.minX, end: bounds.maxX }];
  };

  const project = (value: number): number => {
    const list = bands();
    let nearest = clamp(value, list[0].start, list[0].end);
    for (const band of list.slice(1)) {
      const candidate = clamp(value, band.start, band.end);
      if (Math.abs(candidate - value) < Math.abs(nearest - value)) nearest = candidate;
    }
    return nearest;
  };

  x = project(x);

  const pickTarget = (list: Band[]): void => {
    let index = Math.floor(Math.random() * list.length);
    // Prefer hopping to the other side when both bands are available.
    if (list.length > 1 && index === lastBand) index = (index + 1) % list.length;
    lastBand = index;
    const band = list[index];
    const pad = Math.min(16, (band.end - band.start) / 4);
    const span = Math.max(0, band.end - band.start - pad * 2);
    target = band.start + pad + Math.random() * span;
  };

  return {
    tick(dtSeconds: number): number {
      if (dragging) return x;
      const dt = Math.min(Math.max(dtSeconds, 0), 0.05);
      if (cooldown > 0) {
        cooldown -= dt;
        return x;
      }
      if (target === null) pickTarget(bands());
      if (target != null) {
        const delta = target - x;
        const step = Math.min(Math.abs(delta), WALK_SPEED * dt);
        const next = x + (delta < 0 ? -1 : 1) * step;
        const list = bands();
        const inBand = list.some((band) => next >= band.start && next <= band.end);
        // Switch to the destination band at the edge of the gap. Never
        // animate or intercept clicks over the conversation itself.
        const destination = list.find((band) => target != null && target >= band.start && target <= band.end);
        x = inBand ? next : destination ? (delta > 0 ? destination.start : destination.end) : project(next);
        if (Math.abs(target - x) <= 1) {
          x = target;
          target = null;
          cooldown = IDLE_MIN + Math.random() * IDLE_JITTER;
        }
      }
      return x;
    },
    setBounds(next: WanderBounds): void {
      bounds = { ...next };
      x = project(x);
      target = null;
      lastBand = -1;
    },
    setX(next: number): void {
      x = project(next);
      target = null;
    },
    getX(): number {
      return x;
    },
    pauseFor(seconds: number): void {
      if (seconds > cooldown) cooldown = seconds;
    },
    beginDrag(): void {
      dragging = true;
      target = null;
    },
    endDrag(): void {
      dragging = false;
      cooldown = Math.max(cooldown, AFTER_DRAG_PAUSE);
    },
  };
}
