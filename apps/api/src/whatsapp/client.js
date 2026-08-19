import { openAsBlob } from "node:fs";
import { ProviderError } from "./errors.js";

export class MetaCloudClient {
  constructor({ config, fetchImpl = fetch }) {
    this.config = config;
    this.fetch = fetchImpl;
    this.baseUrl = `https://graph.facebook.com/${config.whatsapp.apiVersion}/${config.whatsapp.phoneNumberId}`;
  }

  async postJson(path, body) {
    return this.request(path, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.config.whatsapp.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
  }

  async uploadMedia({ filePath, mimeType }) {
    const form = new FormData();
    form.set("messaging_product", "whatsapp");
    form.set("file", await openAsBlob(filePath, { type: mimeType }), "lead.jpg");
    return this.request("/media", { method: "POST", headers: { Authorization: `Bearer ${this.config.whatsapp.accessToken}` }, body: form });
  }

  async request(path, options) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.providerTimeoutMs);
    try {
      const response = await this.fetch(`${this.baseUrl}${path}`, { ...options, signal: controller.signal });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const providerCode = String(payload?.error?.code || response.status);
        const message = String(payload?.error?.message || "Meta request failed").slice(0, 240);
        throw new ProviderError(message, {
          code: `meta_${providerCode}`,
          retryable: response.status === 429 || response.status >= 500,
          mediaExpired: response.status === 404 || /media.*(expired|invalid)/i.test(message)
        });
      }
      if (!payload || typeof payload !== "object") throw new ProviderError("Malformed provider response", { code: "malformed_response", retryable: true });
      return payload;
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      if (error?.name === "AbortError") throw new ProviderError("Provider timeout", { code: "timeout", retryable: true });
      throw new ProviderError("Provider connection failed", { code: "connection_error", retryable: true });
    } finally {
      clearTimeout(timeout);
    }
  }
}
