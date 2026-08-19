import { z } from "zod";
import { parsePhoneNumberFromString } from "libphonenumber-js";

export const SERVICES = ["NEW_CONSTRUCTION", "MODERNIZATION", "MAINTENANCE"];
export const EXTRAS = ["LED", "DECK", "AUTOMATION", "HEATING", "INFINITY_EDGE", "EQUIPMENT", "WATER_TREATMENT", "UNSURE"];
const control = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
export const clean = (value) => String(value ?? "").normalize("NFKC").replace(control, "").trim();
const safeText = (min, max) => z.string().transform(clean).pipe(z.string().min(min).max(max).refine((v) => !/[<>]/.test(v), "Não use HTML."));

export const quoteSchema = z.object({
  customerName: safeText(2, 100).refine((v) => /^[\p{L}\p{M} .'-]+$/u.test(v), "Nome inválido."),
  phone: z.string().transform(clean).transform((value, ctx) => {
    const parsed = parsePhoneNumberFromString(value, "MZ");
    if (!parsed?.isValid()) {
      ctx.addIssue({ code: "custom", message: "Introduza um telefone válido." });
      return z.NEVER;
    }
    return parsed.number;
  }),
  location: safeText(3, 180),
  serviceType: z.enum(SERVICES),
  extras: z.preprocess((value) => {
    const raw = Array.isArray(value) ? value : value ? [value] : [];
    return [...new Set(raw.map(clean))];
  }, z.array(z.enum(EXTRAS)).max(10)),
  notes: z.string().optional().default("").transform(clean).pipe(z.string().max(1000)),
  consentGiven: z.preprocess((v) => v === true || v === "true" || v === "on", z.literal(true)),
  startedAt: z.coerce.number().optional(),
  website: z.string().max(0).optional().default("")
});

export function parseQuote(body) {
  return quoteSchema.safeParse(body);
}
