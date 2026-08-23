const CLIENTS_STYLE_HREF = "/css/clients-v2.css";

const MARKETS = Object.freeze([
  {
    index: 1,
    title: "Residências",
    description: "Piscinas novas, modernizações e manutenção pensadas para o espaço e a rotina de cada casa.",
  },
  {
    index: 2,
    title: "Condomínios",
    description: "Soluções para áreas comuns com atenção à utilização contínua, operação e manutenção.",
  },
  {
    index: 3,
    title: "Hotelaria",
    description: "Piscinas integradas à experiência de lazer e às necessidades operacionais do empreendimento.",
  },
  {
    index: 4,
    title: "Educação",
    description: "Soluções institucionais orientadas ao contexto de utilização, segurança e continuidade de cuidado.",
  },
  {
    index: 5,
    title: "Empreendimentos",
    description: "Coordenação com arquitetura, obra e requisitos técnicos de projetos imobiliários e institucionais.",
  },
]);

const REFERENCES = Object.freeze([
  {
    name: "SS Construções",
    context: "Contexto residencial · Maputo",
  },
  {
    name: "Mozago Construções",
    context: "Construção e reabilitação · Moçambique",
  },
  {
    name: "Colégio Percia",
    context: "Contexto educativo · Maputo",
  },
]);

function ensureClientsStyles() {
  if (document.querySelector('link[data-solima-clients-v2]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = CLIENTS_STYLE_HREF;
  link.dataset.solimaClientsV2 = "";
  document.head.append(link);
}

function createMarker(className = "clients-v2-marker") {
  const marker = document.createElement("span");
  marker.className = className;
  marker.setAttribute("aria-hidden", "true");
  marker.append(document.createElement("span"), document.createElement("span"), document.createElement("span"));
  return marker;
}

function createMarket(market) {
  const item = document.createElement("li");
  item.className = "clients-v2-market";

  const meta = document.createElement("div");
  meta.className = "clients-v2-market-meta";

  const index = document.createElement("span");
  index.className = "clients-v2-market-index";
  index.textContent = String(market.index).padStart(2, "0");
  meta.append(createMarker(), index);

  const title = document.createElement("h3");
  title.className = "clients-v2-market-title";
  title.textContent = market.title;

  const description = document.createElement("p");
  description.className = "clients-v2-market-description";
  description.textContent = market.description;

  item.append(meta, title, description);
  return item;
}

function createReference(reference) {
  const item = document.createElement("li");
  item.className = "clients-v2-reference";

  const name = document.createElement("strong");
  name.className = "clients-v2-reference-name";
  name.textContent = reference.name;

  const context = document.createElement("span");
  context.className = "clients-v2-reference-context";
  context.textContent = reference.context;

  item.append(name, context);
  return item;
}

function createClientsSection() {
  const section = document.createElement("section");
  section.id = "clientes";
  section.className = "clients-v2";
  section.dataset.clientsV2 = "";
  section.setAttribute("aria-labelledby", "clientsV2Title");

  const inner = document.createElement("div");
  inner.className = "clients-v2-inner";

  const header = document.createElement("header");
  header.className = "clients-v2-header";

  const eyebrow = document.createElement("p");
  eyebrow.className = "clients-v2-eyebrow";
  eyebrow.textContent = "Clientes & mercados";

  const title = document.createElement("h2");
  title.id = "clientsV2Title";
  title.className = "clients-v2-title";
  title.innerHTML = 'Da residência <span>ao empreendimento.</span>';

  const lead = document.createElement("p");
  lead.className = "clients-v2-lead";
  lead.textContent = "A mesma disciplina de projeto adapta-se a diferentes escalas, usos e contextos de operação.";

  header.append(eyebrow, title, lead);

  const markets = document.createElement("ol");
  markets.className = "clients-v2-markets";
  MARKETS.forEach((market) => markets.append(createMarket(market)));

  const proof = document.createElement("div");
  proof.className = "clients-v2-proof";

  const proofIntro = document.createElement("div");
  proofIntro.className = "clients-v2-proof-intro";

  const proofLabel = document.createElement("p");
  proofLabel.className = "clients-v2-proof-label";
  proofLabel.textContent = "Referências apresentadas pela SOLIMA";

  const proofCopy = document.createElement("p");
  proofCopy.className = "clients-v2-proof-copy";
  proofCopy.textContent = "Alguns nomes já presentes na comunicação atual da empresa, apresentados aqui sem métricas ou testemunhos não validados.";

  proofIntro.append(proofLabel, proofCopy);

  const references = document.createElement("ul");
  references.className = "clients-v2-references";
  references.setAttribute("role", "list");
  REFERENCES.forEach((reference) => references.append(createReference(reference)));

  proof.append(proofIntro, references);

  const social = document.createElement("aside");
  social.className = "clients-v2-social";
  social.setAttribute("aria-labelledby", "clientsV2SocialTitle");

  const socialMarker = createMarker("clients-v2-marker is-social");
  const socialCopy = document.createElement("div");

  const socialLabel = document.createElement("p");
  socialLabel.className = "clients-v2-social-label";
  socialLabel.textContent = "Iniciativa social";

  const socialTitle = document.createElement("h3");
  socialTitle.id = "clientsV2SocialTitle";
  socialTitle.className = "clients-v2-social-title";
  socialTitle.textContent = "Nadando para o Futuro";

  const socialText = document.createElement("p");
  socialText.className = "clients-v2-social-text";
  socialText.textContent = "Uma iniciativa apresentada pela SOLIMA que aproxima educação, inclusão e uma cultura aquática segura para novas gerações.";

  socialCopy.append(socialLabel, socialTitle, socialText);
  social.append(socialMarker, socialCopy);

  inner.append(header, markets, proof, social);
  section.append(inner);
  return section;
}

function removeLegacyClientSections() {
  document.querySelector("section.publico")?.remove();
  document.querySelector("section.clientes")?.remove();
}

function placeAfterProcess(section) {
  const process = document.querySelector("[data-process-v2]");
  if (!process) return;
  process.insertAdjacentElement("afterend", section);
}

export function initClientsV2() {
  ensureClientsStyles();
  removeLegacyClientSections();
  document.querySelector("[data-clients-v2]")?.remove();

  const section = createClientsSection();
  placeAfterProcess(section);
}
