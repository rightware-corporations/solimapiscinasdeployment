const endpoint = "/api/intents/whatsapp";

function announce(message) {
  let status = document.querySelector("[data-whatsapp-intent-status]");
  if (!status) {
    status = document.createElement("p");
    status.dataset.whatsappIntentStatus = "";
    status.className = "sr-only";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    document.body.append(status);
  }
  status.textContent = "";
  requestAnimationFrame(() => { status.textContent = message; });
}

function contextFromLink(link) {
  return { sourceType: link.dataset.intentSource || "CONTACT", ...(link.dataset.intentRef ? { sourceRef: link.dataset.intentRef } : {}), ctaType: "WHATSAPP_CHAT" };
}

export function initWhatsappIntent() {
  document.addEventListener("click", async (event) => {
    const link = event.target.closest('a[data-contact-channel="WHATSAPP"]');
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    link.setAttribute("aria-disabled", "true");
    announce("A preparar a conversa no WhatsApp.");
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(contextFromLink(link)) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || typeof body.redirectUrl !== "string") throw new Error("intent_failed");
      window.location.assign(body.redirectUrl);
    } catch {
      announce("Não foi possível preparar a conversa. Verifique a ligação e tente novamente.");
    } finally {
      link.removeAttribute("aria-disabled");
    }
  });
}
