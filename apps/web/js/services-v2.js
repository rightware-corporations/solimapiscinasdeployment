const SERVICE_STYLE_HREF = "/css/services-v2.css";

const SERVICES = Object.freeze([
  {
    index: 1,
    type: "NEW_CONSTRUCTION",
    question: "Ainda não tenho piscina.",
    title: "Construção",
    subtitle: "Criar de raiz",
    description: "Planeamos e executamos uma solução adaptada ao espaço, ao uso pretendido e à arquitetura do local.",
    points: [
      "Projeto e execução técnica coordenados",
      "Geometrias retangulares, orgânicas ou personalizadas",
      "Sistemas hidráulicos e acabamentos definidos para cada solução",
    ],
    cta: "Quero construir uma piscina",
    icon: "hammer",
  },
  {
    index: 2,
    type: "MODERNIZATION",
    question: "Já tenho, mas quero melhorar.",
    title: "Modernização",
    subtitle: "Evoluir o que já existe",
    description: "Atualizamos a piscina e o espaço envolvente com soluções técnicas, novos acabamentos e tecnologia adequada ao projeto.",
    points: [
      "Reabilitação e atualização de acabamentos",
      "Iluminação e automatização quando aplicáveis",
      "Melhorias técnicas definidas após avaliação",
    ],
    cta: "Quero modernizar a minha piscina",
    icon: "zap",
  },
  {
    index: 3,
    type: "MAINTENANCE",
    question: "Já tenho e preciso de cuidar.",
    title: "Manutenção",
    subtitle: "Cuidar com continuidade",
    description: "Avaliamos o estado da piscina e tratamos as necessidades de limpeza, água, equipamentos e funcionamento técnico.",
    points: [
      "Limpeza e controlo da água",
      "Revisão de filtros, bombas e componentes",
      "Diagnóstico e intervenção conforme a necessidade",
    ],
    cta: "Quero manutenção",
    icon: "wrench",
  },
]);

function ensureServiceStyles() {
  if (document.querySelector('link[data-solima-services-v2]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = SERVICE_STYLE_HREF;
  link.dataset.solimaServicesV2 = "";
  document.head.append(link);
}

function serviceCardMarkup(service) {
  const article = document.createElement("article");
  article.className = "service-v2-card";
  article.dataset.serviceType = service.type;

  const head = document.createElement("div");
  head.className = "service-v2-card-head";

  const number = document.createElement("span");
  number.className = "service-v2-number";
  number.setAttribute("aria-hidden", "true");
  number.textContent = String(service.index).padStart(2, "0");

  const iconWrap = document.createElement("span");
  iconWrap.className = "service-v2-icon";
  iconWrap.setAttribute("aria-hidden", "true");
  const icon = document.createElement("i");
  icon.dataset.lucide = service.icon;
  iconWrap.append(icon);

  head.append(number, iconWrap);

  const question = document.createElement("p");
  question.className = "service-v2-question";
  question.textContent = service.question;

  const title = document.createElement("h3");
  title.className = "service-v2-title";
  title.textContent = service.title;

  const subtitle = document.createElement("p");
  subtitle.className = "service-v2-subtitle";
  subtitle.textContent = service.subtitle;

  const description = document.createElement("p");
  description.className = "service-v2-description";
  description.textContent = service.description;

  const detailsId = `serviceV2Details${service.index}`;
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "service-v2-details-toggle";
  toggle.setAttribute("aria-expanded", "false");
  toggle.setAttribute("aria-controls", detailsId);
  toggle.innerHTML = '<span>Ver detalhes</span><span class="service-v2-toggle-icon" aria-hidden="true">+</span>';

  const details = document.createElement("div");
  details.id = detailsId;
  details.className = "service-v2-details";
  const list = document.createElement("ul");
  list.setAttribute("role", "list");
  service.points.forEach((point) => {
    const item = document.createElement("li");
    item.textContent = point;
    list.append(item);
  });
  details.append(list);

  const cta = document.createElement("a");
  cta.className = "service-v2-quote-cta";
  cta.href = "#orcamento";
  cta.dataset.intentAction = "QUOTE";
  cta.dataset.intentSource = "SERVICE";
  cta.dataset.serviceType = service.type;
  cta.setAttribute("aria-label", service.cta);
  const ctaLabel = document.createElement("span");
  ctaLabel.textContent = service.cta;
  const arrow = document.createElement("span");
  arrow.className = "service-v2-quote-arrow";
  arrow.setAttribute("aria-hidden", "true");
  arrow.textContent = "↗";
  cta.append(ctaLabel, arrow);

  article.append(head, question, title, subtitle, description, toggle, details, cta);
  return article;
}

function buildSection(section) {
  const waterField = section.querySelector(".water-field");
  section.replaceChildren();
  if (waterField) section.append(waterField);

  const container = document.createElement("div");
  container.className = "container service-v2-container";

  const header = document.createElement("header");
  header.className = "service-v2-header";

  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = "Serviços SOLIMA";

  const heading = document.createElement("h2");
  heading.id = "servicesV2Title";
  heading.className = "service-v2-heading";
  heading.innerHTML = 'O que precisa <span class="italic">da sua piscina?</span>';

  const intro = document.createElement("p");
  intro.className = "service-v2-intro";
  intro.textContent = "Escolha pelo ponto onde está hoje. A solução final é definida depois de compreendermos o espaço, a necessidade e o objetivo do projeto.";

  header.append(eyebrow, heading, intro);

  const grid = document.createElement("div");
  grid.className = "service-v2-grid";
  SERVICES.forEach((service) => grid.append(serviceCardMarkup(service)));

  container.append(header, grid);
  section.append(container);
}

function initDetails(section) {
  const mobile = matchMedia("(max-width: 767px)");
  const cards = [...section.querySelectorAll(".service-v2-card")];

  const applyMode = () => {
    cards.forEach((card) => {
      const toggle = card.querySelector(".service-v2-details-toggle");
      const details = card.querySelector(".service-v2-details");
      if (!toggle || !details) return;

      if (mobile.matches) {
        toggle.hidden = false;
        const expanded = toggle.getAttribute("aria-expanded") === "true";
        details.hidden = !expanded;
        card.dataset.expanded = String(expanded);
      } else {
        toggle.hidden = true;
        details.hidden = false;
        card.dataset.expanded = "true";
      }
    });
  };

  cards.forEach((card) => {
    const toggle = card.querySelector(".service-v2-details-toggle");
    const details = card.querySelector(".service-v2-details");
    if (!toggle || !details) return;

    toggle.addEventListener("click", () => {
      if (!mobile.matches) return;
      const expanded = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", String(!expanded));
      details.hidden = expanded;
      card.dataset.expanded = String(!expanded);
    });
  });

  mobile.addEventListener?.("change", applyMode);
  applyMode();
}

function placeAfterProjects(section) {
  const projects = document.querySelector("[data-projects-v2]");
  if (!projects || projects.nextElementSibling === section) return;
  projects.insertAdjacentElement("afterend", section);
}

export function initServicesV2() {
  ensureServiceStyles();
  const section = document.querySelector("#servicos");
  if (!section) return;

  section.dataset.servicesV2 = "";
  section.setAttribute("aria-labelledby", "servicesV2Title");
  buildSection(section);
  initDetails(section);
  placeAfterProjects(section);
}
