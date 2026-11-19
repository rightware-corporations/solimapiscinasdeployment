import crypto from "node:crypto";
import { resolveIntentSource } from "./catalog.js";

export class UnknownIntentSourceError extends Error {}
const createReferenceCode = () => `SOL-I-${crypto.randomBytes(8).toString("base64url").toUpperCase()}`;

export class IntentService {
  constructor({ repository, config, logger }) {
    this.repository = repository;
    this.config = config;
    this.logger = logger;
  }

  async createWhatsappIntent({ input, requestId }) {
    const source = resolveIntentSource(input.sourceType, input.sourceRef);
    if (!source) throw new UnknownIntentSourceError("A origem indicada não é válida.");
    let intent;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        intent = await this.repository.create({
          id: crypto.randomUUID(), referenceCode: createReferenceCode(), channel: "WHATSAPP",
          sourceType: input.sourceType, sourceRef: input.sourceRef || null,
          sourceNameSnapshot: source.name, suggestedService: source.suggestedService, ctaType: input.ctaType
        });
        break;
      } catch (error) {
        if (error.code !== "P2002" || attempt === 2) throw error;
      }
    }
    const message = `Olá SOLIMA. Gostaria de conversar sobre os vossos serviços. Referência: ${intent.referenceCode}`;
    const redirectUrl = `https://wa.me/${this.config.publicWhatsappNumber}?text=${encodeURIComponent(message)}`;
    this.logger.info("intent.created", { requestId, intentId: intent.id, channel: intent.channel, sourceType: intent.sourceType });
    return { intent, redirectUrl };
  }
}
