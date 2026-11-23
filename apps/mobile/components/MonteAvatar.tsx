// apps/mobile/components/MonteAvatar.tsx
//
// Mobile host for the MonteAI 3D mascot — the shared procedural engine
// (packages/ui/src/avatar) rendered through expo-gl as a floating overlay.
//
// Same contract as the web host: activity/emotion props drive the pose, and
// `pulse` (one increment per streamed delta) nudges the mouth. The box
// wanders horizontally inside the chat viewport and can be dragged anywhere;
// a tap makes it wave back.

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  AppState,
  PanResponder,
  StyleSheet,
  View,
  type AppStateStatus,
  type LayoutChangeEvent,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import { prepareAvatarGLContext } from '@/lib/avatarGL';
import { createAvatarEngine } from '@monteai/ui/src/avatar/engine';
import { createWanderDirector, type WanderDirector } from '@monteai/ui/src/avatar/director';
import type {
  AvatarActivity,
  AvatarEmotion,
  AvatarEngineHandle,
} from '@monteai/ui/src/avatar/types';

/** Overlay box size (px). */
const AVATAR_SIZE = 132;
/** Margin kept between the box and the screen edges. */
const EDGE_PAD = 8;
/** Limit GPU work on a small floating native surface. */
const FRAME_INTERVAL = 1000 / 30;

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    zIndex: 20,
  },
  box: {
    position: 'absolute',
    left: 0,
    top: 0,
    zIndex: 20,
  },
});

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export interface MonteAvatarProps {
  /** What the avatar is doing right now (idle / thinking / speaking). */
  activity?: AvatarActivity;
  /** Mood derived from the latest answer (neutral / cheerful / sad). */
  emotion?: AvatarEmotion;
  /** Increment once per streamed delta — keeps the mouth in step with tokens. */
  pulse?: number;
  /** Increment to trigger a greeting wave (e.g. when a new chat starts). */
  greetKey?: number;
  /** Play the greeting wave when the surface is first created (default true). */
  greetingOnMount?: boolean;
}

