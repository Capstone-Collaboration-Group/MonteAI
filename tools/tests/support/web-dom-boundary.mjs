// The portal target is synthetic. Contents, consent dialogs, and their actual
// event/lifecycle logic still render in the installed React test renderer.
export function createPortal(children) { return children; }
export { flushSync, unstable_batchedUpdates } from "real:react-dom";
