const escapeHtml = (value) => String(value ?? "—")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");

const plain = (value) => String(value ?? "—").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");

function assertHeaderValue(value, label) {
  if (!value || /[\r\n]/.test(value)) throw new Error(`Invalid ${label} header configuration`);
  return value;
}

export function renderLeadNotification({ config, delivery }) {
  const lead = delivery.leadSubmission;
  const caseRecord = delivery.case;
  const extras = lead.extras.map((item) => item.code).join(", ") || "—";
  const rows = [
    ["Referência", caseRecord.publicReference],
    ["Cliente", lead.customerName],
    ["Telefone", lead.phoneE164],
    ["Localização", lead.location],
    ["Serviço", lead.serviceType],
    ["Extras", extras],
    ["Notas", lead.notes || "—"]
  ];
  const subject = assertHeaderValue(`${config.email.subjectPrefix} — novo pedido ${caseRecord.publicReference}`, "subject");
  const text = ["Novo pedido recebido pelo formulário SOLIMA", "", ...rows.map(([key, value]) => `${key}: ${plain(value)}`)].join("\n");
  const htmlRows = rows.map(([key, value]) => `<tr><th align="left" style="padding:6px 12px 6px 0">${escapeHtml(key)}</th><td style="padding:6px 0">${escapeHtml(value)}</td></tr>`).join("");
  return {
    from: assertHeaderValue(config.email.from, "from"),
    to: assertHeaderValue(config.email.to, "to"),
    subject,
    text,
    html: `<main><h1>Novo pedido SOLIMA</h1><table>${htmlRows}</table></main>`
  };
}
