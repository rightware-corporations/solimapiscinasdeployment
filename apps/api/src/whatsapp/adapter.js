import crypto from "node:crypto";
import { MetaCloudClient } from "./client.js";
import { ProviderError } from "./errors.js";

const textParameter = (text) => ({ type: "text", text: String(text || "—").slice(0, 1_000) });

export class MetaWhatsAppAdapter {
  constructor({ config, client = new MetaCloudClient({ config }) }) {
    this.config = config;
    this.client = client;
  }

  async uploadLeadImage({ filePath, mimeType }) {
    const response = await this.client.uploadMedia({ filePath, mimeType });
    if (!response.id) throw new ProviderError("Malformed provider response", { code: "malformed_response", retryable: true });
    return { mediaId: response.id };
  }

  async sendLeadSummary({ to, lead }) {
    const response = await this.client.postJson("/messages", {
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: this.config.whatsapp.summaryTemplateName,
        language: { code: this.config.whatsapp.templateLanguage },
        components: [{ type: "body", parameters: [
          textParameter(lead.customerName), textParameter(lead.phoneE164), textParameter(lead.location),
          textParameter(lead.serviceType), textParameter(lead.extras.map((extra) => extra.code).join(", ")), textParameter(lead.notes)
        ] }]
      }
    });
    return messageResponse(response);
  }

  async sendLeadImage({ to, mediaId, media }) {
    const response = await this.client.postJson("/messages", {
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: this.config.whatsapp.imageTemplateName,
        language: { code: this.config.whatsapp.templateLanguage },
        components: [
          { type: "header", parameters: [{ type: "image", image: { id: mediaId } }] },
          { type: "body", parameters: [textParameter(media.category), textParameter(media.position + 1)] }
        ]
      }
    });
    return messageResponse(response);
  }
}

function messageResponse(response) {
  const messageId = response.messages?.[0]?.id;
  if (!messageId) throw new ProviderError("Malformed provider response", { code: "malformed_response", retryable: true });
  return { messageId };
}

export class FakeWhatsAppAdapter {
  constructor({ failures = {} } = {}) {
    this.failures = new Map(Object.entries(failures).map(([key, value]) => [key, [...value]]));
    this.calls = [];
  }

  queueFailure(operation, error) {
    const queue = this.failures.get(operation) || [];
    queue.push(error);
    this.failures.set(operation, queue);
  }

  maybeFail(operation) {
    const error = this.failures.get(operation)?.shift();
    if (error) throw error;
  }

  async uploadLeadImage(input) {
    this.maybeFail("upload");
    this.calls.push({ operation: "upload", ...input });
    return { mediaId: `media.test.${crypto.randomUUID()}` };
  }

  async sendLeadSummary(input) {
    this.maybeFail("summary");
    this.calls.push({ operation: "summary", ...input });
    return { messageId: `wamid.test.${crypto.randomUUID()}` };
  }

  async sendLeadImage(input) {
    this.maybeFail("image");
    this.calls.push({ operation: "image", ...input });
    return { messageId: `wamid.test.${crypto.randomUUID()}` };
  }
}
