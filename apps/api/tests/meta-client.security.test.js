import test from "node:test";
import assert from "node:assert/strict";
import { loadConfig } from "../src/config/env.js";
import { MetaCloudClient } from "../src/whatsapp/client.js";
import { ProviderError } from "../src/whatsapp/errors.js";

test("Meta client converts an AbortSignal timeout into a retryable provider error without a network call", async () => {
  const config = loadConfig({
    NODE_ENV: "test",
    WHATSAPP_ACCESS_TOKEN: "test-access-token",
    WHATSAPP_PHONE_NUMBER_ID: "123456789",
    WHATSAPP_API_VERSION: "v22.0",
    PROVIDER_TIMEOUT_MS: "1000"
  });
  const client = new MetaCloudClient({
    config,
    fetchImpl: (_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => {
        const error = new Error("aborted");
        error.name = "AbortError";
        reject(error);
      }, { once: true });
    })
  });

  await assert.rejects(client.postJson("/messages", {}), (error) => {
    assert.ok(error instanceof ProviderError);
    assert.equal(error.code, "timeout");
    assert.equal(error.retryable, true);
    return true;
  });
});
