import crypto from "node:crypto";
import { createCaseReference } from "./reference.js";
import { parseManualWhatsappCase } from "./schema.js";

export class InvalidCaseInputError extends Error {}
export class IntentNotFoundError extends Error {}
export class IntentChannelMismatchError extends Error {}

export class CaseService {
  constructor({ repository }) { this.repository = repository; }

  async createManualWhatsappCase(input) {
    const parsed = parseManualWhatsappCase(input);
    if (!parsed.success) throw new InvalidCaseInputError("Dados do Case inválidos.");
    const data = parsed.data;
    const intent = await this.repository.findIntentByReference(data.sourceIntentReference);
    if (!intent) throw new IntentNotFoundError("Intent não encontrado.");
    if (intent.channel !== "WHATSAPP") throw new IntentChannelMismatchError("O Intent não pertence ao canal WhatsApp.");
    return this.repository.createFromIntent({
      intentId: intent.id,
      caseRecord: {
        id: crypto.randomUUID(), publicReference: createCaseReference(), type: "SALES", channel: "WHATSAPP",
        customerNameSnapshot: data.customerName, phoneE164: data.phone, location: data.location,
        serviceType: data.serviceType || intent.suggestedService, title: data.title, description: data.description,
        workflowState: "NEW", priority: "NORMAL", createdByUserId: data.createdByUserId
      }
    });
  }
}
