import crypto from "node:crypto";

export function requestFingerprint(lead, media) {
  const canonical = JSON.stringify({
    customerName: lead.customerName,
    phoneE164: lead.phone,
    location: lead.location,
    serviceType: lead.serviceType,
    extras: [...lead.extras].sort(),
    notes: lead.notes,
    consentGiven: true,
    locationImages: media.filter((item) => item.category === "LOCATION").map((item) => item.rawSha256),
    inspirationImages: media.filter((item) => item.category === "INSPIRATION").map((item) => item.rawSha256)
  });
  return crypto.createHash("sha256").update(canonical).digest("hex");
}
