import crypto from "node:crypto";

export function requestId(req, res, next) {
  const supplied = req.get("X-Request-ID");
  req.id = supplied && /^[A-Za-z0-9-]{1,80}$/.test(supplied) ? supplied : crypto.randomUUID();
  res.set("X-Request-ID", req.id);
  next();
}
