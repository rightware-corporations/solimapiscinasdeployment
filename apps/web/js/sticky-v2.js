const STICKY_STYLE_HREF = "/css/sticky-v2.css";
const MOBILE_QUERY = "(max-width: 767px)";

const SERVICE_STICKY_LABELS = Object.freeze({
  NEW_CONSTRUCTION: "Quero construir uma piscina",
  MODERNIZATION: "Quero modernizar a minha piscina",
  MAINTENANCE: "Quero manutenção",
});

function ensureStickyStyles() {
  if (document.querySelector('link[data-solima-sticky-v2]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = STICKY_STYLE_HREF;
  link.dataset.solimaStickyV2 = "";
  document.head.append(link);
}

function createSticky() {
  const shell = document.createElement("div");
  shell.className = "sticky-v2";
  shell.dataset.stickyV2 = "";
  shell.hidden = true;

  const cta = document.createElement("a");
  cta.className = "sticky-v2-cta";
  cta.href = "#orcamento";
  cta.dataset.intentAction = "QUOTE";
  cta.dataset.intentPlacement = "STICKY";

  const label = document.createElement("span");
  label.className = "sticky-v2-label";
  label.textContent = "Pedir orçamento";

  const arrow = document.createElement("span");
  arrow.className = "sticky-v2-arrow";
  arrow.setAttribute("aria-hidden", "true");
  arrow.textContent = "↗";

  cta.append(label, arrow);
  shell.append(cta);
  document.body.append(shell);
  return shell;
}

function clearIntentDataset(cta) {
  [
    "intentSource",
    "projectRef",
    "projectName",
    "projectTheme",
    "suggestedService",
    "serviceType",
  ].forEach((key) => delete cta.dataset[key]);
}

function setGenericIntent(sticky) {
  const cta = sticky.querySelector(".sticky-v2-cta");
  const label = sticky.querySelector(".sticky-v2-label");
  clearIntentDataset(cta);
  cta.dataset.intentSource = "STICKY";
  cta.setAttribute("aria-label", "Pedir orçamento");
  label.textContent = "Pedir orçamento";
  sticky.dataset.stickyContext = "GENERIC";
  delete sticky.dataset.stickyRef;
}

function setProjectIntent(sticky, projectCta) {
  const cta = sticky.querySelector(".sticky-v2-cta");
  const label = sticky.querySelector(".sticky-v2-label");
  clearIntentDataset(cta);

  cta.dataset.intentSource = "PROJECT";
  cta.dataset.projectRef = projectCta.dataset.projectRef || "";
  cta.dataset.projectName = projectCta.dataset.projectName || "Projeto SOLIMA";
  cta.dataset.projectTheme = projectCta.dataset.projectTheme || "";
  if (projectCta.dataset.suggestedService) {
    cta.dataset.suggestedService = projectCta.dataset.suggestedService;
  }

  cta.setAttribute("aria-label", `Quero algo como ${cta.dataset.projectName}`);
  label.textContent = "Quero algo como isto";
  sticky.dataset.stickyContext = "PROJECT";
  sticky.dataset.stickyRef = cta.dataset.projectRef;
}

function setServiceIntent(sticky, serviceCta) {
  const cta = sticky.querySelector(".sticky-v2-cta");
  const label = sticky.querySelector(".sticky-v2-label");
  const type = serviceCta.dataset.serviceType || "";
  clearIntentDataset(cta);

  cta.dataset.intentSource = "SERVICE";
  cta.dataset.serviceType = type;
  const text = SERVICE_STICKY_LABELS[type]
    || serviceCta.textContent?.replace(/\s+/g, " ").trim()
    || "Pedir orçamento";
  cta.setAttribute("aria-label", text);
  label.textContent = text;
  sticky.dataset.stickyContext = "SERVICE";
  sticky.dataset.stickyRef = type;
}

function visibleRatio(element) {
  const rect = element.getBoundingClientRect();
  const navBottom = document.querySelector("#nav")?.getBoundingClientRect().bottom || 0;
  const top = Math.max(rect.top, navBottom, 0);
  const bottom = Math.min(rect.bottom, innerHeight);
  const visible = Math.max(0, bottom - top);
  const reference = Math.max(1, Math.min(rect.height, innerHeight - navBottom));
  return visible / reference;
}

function bestVisible(selector) {
  let best = null;
  let ratio = 0;
  document.querySelectorAll(selector).forEach((element) => {
    const current = visibleRatio(element);
    if (current > ratio) {
      ratio = current;
      best = element;
    }
  });
  return { element: best, ratio };
}

function sectionContainsProbe(selector, probeY) {
  const element = document.querySelector(selector);
  if (!element) return false;
  const rect = element.getBoundingClientRect();
  return rect.top <= probeY && rect.bottom >= probeY;
}

function shouldHideForOverlay() {
  return document.body.classList.contains("quote-v2-open")
    || document.body.classList.contains("menu-open");
}

function chooseContext(sticky) {
  const mobile = matchMedia(MOBILE_QUERY);
  if (!mobile.matches || shouldHideForOverlay()) return { visible: false };

  const probeY = Math.min(innerHeight * .62, innerHeight - 96);

  if (
    sectionContainsProbe(".hero", probeY)
    || sectionContainsProbe("#orcamento", probeY)
    || sectionContainsProbe("#contacto", probeY)
    || sectionContainsProbe("footer", probeY)
  ) {
    return { visible: false };
  }

  if (sectionContainsProbe("#projetos", probeY)) {
    const candidate = bestVisible("#projetos .projeto-slide");
    const cta = candidate.element?.querySelector(".project-v2-quote-cta");
    if (candidate.ratio >= .32 && cta) return { visible: true, kind: "PROJECT", source: cta };
  }

  if (sectionContainsProbe("#servicos", probeY)) {
    const candidate = bestVisible("#servicos .service-v2-card");
    const cta = candidate.element?.querySelector(".service-v2-quote-cta");
    if (candidate.ratio >= .32 && cta) return { visible: true, kind: "SERVICE", source: cta };
  }

  if (
    sectionContainsProbe("#sobre[data-why-v2]", probeY)
    || sectionContainsProbe("[data-process-v2]", probeY)
    || sectionContainsProbe("[data-clients-v2]", probeY)
  ) {
    return { visible: true, kind: "GENERIC" };
  }

  return { visible: false };
}

function applyContext(sticky) {
  const next = chooseContext(sticky);
  if (!next.visible) {
    sticky.hidden = true;
    document.documentElement.dataset.stickyV2Visible = "false";
    return;
  }

  if (next.kind === "PROJECT") setProjectIntent(sticky, next.source);
  else if (next.kind === "SERVICE") setServiceIntent(sticky, next.source);
  else setGenericIntent(sticky);

  sticky.hidden = false;
  document.documentElement.dataset.stickyV2Visible = "true";
}

export function initStickyV2() {
  ensureStickyStyles();
  document.querySelector("[data-sticky-v2]")?.remove();
  const sticky = createSticky();
  document.documentElement.dataset.stickyV2Ready = "true";

  let ticking = false;
  const schedule = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      applyContext(sticky);
    });
  };

  addEventListener("scroll", schedule, { passive: true });
  addEventListener("resize", schedule, { passive: true });
  matchMedia(MOBILE_QUERY).addEventListener?.("change", schedule);

  const bodyObserver = new MutationObserver(schedule);
  bodyObserver.observe(document.body, { attributes: true, attributeFilter: ["class"] });

  schedule();
}
