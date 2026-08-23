const PROOF_STYLE_HREF = "/css/proof-v2.css";

const PROOF_ITEMS = Object.freeze([
  {
    label: "Maputo · Moçambique",
    detail: "Presença local para conversar, avaliar e acompanhar cada solução.",
  },
  {
    label: "Construção · Modernização · Manutenção",
    detail: "Serviços claros para criar, melhorar ou cuidar da sua piscina.",
  },
  {
    label: "Engenharia · Design · Acompanhamento",
    detail: "Uma abordagem integrada, do planeamento à continuidade do projeto.",
  },
]);

function ensureProofStyles() {
  if (document.querySelector('link[data-solima-proof-v2]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = PROOF_STYLE_HREF;
  link.dataset.solimaProofV2 = "";
  document.head.append(link);
}

function proofItemMarkup({ label, detail }) {
  const item = document.createElement("li");
  item.className = "proof-v2-item";

  const marker = document.createElement("span");
  marker.className = "proof-v2-marker";
  marker.setAttribute("aria-hidden", "true");

  const copy = document.createElement("span");
  copy.className = "proof-v2-copy";

  const labelElement = document.createElement("strong");
  labelElement.className = "proof-v2-label";
  labelElement.textContent = label;

  const detailElement = document.createElement("span");
  detailElement.className = "proof-v2-detail";
  detailElement.textContent = detail;

  copy.append(labelElement, detailElement);
  item.append(marker, copy);
  return item;
}

function applyLegacyClaimGuard() {
  // These elements belong to sections scheduled for later v2 replacement.
  // Until their business claims are explicitly validated, keep the rendered
  // page factual rather than exposing legacy quantified/absolute promises.
  const imageCounter = document.querySelector(".sobre-image-meta > div:last-child");
  if (imageCounter) imageCounter.textContent = "Projeto SOLIMA";

  const legacyStatCard = document.querySelector(".sobre-stat-card");
  if (legacyStatCard) {
    legacyStatCard.hidden = true;
    legacyStatCard.dataset.claimGuarded = "";
  }

  const legacyStats = document.querySelector(".sobre-stats");
  if (legacyStats) {
    legacyStats.hidden = true;
    legacyStats.dataset.claimGuarded = "";
  }

  const aboutCopy = document.querySelector(".sobre-copy");
  if (aboutCopy) {
    aboutCopy.textContent = "A SOLIMA projeta, constrói e mantém piscinas privadas, comerciais e institucionais — combinando engenharia, execução técnica e design contemporâneo.";
  }

  const deliveryPromise = document.querySelector(".orcamento-promise-row:first-child .orcamento-promise-text");
  if (deliveryPromise) {
    const title = deliveryPromise.querySelector("strong");
    const detail = deliveryPromise.querySelector("span");
    if (title) title.textContent = "Prazo definido antes da obra";
    if (detail) detail.textContent = "O cronograma é definido de acordo com cada projeto e apresentado na proposta.";
  }

  const footerTag = document.querySelector(".footer-tag span");
  if (footerTag) footerTag.textContent = "Engenharia, design e acompanhamento em Moçambique";
}

export function initProofV2() {
  ensureProofStyles();
  applyLegacyClaimGuard();

  if (document.querySelector("[data-proof-v2]")) return;
  const hero = document.querySelector(".hero");
  if (!hero) return;

  const section = document.createElement("section");
  section.className = "proof-v2";
  section.dataset.proofV2 = "";
  section.setAttribute("aria-labelledby", "proofV2Title");

  const inner = document.createElement("div");
  inner.className = "proof-v2-inner";

  const title = document.createElement("h2");
  title.id = "proofV2Title";
  title.className = "proof-v2-title";
  title.textContent = "Confiança SOLIMA";

  const list = document.createElement("ul");
  list.className = "proof-v2-grid";
  list.setAttribute("role", "list");
  PROOF_ITEMS.forEach((item) => list.append(proofItemMarkup(item)));

  inner.append(title, list);
  section.append(inner);
  hero.insertAdjacentElement("afterend", section);
}
