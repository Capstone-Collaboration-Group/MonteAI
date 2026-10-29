// packages/ui/src/avatar/MonteAvatar.tsx
//
// Web host for the 3D mascot: a floating, draggable canvas that wanders the
// blank space beside the conversation (left and right of the centered
// message column).
//
//   - activity/emotion props drive the engine (thinking → speaking → mood).
//   - `pulse` (an incrementing counter, one per streamed delta) nudges the
//     mouth so speech tracks token cadence.
//   - Pointer drag moves the box; a tap/click makes it wave back.
//   - Mouse/pen movement anywhere in the window smoothly steers its eyes.

import { useEffect, useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { createAvatarEngine } from "./engine";
import { createWanderDirector, type WanderDirector } from "./director";
import type { AvatarActivity, AvatarEmotion, AvatarEngineHandle } from "./types";

const EDGE_PAD = 8;
const COLUMN_GAP = 16;
const COMPACT_SIZE = 96;

export interface MonteAvatarProps {
  /** What the avatar is doing right now (idle / thinking / speaking). */
  activity?: AvatarActivity;
  /** Mood derived from the latest answer (neutral / cheerful / sad). */
  emotion?: AvatarEmotion;
  /** Increment once per streamed delta — keeps the mouth in step with tokens. */
  pulse?: number;
  /** Increment to trigger a greeting wave (e.g. when a new chat starts). */
  greetKey?: number;
  /** Play the greeting wave when the avatar first mounts (default true). */
  greetingOnMount?: boolean;
  /** Preferred box size in px; scales down when the side space is narrow. */
  size?: number;
  /**
   * Width of the centered message column to wander around — mirrors
   * ChatView's `max-w-2xl` (672px) so the avatar stays in the side space.
   */
  columnWidth?: number;
  className?: string;
}

export function MonteAvatar({
  activity = "idle",
  emotion = "neutral",
  pulse = 0,
  greetKey = 0,
  greetingOnMount = true,
  size = 180,
  columnWidth = 672,
  className,
}: MonteAvatarProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<AvatarEngineHandle | null>(null);
  const directorRef = useRef<WanderDirector | null>(null);
  const verticalRef = useRef<WanderDirector | null>(null);
  const propsRef = useRef({ activity, emotion, pulse, greetKey });
  const cursorRef = useRef<{ x: number; y: number } | null>(null);
  const dragRef = useRef({
    active: false,
    pointerId: -1,
    grabDx: 0,
    grabDy: 0,
    startX: 0,
    startY: 0,
    moved: 0,
  });

  // Keep a recreated engine in sync even when its geometry changes at the
  // same time as a new response. Mutations stay in effects/handlers.
  useEffect(() => {
    propsRef.current = { activity, emotion, pulse, greetKey };
    engineRef.current?.setState({ activity, emotion });
  }, [activity, emotion, pulse, greetKey]);

  // Engine + render loop + wander bounds. Recreated when the box geometry
  // changes; StrictMode's mount/unmount/remount cycle is handled by full
  // cleanup (dispose) followed by a fresh engine on the same canvas.
  useEffect(() => {
    const canvas = canvasRef.current;
    const box = boxRef.current;
    const parent = box?.parentElement;
    if (!canvas || !box || !parent) return;

    let engine: AvatarEngineHandle;
    try {
      engine = createAvatarEngine({
        canvas,
        width: size,
        height: size,
        pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
      });
    } catch (error) {
      // No WebGL in this context — degrade to a plain chat, never crash it.
      console.error("MonteAI avatar could not start:", error);
      box.style.display = "none";
      return;
    }
    box.style.display = "";
    engineRef.current = engine;
    engine.setState({ activity: propsRef.current.activity, emotion: propsRef.current.emotion });
    if (propsRef.current.pulse > 0) engine.noteDelta();
    if (greetingOnMount) engine.playGreeting();

    const director = createWanderDirector({
      bounds: { minX: 0, maxX: Math.max(0, parent.clientWidth - size) },
    });
    directorRef.current = director;
    const vertical = createWanderDirector({ bounds: { minX: 0, maxX: 0 } });
    verticalRef.current = vertical;

    let measured = false;
    let compact = false;
    let drawable = false;
    let renderSize = size;
    let pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    const measure = (): void => {
      const width = parent.clientWidth;
      const height = parent.clientHeight;
      // The host is the message viewport, not the whole page: neither
      // wandering nor dragging can cover the header, input, or disclaimer.
      const column = Math.min(columnWidth, Math.max(0, width - 48));
      const sideWidth = (width - column) / 2;
      const nextSize = Math.min(size, Math.max(COMPACT_SIZE, sideWidth - COLUMN_GAP - EDGE_PAD));
      const nextRatio = Math.min(window.devicePixelRatio || 1, 2);
      if (nextSize !== renderSize || nextRatio !== pixelRatio) {
        renderSize = nextSize;
        pixelRatio = nextRatio;
        engine.setSize(renderSize, renderSize, pixelRatio);
      }
      compact = sideWidth < renderSize + COLUMN_GAP + EDGE_PAD;
      director.setBounds({
        minX: EDGE_PAD,
        maxX: Math.max(EDGE_PAD, width - renderSize - EDGE_PAD),
        avoidMin: compact ? undefined : sideWidth - COLUMN_GAP - renderSize,
        avoidMax: compact ? undefined : sideWidth + column + COLUMN_GAP,
      });
      vertical.setBounds({
        minX: EDGE_PAD,
        maxX: Math.max(EDGE_PAD, height - renderSize - EDGE_PAD),
      });
      drawable = width >= renderSize + EDGE_PAD * 2 && height >= renderSize + EDGE_PAD * 2;
      box.style.width = `${renderSize}px`;
      box.style.height = `${renderSize}px`;
      box.style.visibility = drawable ? "visible" : "hidden";
      if (!drawable) return;
      if (!measured) {
        measured = true;
        director.setX(width - renderSize - EDGE_PAD);
        vertical.setX(height - renderSize - EDGE_PAD);
      }
      box.style.transform = `translate3d(${director.getX()}px, ${vertical.getX()}px, 0)`;
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(parent);

    // Listen without consuming input. Touch retains the existing automatic
    // gaze; mouse/pen attention is cleared when the cursor/window goes away.
    const trackCursor = (event: PointerEvent): void => {
      if (!event.isPrimary || (event.pointerType !== "mouse" && event.pointerType !== "pen")) return;
      cursorRef.current = { x: event.clientX, y: event.clientY };
    };
    const clearCursor = (): void => {
      cursorRef.current = null;
      engine.setGazeTarget(null);
    };
    const pointerOut = (event: PointerEvent): void => {
      if (event.relatedTarget == null) clearCursor();
    };
    const visibilityChange = (): void => {
      if (document.hidden) clearCursor();
    };
    const pointerOptions = { passive: true, capture: true };
    window.addEventListener("pointermove", trackCursor, pointerOptions);
    window.addEventListener("pointerout", pointerOut, pointerOptions);
    window.addEventListener("pointercancel", clearCursor, pointerOptions);
    window.addEventListener("blur", clearCursor);
    document.addEventListener("visibilitychange", visibilityChange);

    let rafId = 0;
    let last: number | null = null;
    const loop = (now: number): void => {
      if (last == null) last = now;
      const dt = Math.min(Math.max((now - last) / 1000, 0), 0.05);
      last = now;
      if (drawable && !document.hidden) {
        // When there is no blank side space, use a small draggable overlay
        // rather than roaming across the reader's messages.
        const wander = !compact && propsRef.current.activity === "idle";
        const x = wander ? director.tick(dt) : director.getX();
        const y = wander ? vertical.tick(dt) : vertical.getX();
        const cursor = cursorRef.current;
        if (cursor) {
          // Recompute relative to the moving avatar, not the page center.
          // Read layout before writing its transform to avoid layout churn.
          const rect = parent.getBoundingClientRect();
          const dx = cursor.x - (rect.left + x + renderSize / 2);
          const dy = rect.top + y + renderSize * 0.46 - cursor.y;
          const reach = Math.hypot(dx, dy) + renderSize * 0.75;
          engine.setGazeTarget({ x: dx / reach, y: dy / reach });
        }
        box.style.transform = `translate3d(${x}px, ${y}px, 0)`;
        try {
          engine.tick(now);
          engine.render();
        } catch (error) {
          console.warn("MonteAI avatar rendering stopped:", error);
          box.style.visibility = "hidden";
          return;
        }
      }
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafId);
      observer.disconnect();
      window.removeEventListener("pointermove", trackCursor, pointerOptions);
      window.removeEventListener("pointerout", pointerOut, pointerOptions);
      window.removeEventListener("pointercancel", clearCursor, pointerOptions);
      window.removeEventListener("blur", clearCursor);
      document.removeEventListener("visibilitychange", visibilityChange);
      engine.dispose();
      engineRef.current = null;
      directorRef.current = null;
      verticalRef.current = null;
      dragRef.current.active = false;
    };
  }, [size, columnWidth, greetingOnMount]);

  // One nudge per streamed token/delta.
  useEffect(() => {
    if (pulse > 0) engineRef.current?.noteDelta();
  }, [pulse]);

  // Explicit greeting trigger (e.g. "New chat").
  useEffect(() => {
    if (greetKey > 0) engineRef.current?.playGreeting();
  }, [greetKey]);

  const endDrag = (wave: boolean): void => {
    const drag = dragRef.current;
    if (!drag.active) return;
    drag.active = false;
    const box = boxRef.current;
    if (box?.hasPointerCapture(drag.pointerId)) box.releasePointerCapture(drag.pointerId);
    directorRef.current?.endDrag();
    verticalRef.current?.endDrag();
    if (wave && drag.moved < 6) engineRef.current?.playGreeting();
  };

  return (
    <div
      ref={boxRef}
      className={`absolute left-0 top-0 z-20 cursor-grab touch-none select-none rounded-full active:cursor-grabbing focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
        className ?? ""
      }`}
      style={{ width: size, height: size }}
      role="button"
      tabIndex={0}
      aria-label="MonteAI 3D avatar — activate to wave"
      title="Drag MonteAI to move; click to wave"
      onPointerDown={(event: ReactPointerEvent<HTMLDivElement>) => {
        if (!event.isPrimary || event.button !== 0 || dragRef.current.active) return;
        const box = boxRef.current;
        const parent = box?.parentElement;
        const director = directorRef.current;
        const vertical = verticalRef.current;
        if (!box || !parent || !director || !vertical) return;
        event.preventDefault();
        box.setPointerCapture(event.pointerId);
        const rect = parent.getBoundingClientRect();
        dragRef.current = {
          active: true,
          pointerId: event.pointerId,
          grabDx: event.clientX - rect.left - director.getX(),
          grabDy: event.clientY - rect.top - vertical.getX(),
          startX: event.clientX,
          startY: event.clientY,
          moved: 0,
        };
        director.beginDrag();
        vertical.beginDrag();
      }}
      onPointerMove={(event: ReactPointerEvent<HTMLDivElement>) => {
        const drag = dragRef.current;
        const parent = boxRef.current?.parentElement;
        const director = directorRef.current;
        const vertical = verticalRef.current;
        if (!drag.active || drag.pointerId !== event.pointerId || !parent || !director || !vertical) return;
        const rect = parent.getBoundingClientRect();
        drag.moved = Math.max(drag.moved, Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY));
        director.setX(event.clientX - rect.left - drag.grabDx);
        vertical.setX(event.clientY - rect.top - drag.grabDy);
      }}
      onPointerUp={(event) => {
        if (dragRef.current.pointerId === event.pointerId) endDrag(true);
      }}
      onPointerCancel={() => endDrag(false)}
      onLostPointerCapture={() => endDrag(false)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          engineRef.current?.playGreeting();
        }
      }}
    >
      <canvas ref={canvasRef} className="block h-full w-full" aria-hidden="true" />
    </div>
  );
}
