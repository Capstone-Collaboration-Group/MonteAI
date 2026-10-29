// packages/ui/src/avatar/index.ts
//
// Web avatar surface. Native hosts deep-import engine/director/types below
// this directory so Metro never loads the DOM host. Intentionally not
// re-exported from the package root; ChatPage owns the web integration.

export { MonteAvatar } from "./MonteAvatar";
export type { MonteAvatarProps } from "./MonteAvatar";
export { createAvatarEngine } from "./engine";
export type { AvatarEngineOptions } from "./engine";
export { createWanderDirector } from "./director";
export type { WanderBounds, WanderDirector } from "./director";
export type { AvatarActivity, AvatarEmotion, AvatarEngineHandle, AvatarGazeTarget, AvatarState } from "./types";
