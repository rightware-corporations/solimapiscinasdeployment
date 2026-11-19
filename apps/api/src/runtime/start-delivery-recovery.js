// Fail closed: disabled providers must never drain durable work through fake adapters.
// Explicit runner.run() remains available to isolated tests; production startup uses this gate.
export function startDeliveryRecovery({ config, legacyRunner, notificationRunner, logger }) {
  if (config.whatsapp.enabled) {
    legacyRunner.startRecovery();
  } else {
    logger.info("whatsapp.legacy_runner_paused");
  }

  if (config.email.enabled) {
    notificationRunner.startRecovery();
  } else {
    logger.info("email.runner_paused");
  }
}
