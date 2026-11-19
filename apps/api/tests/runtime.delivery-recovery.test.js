import test from "node:test";
import assert from "node:assert/strict";
import { startDeliveryRecovery } from "../src/runtime/start-delivery-recovery.js";

function makeHarness({ whatsappEnabled, emailEnabled }) {
  const events = [];
  const legacyRunner = { startRecovery() { events.push("legacy.started"); } };
  const notificationRunner = { startRecovery() { events.push("email.started"); } };
  const logger = { info(event) { events.push(event); } };
  return {
    events,
    start: () => startDeliveryRecovery({
      config: { whatsapp: { enabled: whatsappEnabled }, email: { enabled: emailEnabled } },
      legacyRunner, notificationRunner, logger
    })
  };
}

test("Meta disabled: pending legacy work is never drained using the fake WhatsApp adapter at startup", () => {
  const h = makeHarness({ whatsappEnabled: false, emailEnabled: true });
  h.start();
  assert.deepEqual(h.events, ["whatsapp.legacy_runner_paused", "email.started"]);
});

test("Email disabled: startup does not send notifications via the fake adapter", () => {
  const h = makeHarness({ whatsappEnabled: false, emailEnabled: false });
  h.start();
  assert.deepEqual(h.events, ["whatsapp.legacy_runner_paused", "email.runner_paused"]);
});

test("Enabled providers retain explicit recovery capability", () => {
  const h = makeHarness({ whatsappEnabled: true, emailEnabled: true });
  h.start();
  assert.deepEqual(h.events, ["legacy.started", "email.started"]);
});
