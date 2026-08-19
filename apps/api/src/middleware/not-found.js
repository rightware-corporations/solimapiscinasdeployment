export function notFound(req, res) {
  res.status(404).json({ success: false, error: "Recurso não encontrado.", code: "not_found" });
}
