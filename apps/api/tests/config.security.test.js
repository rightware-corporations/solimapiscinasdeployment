import test from "node:test";
import assert from "node:assert/strict";
import { loadConfig } from "../src/config/env.js";

const productionEnvironment = () => ({
  NODE_ENV: "production",
  APP_BASE_URL: "https://solima.example",
  DATABASE_URL: "file:/app/data/solima.db",
  STORAGE_ROOT: "/app/data/pending-media",
  MEDIA_RETENTION_HOURS: "72",
  PRIVACY_POLICY_VERSION: "2026-08",
  EMAIL_ENABLED: "true",
  EMAIL_PROVIDER: "smtp",
  EMAIL_FROM: "notifications@solima.example",
  EMAIL_TO: "office@solima.example",
  SMTP_HOST: "smtp.solima.example",
  SMTP_USER: "smtp-user",
  SMTP_PASSWORD: "smtp-password"
});

test("production requires SMTP email but no longer requires Meta for new form delivery", () => {
  assert.doesNotThrow(() => loadConfig(productionEnvironment()));
  assert.throws(() => loadConfig({ ...productionEnvironment(), EMAIL_ENABLED: "false" }), /EMAIL_ENABLED=true/);
  assert.throws(() => loadConfig({ ...productionEnvironment(), SMTP_PASSWORD: "" }), /SMTP_PASSWORD/);
  assert.throws(() => loadConfig({ ...productionEnvironment(), EMAIL_SUBJECT_PREFIX: "SOLIMA\r\nBcc: attacker@example.test" }), /EMAIL_SUBJECT_PREFIX/);
});

test("production configuration fails closed unless SQLite and pending media use the mounted volume", () => {
  assert.doesNotThrow(() => loadConfig(productionEnvironment()));
  assert.throws(() => loadConfig({ ...productionEnvironment(), DATABASE_URL: "file:./ephemeral.db" }), /DATABASE_URL=file:\/app\/data\/solima\.db/);
  assert.throws(() => loadConfig({ ...productionEnvironment(), STORAGE_ROOT: "/tmp/pending-media" }), /STORAGE_ROOT=\/app\/data\/pending-media/);
});
