import { ipKeyGenerator, rateLimit } from "express-rate-limit";

export function createLeadLimiter() {
  return rateLimit({
    windowMs: 30 * 60_000,
    limit: 12,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    keyGenerator: (req) => ipKeyGenerator(req.ip),
    message: { success: false, error: "Demasiadas tentativas. Tente novamente mais tarde.", code: "rate_limited" }
  });
}
