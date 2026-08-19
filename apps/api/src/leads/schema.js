import { z } from "zod";
import { parsePhoneNumberFromString } from "libphonenumber-js";

export const SERVICES = ["NEW_CONSTRUCTION", "MODERNIZATION", "MAINTENANCE"];
export const EXTRAS = ["LED", "DECK", "AUTOMATION", "HEATING", "INFINITY_EDGE", "EQUIPMENT", "WATER_TREATMENT", "UNSURE"];

const controlCharacters = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const invalidExtras = Symbol("invalid-extras");

export const cleanText = (value) => String(value ?? "").normalize("NFKC").replace(controlCharacters, "").trim();
const text = (minimum, maximum) => z.string().transform(cleanText).pipe(
  z.string().min(minimum).max(maximum).refine((value) => !/[<>]/.test(value), "Não use HTML.")
);

const extras = z.preprocess((value) => {
  if (value === undefined || value === "") return [];
  let parsed = value;
  if (typeof value === "string") {
    try { parsed = JSON.parse(value); } catch { return invalidExtras; }
  }
  if (!Array.isArray(parsed)) return invalidExtras;
  return [...new Set(parsed.map(cleanText))];
}, z.array(z.enum(EXTRAS)).max(EXTRAS.length));

const phone = z.string().transform(cleanText).transform((value, context) => {
  const parsed = parsePhoneNumberFromString(value, "MZ");
  if (!parsed?.isValid()) {
    context.addIssue({ code: "custom", message: "Introduza um telefone válido." });
    return z.NEVER;
  }
  return parsed.number;
});

const leadSchema = z.object({
  customerName: text(2, 100).refine((value) => /^[\p{L}\p{M} .'-]+$/u.test(value), "Nome inválido."),
  phone,
  location: text(3, 180),
  serviceType: z.enum(SERVICES),
  extras,
  notes: z.string().optional().default("").transform(cleanText).pipe(z.string().max(1000).refine((value) => !/[<>]/.test(value), "Não use HTML.")),
  consentGiven: z.preprocess((value) => value === true || value === "true" || value === "on", z.literal(true)),
  startedAt: z.coerce.number().int().finite(),
  website: z.string().optional().default("").transform(cleanText)
});

export const idempotencyKeySchema = z.string().uuid();

export function parseLead(body, now = Date.now()) {
  const parsed = leadSchema.safeParse(body);
  if (!parsed.success) return parsed;
  if (parsed.data.website || now - parsed.data.startedAt < 1_800 || parsed.data.startedAt > now + 60_000) {
    return { success: false, antiAbuse: true };
  }
  return parsed;
}
