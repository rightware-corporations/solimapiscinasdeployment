import { z } from "zod";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { SERVICES, cleanText } from "../leads/schema.js";

const text = (min, max) => z.string().transform(cleanText).pipe(z.string().min(min).max(max));
const optionalText = (max) => z.string().optional().default("").transform(cleanText).pipe(z.string().max(max)).transform((value) => value || null);

const manualWhatsappCaseSchema = z.object({
  sourceIntentReference: z.string().trim().regex(/^SOL-I-[A-Z0-9_-]{11}$/),
  customerName: text(2, 100),
  phone: z.string().transform(cleanText).transform((value, context) => {
    const parsed = parsePhoneNumberFromString(value, "MZ");
    if (!parsed?.isValid()) {
      context.addIssue({ code: "custom", message: "Introduza um telefone válido." });
      return z.NEVER;
    }
    return parsed.number;
  }),
  location: optionalText(180),
  serviceType: z.enum(SERVICES).optional().nullable(),
  title: text(3, 160),
  description: optionalText(2_000),
  createdByUserId: z.string().trim().min(1).max(100)
}).strict();

export function parseManualWhatsappCase(value) {
  return manualWhatsappCaseSchema.safeParse(value);
}
