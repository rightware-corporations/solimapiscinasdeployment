import multer from "multer";
import { cleanupRawFiles } from "../media/local-storage.js";

export function errorHandler(logger) {
  return async function handleError(error, req, res, _next) {
    await cleanupRawFiles(req.files);
    logger.error("http.request_failed", { requestId: req.id, errorType: error?.name || "Error", errorCode: error?.code || "unknown" });
    if (error instanceof multer.MulterError) {
      const status = error.code === "LIMIT_FILE_SIZE" || error.code === "LIMIT_FILE_COUNT" || error.code === "LIMIT_PART_COUNT" ? 413 : 400;
      return res.status(status).json({ success: false, error: status === 413 ? "O envio excede os limites permitidos." : "Pedido multipart inválido.", code: "multipart_error" });
    }
    if (error?.type === "entity.parse.failed") {
      return res.status(400).json({ success: false, error: "JSON inválido.", code: "invalid_json" });
    }
    if (error?.type === "entity.too.large") {
      return res.status(413).json({ success: false, error: "O pedido excede os limites permitidos.", code: "payload_too_large" });
    }
    if (res.headersSent) return;
    return res.status(500).json({ success: false, error: "Não foi possível concluir o pedido. Tente novamente.", code: "internal_error" });
  };
}
