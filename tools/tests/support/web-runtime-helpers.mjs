import assert from "node:assert/strict";
import React from "react";
import { act, create } from "react-test-renderer";
import { setImmediate } from "node:timers/promises";
import { runtime, SYNTHETIC_PRIVATE, SYNTHETIC_RECEIPT } from "./web-runtime-mocks.mjs";

const renderers = new Set();
const waits = new Set();
export async function flush() { await act(async () => { await setImmediate(); await setImmediate(); }); }
export async function mount(element, { strict = true } = {}) {
  let renderer;
  await act(async () => { renderer = create(strict ? React.createElement(React.StrictMode, null, element) : element,
    { createNodeMock: runtime.nodeMock }); });
  renderers.add(renderer);
  await flush();
  return renderer;
}
export async function unmount(renderer) {
  renderers.delete(renderer);
  await act(async () => renderer.unmount());
}
export function deferred(value) {
  let resolve;
  const promise = new Promise(finish => { resolve = finish; });
  const wait = { promise, finish(result = value) { waits.delete(wait); resolve(result); } };
  waits.add(wait);
  return wait;
}
export function text(node) {
  if (typeof node === "string") return node;
  if (!node) return "";
  return (node.children ?? []).map(child => text(child)).join("");
}
export function button(renderer, label) {
  const matches = renderer.root.findAll(node => node.type === "button" && (node.props["aria-label"] === label || text(node) === label));
  assert.equal(matches.length, 1, `Expected exactly one ${label} button.`);
  return matches[0];
}
export function checkbox(renderer, label) {
  return renderer.root.findByProps({ "aria-label": label });
}
export async function click(renderer, label) {
  const control = button(renderer, label);
  assert.equal(!!control.props.disabled, false, `${label} must be enabled.`);
  await act(async () => { control.props.onClick(); });
  await flush();
}
export async function change(renderer, name, value) {
  const input = renderer.root.findAll(node => typeof node.type === "string" && (node.type === "input" || node.type === "select") && node.props.name === name)[0];
  assert.ok(input, `Expected the ${name} field.`);
  await act(async () => input.props.onChange({ target: { name, value } }));
}
export async function check(renderer, label, checked = true) {
  await act(async () => checkbox(renderer, label).props.onChange({ target: { checked } }));
  await flush();
}
export async function submit(renderer) {
  await act(async () => { void renderer.root.findByType("form").props.onSubmit({ preventDefault() {} }); });
  await flush();
}
export function hasText(renderer, expected) {
  return text(renderer.root).includes(expected);
}
export function assertNoSensitiveUi(renderer) {
  const rendered = JSON.stringify(renderer.toJSON());
  for (const marker of [SYNTHETIC_PRIVATE, SYNTHETIC_RECEIPT, "imageBase64", "idVerificationReceipt"]) {
    assert.equal(rendered.includes(marker), false, "Synthetic sensitive data must not enter rendered host UI.");
    assert.equal([...runtime.store.values()].some(value => String(value).includes(marker)), false, "Only safe drafts may enter the synthetic store.");
  }
}
export async function cleanup() {
  for (const renderer of [...renderers]) await unmount(renderer);
  waits.forEach(wait => wait.finish());
  await flush(); await flush();
}
export function clock(t, initial = Date.parse("2026-11-22T00:00:00Z")) {
  let now = initial;
  let sequence = 0;
  const timers = new Map();
  t.mock.method(Date, "now", () => now);
  const schedule = (callback, ms, repeat = false) => {
    const id = ++sequence;
    timers.set(id, { callback, at: now + ms, repeat: repeat ? ms : 0 });
    return id;
  };
  t.mock.method(globalThis, "setTimeout", (callback, ms) => schedule(callback, ms));
  t.mock.method(globalThis, "clearTimeout", id => { timers.delete(id); });
  t.mock.method(globalThis, "setInterval", (callback, ms) => schedule(callback, ms, true));
  t.mock.method(globalThis, "clearInterval", id => { timers.delete(id); });
  return {
    async tick(ms) {
      const end = now + ms;
      while (true) {
        const next = [...timers].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        const [id, timer] = next;
        now = timer.at;
        if (timer.repeat) timer.at += timer.repeat; else timers.delete(id);
        await act(async () => { timer.callback(); });
        await flush();
      }
      now = end;
      await flush();
    },
    get timerCount() { return timers.size; },
  };
}
