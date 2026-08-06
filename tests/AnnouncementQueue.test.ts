import { test } from "node:test";
import assert from "node:assert/strict";
import { AnnouncementQueue } from "../src/a11y/AnnouncementQueue";
import { pushModal, popModal, isModalOpen, resetModality } from "../src/a11y/modality";

test("polite and assertive are independent slots — one never clears the other", () => {
  const q = new AnnouncementQueue();
  q.announce("Current conditions: 72 and sunny.", "polite");
  q.announce("Tornado Warning!", "assertive");
  const state = q.getState();
  assert.equal(state.polite?.text, "Current conditions: 72 and sunny.");
  assert.equal(state.assertive?.text, "Tornado Warning!");
  // A later polite announcement must not wipe the assertive one either.
  q.announce("Next scene.", "polite");
  assert.equal(q.getState().assertive?.text, "Tornado Warning!");
});

test("repeated identical text gets a fresh id so the DOM mutates", () => {
  const q = new AnnouncementQueue();
  q.announce("Paused.", "polite");
  const first = q.getState().polite!;
  q.announce("Paused.", "polite");
  const second = q.getState().polite!;
  assert.equal(first.text, second.text);
  assert.notEqual(first.id, second.id, "ids must differ or aria-live stays silent");
});

test("cancel clears both channels and notifies subscribers", () => {
  const q = new AnnouncementQueue();
  q.announce("scene text", "polite");
  q.announce("alert text", "assertive");
  let notified = 0;
  q.subscribe(() => notified++);
  q.cancel();
  const state = q.getState();
  assert.equal(state.polite, null);
  assert.equal(state.assertive, null);
  assert.ok(notified >= 2, "subscriber saw the initial state and the cancel");
});

test("subscribe fires immediately with current state and unsubscribes cleanly", () => {
  const q = new AnnouncementQueue();
  q.announce("hello", "polite");
  let seen: string | null | undefined;
  const off = q.subscribe((s) => { seen = s.polite?.text; });
  assert.equal(seen, "hello");
  off();
  q.announce("after", "polite");
  assert.equal(seen, "hello", "listener must not fire after unsubscribe");
});

test("modality gate counts nested modals", () => {
  resetModality();
  assert.equal(isModalOpen(), false);
  pushModal();
  assert.equal(isModalOpen(), true);
  pushModal();
  popModal();
  assert.equal(isModalOpen(), true, "still one modal open");
  popModal();
  assert.equal(isModalOpen(), false);
  popModal(); // extra pop must not go negative
  pushModal();
  assert.equal(isModalOpen(), true);
  resetModality();
});
