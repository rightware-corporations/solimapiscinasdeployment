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

export function initProofV2() {
  ensureProofStyles();

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
