import { test } from "node:test";
import assert from "node:assert/strict";
import { KeyboardRouter } from "../src/a11y/KeyboardRouter";

/** Minimal stand-in for window: captures the keydown listener so tests can
 *  feed synthetic KeyboardEvent-shaped objects straight into the router. */
function attachRouter(router: KeyboardRouter) {
  let listener: ((e: unknown) => void) | null = null;
  const fakeWindow = {
    addEventListener: (_t: string, fn: (e: unknown) => void) => { listener = fn; },
    removeEventListener: () => { listener = null; }
  };
  router.attach(fakeWindow as unknown as Window);
  return (e: Partial<KeyboardEvent>) =>
    listener!({
      ctrlKey: false, altKey: false, shiftKey: false, metaKey: false,
      key: "", code: "", target: null,
      preventDefault: () => {},
      ...e
    });
}

test("`?` fires even though it arrives as Shift+/ (the Help dialog bug)", () => {
  const router = new KeyboardRouter();
  let fired = 0;
  router.register({ id: "help", description: "Help", keys: "?", group: "General", handler: () => fired++ });
  const dispatch = attachRouter(router);
  // A real US-layout question mark: key "?", code "Slash", shiftKey true.
  dispatch({ key: "?", code: "Slash", shiftKey: true });
  assert.equal(fired, 1);
});

test("shift+digit specs still work via code normalization", () => {
  const router = new KeyboardRouter();
  let plain = 0;
  let shifted = 0;
  router.register({ id: "vol-up", description: "", keys: "1", group: "Audio", handler: () => plain++ });
  router.register({ id: "vol-down", description: "", keys: "shift+1", group: "Audio", handler: () => shifted++ });
  const dispatch = attachRouter(router);
  dispatch({ key: "1", code: "Digit1" });
  dispatch({ key: "!", code: "Digit1", shiftKey: true });
  assert.equal(plain, 1);
  assert.equal(shifted, 1);
});

test("shift+letter remains distinct from the bare letter", () => {
  const router = new KeyboardRouter();
  let bare = 0;
  let shifted = 0;
  router.register({ id: "m", description: "", keys: "m", group: "G", handler: () => bare++ });
  router.register({ id: "M", description: "", keys: "shift+m", group: "G", handler: () => shifted++ });
  const dispatch = attachRouter(router);
  dispatch({ key: "m", code: "KeyM" });
  dispatch({ key: "M", code: "KeyM", shiftKey: true });
  assert.equal(bare, 1);
  assert.equal(shifted, 1);
});

test("ctrl chords match regardless of registration order", () => {
  const router = new KeyboardRouter();
  let fired = 0;
  router.register({ id: "mute", description: "", keys: "ctrl+m", group: "Audio", handler: () => fired++ });
  const dispatch = attachRouter(router);
  dispatch({ key: "m", code: "KeyM", ctrlKey: true });
  assert.equal(fired, 1);
});

test("duplicate registration throws a conflict error", () => {
  const router = new KeyboardRouter();
  router.register({ id: "a", description: "", keys: "x", group: "G", handler: () => {} });
  assert.throws(() => {
    router.register({ id: "b", description: "", keys: "x", group: "G", handler: () => {} });
  }, /conflict/i);
});

test("keystrokes inside editable fields are ignored (except Escape)", () => {
  const router = new KeyboardRouter();
  let fired = 0;
  let escaped = 0;
  router.register({ id: "x", description: "", keys: "x", group: "G", handler: () => fired++ });
  router.register({ id: "esc", description: "", keys: "escape", group: "G", handler: () => escaped++ });
  const dispatch = attachRouter(router);
  const input = { tagName: "INPUT" };
  dispatch({ key: "x", code: "KeyX", target: input as unknown as EventTarget });
  dispatch({ key: "Escape", code: "Escape", target: input as unknown as EventTarget });
  assert.equal(fired, 0, "typing x in an input must not trigger the shortcut");
  assert.equal(escaped, 1, "Escape must still work from inside an input");
});
