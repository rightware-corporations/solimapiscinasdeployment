const PROCESS_STYLE_HREF = "/css/process-v2.css";

const PROCESS_STEPS = Object.freeze([
  {
    index: 1,
    title: "Conversamos",
    description: "Percebemos o objetivo, o espaço e a forma como a piscina deverá ser usada.",
  },
  {
    index: 2,
    title: "Avaliamos",
    description: "Analisamos o local, as condições existentes e as necessidades técnicas quando aplicável.",
  },
  {
    index: 3,
    title: "Desenvolvemos a solução",
    description: "Ligamos engenharia, design, equipamentos e âmbito numa solução coerente para o projeto.",
  },
  {
    index: 4,
    title: "Apresentamos a proposta",
    description: "Escopo, materiais, condições e cronograma são apresentados antes da execução.",
  },
  {
    index: 5,
    title: "Executamos",
    description: "A obra segue a solução aprovada com acompanhamento técnico ao longo das etapas.",
  },
  {
    index: 6,
    title: "Entregamos e acompanhamos",
    description: "Orientamos a utilização e mantemos o seguimento técnico adequado ao projeto.",
  },
]);

const ASSURANCES = Object.freeze([
  {
    title: "Escopo claro",
    description: "O que está incluído é definido antes do início da execução.",
  },
  {
    title: "Cronograma por projeto",
    description: "O prazo é estabelecido conforme o escopo e apresentado na proposta.",
  },
  {
    title: "Continuidade técnica",
    description: "A entrega inclui orientação e o seguimento adequado à solução executada.",
  },
]);

function ensureProcessStyles() {
  if (document.querySelector('link[data-solima-process-v2]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = PROCESS_STYLE_HREF;
  link.dataset.solimaProcessV2 = "";
  document.head.append(link);
}

function createMarker() {
  const marker = document.createElement("span");
  marker.className = "process-v2-marker";
  marker.setAttribute("aria-hidden", "true");
  marker.append(document.createElement("span"), document.createElement("span"), document.createElement("span"));
  return marker;
}

function createStep(step) {
  const item = document.createElement("li");
  item.className = "process-v2-step";

  const head = document.createElement("div");
  head.className = "process-v2-step-head";

  const index = document.createElement("span");
  index.className = "process-v2-step-index";
  index.textContent = String(step.index).padStart(2, "0");

  head.append(createMarker(), index);

  const title = document.createElement("h3");
  title.className = "process-v2-step-title";
  title.textContent = step.title;

  const description = document.createElement("p");
  description.className = "process-v2-step-description";
  description.textContent = step.description;

  item.append(head, title, description);
  return item;
}

function createAssurance(assurance) {
  const item = document.createElement("li");
  item.className = "process-v2-assurance";

  const title = document.createElement("strong");
  title.textContent = assurance.title;

  const description = document.createElement("p");
  description.textContent = assurance.description;

  item.append(title, description);
  return item;
}

function createProcessSection() {
  const section = document.createElement("section");
  section.id = "processo";
  section.className = "process-v2";
  section.dataset.processV2 = "";
  section.setAttribute("aria-labelledby", "processV2Title");

  const inner = document.createElement("div");
  inner.className = "process-v2-inner";

  const header = document.createElement("header");
  header.className = "process-v2-header";

  const eyebrow = document.createElement("p");
  eyebrow.className = "process-v2-eyebrow";
  eyebrow.textContent = "Como trabalhamos";

  const title = document.createElement("h2");
  title.id = "processV2Title";
  title.className = "process-v2-title";
  title.innerHTML = 'Clareza em cada etapa, <span>antes da obra.</span>';

  const lead = document.createElement("p");
  lead.className = "process-v2-lead";
  lead.textContent = "Cada projeto avança por etapas claras, com decisões técnicas e comerciais alinhadas antes da execução.";

  header.append(eyebrow, title, lead);

  const steps = document.createElement("ol");
  steps.className = "process-v2-steps";
  PROCESS_STEPS.forEach((step) => steps.append(createStep(step)));

  const assuranceWrap = document.createElement("div");
  assuranceWrap.className = "process-v2-assurance-wrap";

  const assuranceLabel = document.createElement("p");
  assuranceLabel.className = "process-v2-assurance-label";
  assuranceLabel.textContent = "O que pode esperar do processo";

  const assuranceList = document.createElement("ul");
  assuranceList.className = "process-v2-assurances";
  assuranceList.setAttribute("role", "list");
  ASSURANCES.forEach((assurance) => assuranceList.append(createAssurance(assurance)));

  assuranceWrap.append(assuranceLabel, assuranceList);

  const action = document.createElement("a");
  action.className = "process-v2-cta";
  action.href = "#orcamento";
  action.dataset.processCta = "";
  action.dataset.intentType = "PROCESS";
  action.innerHTML = '<span>Começar pelo meu projeto</span><span aria-hidden="true">↗</span>';

  inner.append(header, steps, assuranceWrap, action);
  section.append(inner);
  return section;
}

function simplifyQuoteSection() {
  const promises = document.querySelector(".orcamento-promise");
  if (!promises) return;
  promises.hidden = true;
  promises.dataset.movedToProcess = "";
}

function placeAfterWhy(section) {
  const why = document.querySelector("[data-why-v2]");
  if (!why) return;
  why.insertAdjacentElement("afterend", section);
}

export function initProcessV2() {
  ensureProcessStyles();
  document.querySelector("[data-process-v2]")?.remove();

  const section = createProcessSection();
  placeAfterWhy(section);
  simplifyQuoteSection();
}
