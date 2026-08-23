const WHY_STYLE_HREF = "/css/why-v2.css";

const PILLARS = Object.freeze([
  {
    index: 1,
    title: "Engenharia",
    description: "Estrutura, hidráulica e execução são pensadas como partes da mesma solução.",
  },
  {
    index: 2,
    title: "Design",
    description: "Forma, proporção e acabamentos dialogam com a arquitetura e com a forma de usar o espaço.",
  },
  {
    index: 3,
    title: "Tecnologia",
    description: "Iluminação, automatização e equipamentos são avaliados conforme a necessidade de cada projeto.",
  },
  {
    index: 4,
    title: "Durabilidade",
    description: "Materiais e decisões técnicas consideram desempenho, manutenção e continuidade de uso.",
  },
  {
    index: 5,
    title: "Acompanhamento",
    description: "A conversa, a avaliação, a proposta, a execução e o seguimento mantêm o contexto do projeto ao longo das etapas.",
  },
]);

function ensureWhyStyles() {
  if (document.querySelector('link[data-solima-why-v2]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = WHY_STYLE_HREF;
  link.dataset.solimaWhyV2 = "";
  document.head.append(link);
}

function removeLegacyStorySections() {
  [
    "section.sobre#sobre",
    "section.inspiracao",
    "section.lazer",
    "section.visao#visao",
  ].forEach((selector) => document.querySelector(selector)?.remove());
}

function createMosaicMarker() {
  const marker = document.createElement("span");
  marker.className = "why-v2-marker";
  marker.setAttribute("aria-hidden", "true");
  marker.append(document.createElement("span"), document.createElement("span"), document.createElement("span"));
  return marker;
}

function createPillar(pillar) {
  const item = document.createElement("li");
  item.className = "why-v2-pillar";

  const index = document.createElement("span");
  index.className = "why-v2-pillar-index";
  index.textContent = String(pillar.index).padStart(2, "0");

  const marker = createMosaicMarker();

  const copy = document.createElement("div");
  copy.className = "why-v2-pillar-copy";

  const title = document.createElement("h3");
  title.className = "why-v2-pillar-title";
  title.textContent = pillar.title;

  const description = document.createElement("p");
  description.className = "why-v2-pillar-description";
  description.textContent = pillar.description;

  copy.append(title, description);
  item.append(index, marker, copy);
  return item;
}

function createWhySection() {
  const section = document.createElement("section");
  section.id = "sobre";
  section.className = "why-v2";
  section.dataset.whyV2 = "";
  section.setAttribute("aria-labelledby", "whyV2Title");

  // Preserve old deep links while the public navigation now uses #sobre.
  const legacyAnchor = document.createElement("span");
  legacyAnchor.id = "visao";
  legacyAnchor.className = "why-v2-anchor-alias";
  legacyAnchor.setAttribute("aria-hidden", "true");

  const inner = document.createElement("div");
  inner.className = "why-v2-inner";

  const header = document.createElement("header");
  header.className = "why-v2-header";

  const eyebrow = document.createElement("p");
  eyebrow.className = "why-v2-eyebrow";
  eyebrow.textContent = "Porquê SOLIMA";

  const title = document.createElement("h2");
  title.id = "whyV2Title";
  title.className = "why-v2-title";
  title.innerHTML = 'Uma piscina bonita começa <span>muito antes da água.</span>';

  const lead = document.createElement("p");
  lead.className = "why-v2-lead";
  lead.textContent = "O resultado começa no modo como cada decisão técnica, estética e operacional é ligada ao mesmo projeto.";

  const principle = document.createElement("p");
  principle.className = "why-v2-principle";
  principle.textContent = "Cinco princípios orientam o modo como pensamos cada solução.";

  header.append(eyebrow, title, lead, principle);

  const body = document.createElement("div");
  body.className = "why-v2-body";

  const list = document.createElement("ol");
  list.className = "why-v2-pillars";
  PILLARS.forEach((pillar) => list.append(createPillar(pillar)));

  const sustainability = document.createElement("aside");
  sustainability.className = "why-v2-sustainability";

  const sustainabilityMarker = createMosaicMarker();
  sustainabilityMarker.classList.add("is-transversal");

  const sustainabilityCopy = document.createElement("div");
  const sustainabilityLabel = document.createElement("strong");
  sustainabilityLabel.textContent = "Sustentabilidade transversal";
  const sustainabilityText = document.createElement("p");
  sustainabilityText.textContent = "Eficiência no uso de água e energia é considerada nas escolhas técnicas quando aplicável ao projeto.";
  sustainabilityCopy.append(sustainabilityLabel, sustainabilityText);

  sustainability.append(sustainabilityMarker, sustainabilityCopy);
  body.append(list, sustainability);
  inner.append(header, body);
  section.append(legacyAnchor, inner);
  return section;
}

function updateNavigationLabel() {
  document.querySelectorAll('.nav-link[href="#sobre"], .nav-overlay-link[href="#sobre"]').forEach((link) => {
    link.textContent = "Porquê SOLIMA";
  });
}

function placeAfterServices(section) {
  const services = document.querySelector("[data-services-v2]");
  if (!services) return;
  services.insertAdjacentElement("afterend", section);
}

export function initWhyV2() {
  ensureWhyStyles();
  removeLegacyStorySections();
  document.querySelector("[data-why-v2]")?.remove();

  const section = createWhySection();
  placeAfterServices(section);
  updateNavigationLabel();
}
