import { cleanupRawFiles } from "../media/local-storage.js";
import { MediaValidationError } from "../media/validation.js";
import { idempotencyKeySchema, parseLead } from "./schema.js";
import { DependencyUnavailableError, IdempotencyConflictError } from "./service.js";

export function createLeadController({ leadService }) {
  return async function submitLead(req, res, next) {
    try {
      const idempotencyKey = idempotencyKeySchema.safeParse(req.get("Idempotency-Key"));
      if (!idempotencyKey.success) return res.status(400).json({ success: false, error: "Idempotency-Key inválida.", code: "invalid_idempotency_key" });
      const lead = parseLead(req.body);
      if (!lead.success) {
        if (lead.antiAbuse) return res.status(400).json({ success: false, error: "Não foi possível validar a submissão.", code: "submission_rejected" });
        return res.status(422).json({ success: false, error: "Verifique os campos indicados.", code: "validation_failed", fields: lead.error.flatten().fieldErrors });
      }
      const result = await leadService.submit({ idempotencyKey: idempotencyKey.data, lead: lead.data, files: req.files || {}, requestId: req.id });
      return res.status(result.replayed ? 200 : 201).json({ success: true, status: "received" });
    } catch (error) {
      if (error instanceof IdempotencyConflictError) return res.status(409).json({ success: false, error: error.message, code: "idempotency_conflict" });
      if (error instanceof MediaValidationError) return res.status(422).json({ success: false, error: error.message, code: "invalid_media" });
      if (error instanceof DependencyUnavailableError) return res.status(503).json({ success: false, error: error.message, code: "dependency_unavailable" });
      return next(error);
    } finally {
      await cleanupRawFiles(req.files);
    }
  };
}
