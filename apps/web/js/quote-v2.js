const QUOTE_STYLE_HREF = "/css/quote-v2.css";

const SERVICE_LABELS = Object.freeze({
  NEW_CONSTRUCTION: "Construção nova",
  MODERNIZATION: "Modernização",
  MAINTENANCE: "Manutenção",
});

const quoteState = {
  context: { type: "GENERIC" },
  taskOpen: false,
  trigger: null,
  placeholder: null,
  lastAutoService: "",
};

function ensureQuoteStyles() {
  if (document.querySelector('link[data-solima-quote-v2]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = QUOTE_STYLE_HREF;
  link.dataset.solimaQuoteV2 = "";
  document.head.append(link);
}

function normalizeQuoteCopy(section) {
  section.dataset.quoteV2 = "";
  section.setAttribute("aria-labelledby", "quoteV2Title");

  const eyebrow = section.querySelector(".orcamento-copy-column .eyebrow");
  if (eyebrow) eyebrow.textContent = "Pedir orçamento";

  const title = section.querySelector(".orcamento-info-title");
  if (title) {
    title.id = "quoteV2Title";
    title.replaceChildren();

    const first = document.createElement("span");
    first.className = "mask-line";
    const firstText = document.createElement("span");
    firstText.textContent = "Conte-nos";
    first.append(firstText);

    const second = document.createElement("span");
    second.className = "mask-line";
    const secondText = document.createElement("span");
    secondText.className = "italic";
    secondText.textContent = "o que precisa.";
    second.append(secondText);

    title.append(first, second);
  }

  const intro = section.querySelector(".orcamento-info-sub");
  if (intro) {
    intro.textContent = "Três passos para partilhar o contacto, a necessidade e, se quiser, fotografias do local ou referências.";
  }

  const phoneLabel = section.querySelector('label[for="phone"]');
  if (phoneLabel) phoneLabel.textContent = "Telefone *";
}

function createBackdrop(section) {
  let backdrop = section.querySelector(".quote-v2-backdrop");
  if (backdrop) return backdrop;

  backdrop = document.createElement("div");
  backdrop.className = "quote-v2-backdrop";
  backdrop.setAttribute("aria-hidden", "true");
  backdrop.hidden = true;
  section.prepend(backdrop);
  return backdrop;
}

function createTaskClose(card) {
  let close = card.querySelector(".quote-v2-task-close");
  if (close) return close;

  close = document.createElement("button");
  close.type = "button";
  close.className = "quote-v2-task-close";
  close.setAttribute("aria-label", "Fechar formulário e voltar ao conteúdo");
  close.innerHTML = '<span aria-hidden="true">×</span><span>Fechar</span>';
  close.hidden = true;
  card.prepend(close);
  return close;
}

function createContextBanner(card) {
  let banner = card.querySelector(".quote-v2-context");
  if (banner) return banner;

  banner = document.createElement("div");
  banner.className = "quote-v2-context";
  banner.hidden = true;
  banner.setAttribute("aria-live", "polite");

  const media = document.createElement("div");
  media.className = "quote-v2-context-media";
  media.hidden = true;
  const image = document.createElement("img");
  image.alt = "";
  media.append(image);

  const copy = document.createElement("div");
  copy.className = "quote-v2-context-copy";

  const eyebrow = document.createElement("span");
  eyebrow.className = "quote-v2-context-eyebrow";

  const title = document.createElement("strong");
  title.className = "quote-v2-context-title";

  const detail = document.createElement("span");
  detail.className = "quote-v2-context-detail";

  copy.append(eyebrow, title, detail);

  const clear = document.createElement("button");
  clear.type = "button";
  clear.className = "quote-v2-context-clear";
  clear.textContent = "Remover referência";

  banner.append(media, copy, clear);

  const progress = card.querySelector(".form-progress");
  if (progress) progress.insertAdjacentElement("beforebegin", banner);
  else card.prepend(banner);
  return banner;
}

function projectImageFor(context) {
  if (context.type !== "PROJECT" || !context.projectRef) return "";
  const slide = [...document.querySelectorAll(".projeto-slide[data-project-slug]")]
    .find((element) => element.dataset.projectSlug === context.projectRef);
  const image = slide?.querySelector(".projeto-image-wrap img");
  return image?.currentSrc || image?.src || "";
}

function contextFromTrigger(trigger) {
  if (trigger.dataset.intentSource === "SERVICE") {
    const serviceType = trigger.dataset.serviceType || "";
    const card = trigger.closest(".service-v2-card");
    return {
      type: "SERVICE",
      serviceType,
      title: card?.querySelector(".service-v2-title")?.textContent?.trim() || SERVICE_LABELS[serviceType] || "Serviço SOLIMA",
    };
  }

  if (trigger.dataset.intentSource === "PROJECT") {
    return {
      type: "PROJECT",
      projectRef: trigger.dataset.projectRef || "",
      projectName: trigger.dataset.projectName || "Projeto SOLIMA",
      projectTheme: trigger.dataset.projectTheme || "",
      suggestedService: trigger.dataset.suggestedService || "",
    };
  }

  if (trigger.dataset.intentType === "PROCESS") {
    return { type: "PROCESS" };
  }

  return { type: "GENERIC" };
}

function findServiceInput(card, serviceType) {
  if (!serviceType) return null;
  return [...card.querySelectorAll('input[name="serviceType"]')]
    .find((element) => element.value === serviceType) || null;
}

function syncServiceSummary(card, serviceType) {
  if (!serviceType) return;
  const summary = card.querySelector(".summary");
  if (!summary) return;
  const rows = [...summary.querySelectorAll(".summary-row")];
  const row = rows.find((item) => item.querySelector(".summary-label")?.textContent?.trim() === "Serviço");
  const value = row?.querySelector(".summary-value");
  if (value) value.textContent = SERVICE_LABELS[serviceType] || serviceType;
}

function clearStaleAutoService(card, nextServiceType) {
  if (!quoteState.lastAutoService || nextServiceType) return;
  const input = findServiceInput(card, quoteState.lastAutoService);
  if (input?.checked) input.checked = false;
  quoteState.lastAutoService = "";
}

function preselectService(card, serviceType) {
  const input = findServiceInput(card, serviceType);
  if (!input) return;
  input.checked = true;
  quoteState.lastAutoService = serviceType;
  input.dispatchEvent(new Event("change", { bubbles: true }));
  syncServiceSummary(card, serviceType);
}

function watchManualServiceChoice(card) {
  card.querySelectorAll('input[name="serviceType"]').forEach((input) => {
    input.addEventListener("change", (event) => {
      if (event.isTrusted) quoteState.lastAutoService = "";
    });
  });
}

function renderContext(section, card) {
  const banner = createContextBanner(card);
  const media = banner.querySelector(".quote-v2-context-media");
  const image = media.querySelector("img");
  const eyebrow = banner.querySelector(".quote-v2-context-eyebrow");
  const title = banner.querySelector(".quote-v2-context-title");
  const detail = banner.querySelector(".quote-v2-context-detail");
  const context = quoteState.context;
  const nextServiceType = context.type === "SERVICE"
    ? context.serviceType
    : context.type === "PROJECT"
      ? context.suggestedService
      : "";

  clearStaleAutoService(card, nextServiceType);

  section.dataset.quoteContextType = context.type;
  delete section.dataset.quoteContextRef;
  delete section.dataset.quoteSuggestedService;

  if (context.type === "GENERIC") {
    banner.hidden = true;
    media.hidden = true;
    image.removeAttribute("src");
    image.alt = "";
    return;
  }

  banner.hidden = false;

  if (context.type === "SERVICE") {
    eyebrow.textContent = "Serviço pretendido";
    title.textContent = context.title;
    detail.textContent = "Fica pré-selecionado no passo 2 e pode ser alterado antes do envio.";
    media.hidden = true;
    image.removeAttribute("src");
    image.alt = "";
    section.dataset.quoteSuggestedService = context.serviceType;
    preselectService(card, context.serviceType);
    return;
  }

  if (context.type === "PROJECT") {
    eyebrow.textContent = "Projeto de referência";
    title.textContent = context.projectName;
    detail.textContent = context.suggestedService
      ? `Sugestão inicial: ${SERVICE_LABELS[context.suggestedService] || context.suggestedService}. Pode alterar no passo 2.`
      : "Usamos esta referência como contexto visual. O serviço é escolhido por si no passo 2.";
    section.dataset.quoteContextRef = context.projectRef;
    if (context.suggestedService) {
      section.dataset.quoteSuggestedService = context.suggestedService;
      preselectService(card, context.suggestedService);
    }

    const src = projectImageFor(context);
    if (src) {
      image.src = src;
      image.alt = `Referência visual: ${context.projectName}`;
      media.hidden = false;
    } else {
      media.hidden = true;
      image.removeAttribute("src");
      image.alt = "";
    }
    return;
  }

  eyebrow.textContent = "Como trabalhamos";
  title.textContent = "Começar pelo seu projeto";
  detail.textContent = "O pedido mantém os mesmos três passos e todas as escolhas continuam editáveis.";
  media.hidden = true;
  image.removeAttribute("src");
  image.alt = "";
}

function setContext(section, card, context) {
  quoteState.context = context;
  renderContext(section, card);
}

function inertBackground(section) {
  [...document.body.children].forEach((element) => {
    if (element === section || element.tagName === "SCRIPT") return;
    if (element.inert) return;
    element.inert = true;
    element.dataset.quoteV2Inerted = "";
  });
}

function restoreBackground() {
  document.querySelectorAll("[data-quote-v2-inerted]").forEach((element) => {
    element.inert = false;
    delete element.dataset.quoteV2Inerted;
  });
}

function taskFocusables(section) {
  return [...section.querySelectorAll('button, input, textarea, select, a[href], [tabindex]:not([tabindex="-1"])')]
    .filter((element) => !element.disabled && !element.hidden && element.getClientRects().length > 0);
}

function createPlaceholder(section) {
  const placeholder = document.createElement("div");
  placeholder.className = "quote-v2-placeholder";
  placeholder.setAttribute("aria-hidden", "true");
  placeholder.style.height = `${section.getBoundingClientRect().height}px`;
  section.insertAdjacentElement("beforebegin", placeholder);
  quoteState.placeholder = placeholder;
}

function removePlaceholder() {
  quoteState.placeholder?.remove();
  quoteState.placeholder = null;
}

function openTask(section, card, trigger) {
  if (quoteState.taskOpen) return;
  quoteState.taskOpen = true;
  quoteState.trigger = trigger;
  createPlaceholder(section);

  section.classList.add("quote-v2-task-open");
  section.setAttribute("role", "dialog");
  section.setAttribute("aria-modal", "true");
  section.setAttribute("aria-label", "Pedir orçamento à SOLIMA");
  document.body.classList.add("quote-v2-open");

  const backdrop = section.querySelector(".quote-v2-backdrop");
  const close = card.querySelector(".quote-v2-task-close");
  if (backdrop) backdrop.hidden = false;
  if (close) close.hidden = false;

  inertBackground(section);
  window.solimaLenis?.stop?.();
  requestAnimationFrame(() => close?.focus({ preventScroll: true }));
}

function closeTask(section, card, { restoreFocus = true } = {}) {
  if (!quoteState.taskOpen) return;
  quoteState.taskOpen = false;

  section.classList.remove("quote-v2-task-open");
  section.removeAttribute("role");
  section.removeAttribute("aria-modal");
  section.removeAttribute("aria-label");
  document.body.classList.remove("quote-v2-open");

  const backdrop = section.querySelector(".quote-v2-backdrop");
  const close = card.querySelector(".quote-v2-task-close");
  if (backdrop) backdrop.hidden = true;
  if (close) close.hidden = true;

  restoreBackground();
  removePlaceholder();
  window.solimaLenis?.start?.();

  if (restoreFocus && quoteState.trigger?.isConnected) {
    quoteState.trigger.focus({ preventScroll: true });
  }
  quoteState.trigger = null;
}

function installTaskBehavior(section, card) {
  const backdrop = createBackdrop(section);
  const close = createTaskClose(card);
  const banner = createContextBanner(card);

  backdrop.addEventListener("click", () => closeTask(section, card));
  close.addEventListener("click", () => closeTask(section, card));
  banner.querySelector(".quote-v2-context-clear")?.addEventListener("click", () => {
    setContext(section, card, { type: "GENERIC" });
  });

  document.addEventListener("click", (event) => {
    const trigger = event.target.closest('[data-intent-action="QUOTE"], [data-intent-type="PROCESS"], a[href="#orcamento"]');
    if (!trigger) return;
    event.preventDefault();
    setContext(section, card, contextFromTrigger(trigger));
    openTask(section, card, trigger);
  });

  document.addEventListener("keydown", (event) => {
    if (!quoteState.taskOpen) return;
    if (document.querySelector(".success-dialog[open]")) return;

    if (event.key === "Escape") {
      event.preventDefault();
      closeTask(section, card);
      return;
    }

    if (event.key !== "Tab") return;
    const focusables = taskFocusables(section);
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  const successDialog = card.querySelector(".success-dialog");
  successDialog?.addEventListener("close", () => {
    if (quoteState.taskOpen) closeTask(section, card);
  });
}

export function initQuoteV2() {
  ensureQuoteStyles();
  const section = document.querySelector("#orcamento");
  const card = section?.querySelector(".orcamento-form-card");
  const form = card?.querySelector("#orcamentoForm");
  if (!section || !card || !form) return;

  normalizeQuoteCopy(section);
  watchManualServiceChoice(card);
  installTaskBehavior(section, card);
  setContext(section, card, { type: "GENERIC" });
}