export function MonteAvatar({
  activity = 'idle',
  emotion = 'neutral',
  pulse = 0,
  greetKey = 0,
  greetingOnMount = true,
}: MonteAvatarProps) {
  const focused = useIsFocused();
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [gl, setGl] = useState<ExpoWebGLRenderingContext | null>(null);
  const [failed, setFailed] = useState(false);
  const { width, height } = viewport;
  const hasRoom = width >= AVATAR_SIZE + EDGE_PAD * 2 && height >= AVATAR_SIZE + EDGE_PAD * 2;
  const active = focused && appState === 'active' && hasRoom && !failed;

  // No React re-renders per animation frame. Layout is measured from the
  // message viewport, which shrinks with the keyboard and excludes chrome.
  const [pos] = useState(() => new Animated.ValueXY({ x: EDGE_PAD, y: EDGE_PAD }));
  const offset = useRef({ x: EDGE_PAD, y: EDGE_PAD });
  const positioned = useRef(false);
  const [director] = useState<WanderDirector>(() =>
    createWanderDirector({ bounds: { minX: EDGE_PAD, maxX: EDGE_PAD } })
  );

  const engineRef = useRef<AvatarEngineHandle | null>(null);
  const draggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const movedRef = useRef(0);
  const lastGreetKey = useRef(0);
  /** Latest props for the (possibly late) GL-surface creation callback. */
  const propsRef = useRef({ activity, emotion, pulse, greetKey });

  useEffect(() => {
    const subscription = AppState.addEventListener('change', setAppState);
    return () => subscription.remove();
  }, []);

  // Keep drag/wander bounds in sync with rotation and keyboard layout.
  useEffect(() => {
    if (width <= 0 || height <= 0) return;
    director.setBounds({
      minX: EDGE_PAD,
      maxX: Math.max(EDGE_PAD, width - AVATAR_SIZE - EDGE_PAD),
    });
    if (!positioned.current && hasRoom) {
      positioned.current = true;
      director.setX(width - AVATAR_SIZE - EDGE_PAD);
      offset.current.y = height - AVATAR_SIZE - EDGE_PAD;
    }
    offset.current.x = director.getX();
    offset.current.y = clamp(
      offset.current.y,
      EDGE_PAD,
      Math.max(EDGE_PAD, height - AVATAR_SIZE - EDGE_PAD)
    );
    pos.setValue({ x: director.getX(), y: offset.current.y });
  }, [director, width, height, hasRoom, pos]);

  // Activity / emotion changes ride along with the host's re-renders.
  useEffect(() => {
    propsRef.current = { activity, emotion, pulse, greetKey };
    engineRef.current?.setState({ activity, emotion });
  }, [activity, emotion, pulse, greetKey]);

  // Effects own the engine, so a late surface, surface replacement, or
  // StrictMode cleanup cannot leave an orphaned renderer behind.
  useEffect(() => {
    if (!gl || failed) return;
    const restoreGLContext = prepareAvatarGLContext(gl);
    let engine: AvatarEngineHandle;
    try {
      engine = createAvatarEngine({
        context: gl,
        width: gl.drawingBufferWidth,
        height: gl.drawingBufferHeight,
      });
    } catch (error) {
      restoreGLContext();
      console.warn('MonteAI avatar could not start:', error);
      setFailed(true);
      return;
    }
    engineRef.current = engine;
    const latest = propsRef.current;
    engine.setState({ activity: latest.activity, emotion: latest.emotion });
    if (latest.pulse > 0) engine.noteDelta();
    if (greetingOnMount || latest.greetKey > lastGreetKey.current) engine.playGreeting();
    lastGreetKey.current = latest.greetKey;

    return () => {
      engineRef.current = null;
      // A native view may already have torn down its context on unmount.
      try {
        engine.dispose();
      } catch (error) {
        console.warn('MonteAI avatar cleanup after surface removal:', error);
      } finally {
        restoreGLContext();
      }
    };
  }, [gl, failed, greetingOnMount]);

  // Pause GPU work when another tab is selected or the app is backgrounded.
  useEffect(() => {
    const engine = engineRef.current;
    if (!active || !gl || !engine) return;
    let rafId = 0;
    let last: number | null = null;
    const loop = (now: number): void => {
      if (last != null && now - last < FRAME_INTERVAL) {
        rafId = requestAnimationFrame(loop);
        return;
      }
      const dt = last == null ? 0 : Math.min(Math.max((now - last) / 1000, 0), 0.05);
      last = now;
      if (!draggingRef.current && propsRef.current.activity === 'idle') {
        const x = director.tick(dt);
        if (x !== offset.current.x) {
          offset.current.x = x;
          pos.setValue({ x, y: offset.current.y });
        }
      }
      try {
        engine.tick(now);
        engine.render();
        gl.endFrameEXP();
      } catch (error) {
        console.warn('MonteAI avatar rendering stopped:', error);
        setFailed(true);
        return;
      }
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [active, gl, failed, greetingOnMount, director, pos]);

  // One nudge per streamed token/delta.
  useEffect(() => {
    if (pulse > 0) engineRef.current?.noteDelta();
  }, [pulse]);

  // Explicit greeting trigger (e.g. starting a new chat).
  useEffect(() => {
    if (greetKey > lastGreetKey.current && engineRef.current) {
      engineRef.current.playGreeting();
      lastGreetKey.current = greetKey;
    }
  }, [greetKey]);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          draggingRef.current = true;
          movedRef.current = 0;
          dragStartRef.current = { x: offset.current.x, y: offset.current.y };
          director.beginDrag();
        },
        onPanResponderMove: (_event, gesture) => {
          movedRef.current = Math.max(movedRef.current, Math.hypot(gesture.dx, gesture.dy));
          const x = clamp(
            dragStartRef.current.x + gesture.dx,
            EDGE_PAD,
            Math.max(EDGE_PAD, width - AVATAR_SIZE - EDGE_PAD)
          );
          const y = clamp(
            dragStartRef.current.y + gesture.dy,
            EDGE_PAD,
            Math.max(EDGE_PAD, height - AVATAR_SIZE - EDGE_PAD)
          );
          offset.current = { x, y };
          director.setX(x);
          pos.setValue({ x, y });
        },
        onPanResponderRelease: () => {
          draggingRef.current = false;
          director.endDrag();
          offset.current.x = director.getX();
          // A tap (not a drag) = wave back.
          if (movedRef.current < 6) {
            engineRef.current?.playGreeting();
          }
        },
        onPanResponderTerminate: () => {
          draggingRef.current = false;
          director.endDrag();
          offset.current.x = director.getX();
        },
      }),
    [director, pos, width, height]
  );

  const handleLayout = ({ nativeEvent }: LayoutChangeEvent): void => {
    const next = nativeEvent.layout;
    setViewport((prev) =>
      prev.width === next.width && prev.height === next.height
        ? prev
        : { width: next.width, height: next.height }
    );
  };

  if (failed) return null;

  return (
    <View style={styles.overlay} pointerEvents="box-none" onLayout={handleLayout}>
      <Animated.View
        {...pan.panHandlers}
        style={[
          styles.box,
          { width: AVATAR_SIZE, height: AVATAR_SIZE },
          { opacity: hasRoom ? 1 : 0 },
          { transform: [{ translateX: pos.x }, { translateY: pos.y }] },
        ]}
        pointerEvents={hasRoom ? 'auto' : 'none'}
        accessible={hasRoom}
        accessibilityElementsHidden={!hasRoom}
        importantForAccessibility={hasRoom ? 'auto' : 'no-hide-descendants'}
        accessibilityRole="button"
        accessibilityLabel="MonteAI 3D avatar — tap to wave"
        onAccessibilityTap={() => engineRef.current?.playGreeting()}>
        {width > 0 && height > 0 && (
          <GLView style={StyleSheet.absoluteFill} pointerEvents="none" onContextCreate={setGl} />
        )}
      </Animated.View>
    </View>
  );
}
