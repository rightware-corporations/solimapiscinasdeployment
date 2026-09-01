import crypto from "node:crypto";

export function createCaseReference() {
  return `SOL-C-${crypto.randomBytes(8).toString("base64url").toUpperCase()}`;
}
