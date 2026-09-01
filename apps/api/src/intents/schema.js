import { z } from "zod";
import { INTENT_CTA_TYPES, INTENT_SOURCE_TYPES } from "./catalog.js";

const sourceRef = z.string().trim().min(1).max(80).regex(/^[a-z0-9_-]+$/i).optional();
const whatsappIntentSchema = z.object({
  sourceType: z.enum(INTENT_SOURCE_TYPES),
  sourceRef,
  ctaType: z.enum(INTENT_CTA_TYPES).default("WHATSAPP_CHAT")
}).strict();

export function parseWhatsappIntent(value) {
  return whatsappIntentSchema.safeParse(value);
}
