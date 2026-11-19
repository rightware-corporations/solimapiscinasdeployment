import { parseWhatsappIntent } from "./schema.js";
import { UnknownIntentSourceError } from "./service.js";

export function createWhatsappIntentController({ intentService }) {
  return async function createWhatsappIntent(req, res, next) {
    try {
      const parsed = parseWhatsappIntent(req.body);
      if (!parsed.success) return res.status(422).json({ success: false, error: "Contexto de contacto inválido.", code: "validation_failed" });
      const result = await intentService.createWhatsappIntent({ input: parsed.data, requestId: req.id });
      return res.status(201).json({ success: true, referenceCode: result.intent.referenceCode, redirectUrl: result.redirectUrl });
    } catch (error) {
      if (error instanceof UnknownIntentSourceError) return res.status(422).json({ success: false, error: error.message, code: "unknown_intent_source" });
      return next(error);
    }
  };
}
