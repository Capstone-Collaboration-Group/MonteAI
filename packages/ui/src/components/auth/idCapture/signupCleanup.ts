import type { StudentSignupFlow } from "@monteai/api";
import type { BrowserMemoryCameraSession } from "./browserMemoryCamera";

/** A requested sign-out waits for earlier actual cleanup, not a prompt abort. */
export async function awaitBrowserSignupCleanup(work: BrowserMemoryCameraSession, signal: AbortSignal): Promise<void> {
  const state = work.getState();
  if (signal.aborted || !state.busy && !state.blocked) return;
  await new Promise<void>(resolve => {
    let done = false;
    let unsubscribe = () => {};
    const finish = () => {
      if (done) return;
      done = true;
      unsubscribe();
      signal.removeEventListener("abort", finish);
      resolve();
    };
    unsubscribe = work.subscribe(value => { if (!value.busy && !value.blocked) finish(); });
    if (done) unsubscribe();
    else {
      signal.addEventListener("abort", finish, { once: true });
      if (signal.aborted) finish();
    }
  });
}

/** The controller rejects cancellation promptly but retains its real work owner. */
export async function awaitStudentSignupCleanup(flow: StudentSignupFlow, work: () => Promise<void>): Promise<void> {
  try { await work(); }
  finally {
    if (flow.getState().busy) {
      await new Promise<void>(resolve => {
        let idle = false;
        let unsubscribe = () => {};
        unsubscribe = flow.subscribe(state => {
          idle = !state.busy;
          if (!state.busy) { unsubscribe(); resolve(); }
        });
        if (idle) unsubscribe();
      });
    }
  }
}

/** Keep cleanup observers alive on unmount; no late result can revive the UI. */
export function retireStudentSignupFlow(flow: StudentSignupFlow): void {
  flow.cancel();
  if (!flow.getState().busy) { flow.dispose(); return; }
  let unsubscribe = () => {};
  unsubscribe = flow.subscribe(state => {
    if (!state.busy) {
      unsubscribe();
      // Let all current cleanup listeners see idle before disposal clears them.
      queueMicrotask(() => flow.dispose());
    }
  });
}
