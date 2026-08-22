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
  WHATSAPP_ENABLED: "true",
  WHATSAPP_ACCESS_TOKEN: "test-access-token",
  WHATSAPP_PHONE_NUMBER_ID: "123456789",
  WHATSAPP_DESTINATION_NUMBER: "258000000000",
  WHATSAPP_API_VERSION: "v22.0",
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: "test-webhook-token-1234",
  META_APP_SECRET: "test-meta-app-secret-1234",
  WHATSAPP_SUMMARY_TEMPLATE_NAME: "summary_template",
  WHATSAPP_IMAGE_TEMPLATE_NAME: "image_template",
  WHATSAPP_TEMPLATE_LANGUAGE: "pt_PT"
});

test("production configuration fails closed unless SQLite and pending media use the mounted volume", () => {
  assert.doesNotThrow(() => loadConfig(productionEnvironment()));
  assert.throws(() => loadConfig({ ...productionEnvironment(), DATABASE_URL: "file:./ephemeral.db" }), /DATABASE_URL=file:\/app\/data\/solima\.db/);
  assert.throws(() => loadConfig({ ...productionEnvironment(), STORAGE_ROOT: "/tmp/pending-media" }), /STORAGE_ROOT=\/app\/data\/pending-media/);
});
