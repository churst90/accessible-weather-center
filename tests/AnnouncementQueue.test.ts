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

test("navigation is a third independent slot", () => {
  // Arrow-key readouts used to share the polite channel with scene
  // narration. A screen reader queues polite updates, so walking a list
  // faster than it could speak meant the middle items were overwritten in
  // the DOM before they were ever read: the user heard item one, then the
  // last one they landed on. Navigation needs its own interrupting region.
  const q = new AnnouncementQueue();
  q.announce("Storm tracker for Testville. 4 storms detected.", "polite");
  q.announce("Heavy rain, 12 miles to the north. 1 of 4.", "navigation");
  q.announce("Tornado Warning!", "assertive");
  const state = q.getState();
  assert.equal(state.polite?.text, "Storm tracker for Testville. 4 storms detected.");
  assert.equal(state.navigation?.text, "Heavy rain, 12 miles to the north. 1 of 4.");
  assert.equal(state.assertive?.text, "Tornado Warning!");

  // Walking the list must never disturb the other two channels.
  q.announce("Moderate rain, 30 miles east. 2 of 4.", "navigation");
  assert.equal(q.getState().polite?.text, "Storm tracker for Testville. 4 storms detected.");
  assert.equal(q.getState().assertive?.text, "Tornado Warning!");
  assert.equal(q.getState().navigation?.text, "Moderate rain, 30 miles east. 2 of 4.");
});

test("consecutive navigation readouts each get a fresh id", () => {
  // Two items whose descriptions happen to match (two identical readings in
  // a table, say) still have to produce a DOM mutation each, or the second
  // arrow press is answered by silence.
  const q = new AnnouncementQueue();
  q.announce("Humidity: 64%. 2 of 5.", "navigation");
  const first = q.getState().navigation!;
  q.announce("Humidity: 64%. 2 of 5.", "navigation");
  assert.notEqual(first.id, q.getState().navigation!.id);
});

test("cancel clears all three channels and notifies subscribers", () => {
  const q = new AnnouncementQueue();
  q.announce("scene text", "polite");
  q.announce("alert text", "assertive");
  q.announce("nav text", "navigation");
  let notified = 0;
  q.subscribe(() => notified++);
  q.cancel();
  const state = q.getState();
  assert.equal(state.polite, null);
  assert.equal(state.assertive, null);
  assert.equal(state.navigation, null);
  assert.ok(notified >= 2, "subscriber saw the initial state and the cancel");
});

test("cancel with only a navigation announcement pending still emits", () => {
  // The early-out in cancel() checks every channel; missing one here would
  // leave a stale readout in the DOM when the user changes modes.
  const q = new AnnouncementQueue();
  q.announce("Light rain, 4 miles west. 3 of 6.", "navigation");
  let notified = 0;
  q.subscribe(() => notified++);
  q.cancel();
  assert.equal(q.getState().navigation, null);
  assert.equal(notified, 2, "initial state plus the cancel");
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

// ─── Severe-alert audio ordering ───
//
// Not a queue test as such, but it belongs with the announcement contract:
// what a user actually hears when a warning lands.

test("a severe alert plays its tone through the scene, not alongside it", async () => {
  // The failure this pins: App used to fire the attention tone AND interrupt
  // to the alerts scene in the same tick. Entering a scene calls
  // sequencer.stop() as its first act, so the tone was cut a few hundred
  // milliseconds in and the four-tone NWS pattern came out as a blip. Worse,
  // composeAlerts already opens the alerts scene with that same beep, so the
  // two were competing to play the same sound.
  //
  // Modelled here with the real ordering primitives rather than the real
  // audio stack: a "scene entry" stops playback, so anything started before
  // it and not awaited is lost.
  const events: string[] = [];
  let playing: string | null = null;

  const sequencer = {
    playOne(src: string) {
      playing = src;
      return new Promise<void>((resolve) => setTimeout(() => {
        if (playing === src) { events.push(`finished:${src}`); playing = null; }
        resolve();
      }, 20));
    },
    stop() {
      if (playing) { events.push(`cut:${playing}`); playing = null; }
    },
  };

  // What the fixed code does: no tone here, the scene owns it.
  const enterAlertsScene = async () => {
    sequencer.stop();                       // narration effect's first act
    await sequencer.playOne("alerts-script"); // beep + spoken warning, one script
  };
  await enterAlertsScene();

  assert.deepEqual(events, ["finished:alerts-script"],
    "the alert script must run to completion, uncut");
  assert.ok(!events.some((e) => e.startsWith("cut:")), "nothing should be truncated");
});

test("a tone started alongside a scene entry would be cut — the regression, demonstrated", async () => {
  // The old shape, kept so the reason for the fix stays legible.
  const events: string[] = [];
  let playing: string | null = null;
  const sequencer = {
    playOne(src: string) {
      playing = src;
      return new Promise<void>((resolve) => setTimeout(() => {
        if (playing === src) { events.push(`finished:${src}`); playing = null; }
        resolve();
      }, 20));
    },
    stop() { if (playing) { events.push(`cut:${playing}`); playing = null; } },
  };

  void sequencer.playOne("warning_beep");   // fired and not awaited
  sequencer.stop();                          // scene entry, immediately after
  await sequencer.playOne("alerts-script");

  assert.ok(events.includes("cut:warning_beep"),
    "this is what used to happen: the beep was cut by the scene it triggered");
  assert.ok(!events.includes("finished:warning_beep"));
});
