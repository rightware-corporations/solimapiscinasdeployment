const PROJECT_STYLE_HREF = "/css/projects-v2.css";

const PROJECTS = Object.freeze([
  {
    index: 1,
    slug: "vista-do-vale",
    serviceCategory: "NEW_CONSTRUCTION",
    serviceLabel: "Construção",
    theme: "NATURE_ENGINEERING",
    themeLabel: "Natureza & engenharia",
  },
  {
    index: 2,
    slug: "residencia-sommerschield",
    serviceCategory: "MODERNIZATION",
    serviceLabel: "Modernização",
    theme: "TRANSFORMATION_TECHNOLOGY",
    themeLabel: "Transformação & tecnologia",
  },
  {
    index: 3,
    slug: "composite-deck",
    serviceCategory: "NEW_CONSTRUCTION",
    serviceLabel: "Construção",
    theme: "DESIGN_COMPACT",
    themeLabel: "Design & espaço compacto",
  },
  {
    index: 4,
    slug: "crepusculo-aquatico",
    serviceCategory: "MODERNIZATION",
    serviceLabel: "Modernização",
    theme: "ATMOSPHERE_LIGHTING",
    themeLabel: "Atmosfera & iluminação",
  },
  {
    index: 5,
    slug: "conjunto-familiar",
    serviceCategory: null,
    serviceLabel: null,
    theme: "FAMILY_SAFETY",
    themeLabel: "Família & segurança",
  },
  {
    index: 6,
    slug: "pergola-lounge",
    serviceCategory: null,
    serviceLabel: null,
    theme: "LIFESTYLE",
    themeLabel: "Lazer & convívio",
  },
]);

function ensureProjectStyles() {
  if (document.querySelector('link[data-solima-projects-v2]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = PROJECT_STYLE_HREF;
  link.dataset.solimaProjectsV2 = "";
  document.head.append(link);
}

function createTaxonomy(project) {
  const group = document.createElement("div");
  group.className = "project-v2-taxonomy";
  group.setAttribute("aria-label", "Classificação do projeto");

  if (project.serviceLabel) {
    const service = document.createElement("span");
    service.className = "project-v2-taxonomy-item is-service";

    const serviceKey = document.createElement("span");
    serviceKey.className = "project-v2-taxonomy-key";
    serviceKey.textContent = "Serviço";

    const serviceValue = document.createElement("span");
    serviceValue.textContent = project.serviceLabel;

    service.append(serviceKey, serviceValue);
    group.append(service);
  }

  const theme = document.createElement("span");
  theme.className = "project-v2-taxonomy-item is-theme";

  const themeKey = document.createElement("span");
  themeKey.className = "project-v2-taxonomy-key";
  themeKey.textContent = "Tema";

  const themeValue = document.createElement("span");
  themeValue.textContent = project.themeLabel;

  theme.append(themeKey, themeValue);
  group.append(theme);

  return group;
}

function createQuoteCta(project, title) {
  const cta = document.createElement("a");
  cta.className = "project-v2-quote-cta";
  cta.href = "#orcamento";
  cta.dataset.intentAction = "QUOTE";
  cta.dataset.intentSource = "PROJECT";
  cta.dataset.projectRef = project.slug;
  cta.dataset.projectName = title;
  cta.dataset.projectTheme = project.theme;
  if (project.serviceCategory) cta.dataset.suggestedService = project.serviceCategory;
  cta.setAttribute("aria-label", `Quero algo como ${title}`);

  const label = document.createElement("span");
  label.textContent = "Quero algo como isto";

  const arrow = document.createElement("span");
  arrow.className = "project-v2-quote-arrow";
  arrow.setAttribute("aria-hidden", "true");
  arrow.textContent = "↗";

  cta.append(label, arrow);
  return cta;
}

function normalizeIntro(section) {
  const eyebrow = section.querySelector(".projetos-intro .eyebrow");
  const title = section.querySelector(".projetos-intro-title");
  const description = section.querySelector(".projetos-intro-sub");

  if (eyebrow) eyebrow.textContent = "Projetos SOLIMA";
  if (title) {
    title.replaceChildren();

    const firstLine = document.createElement("span");
    firstLine.className = "mask-line";
    const firstText = document.createElement("span");
    firstText.textContent = "Inspire-se em";
    firstLine.append(firstText);

    const secondLine = document.createElement("span");
    secondLine.className = "mask-line";
    const secondText = document.createElement("span");
    secondText.className = "italic";
    secondText.textContent = "soluções construídas.";
    secondLine.append(secondText);

    title.append(firstLine, secondLine);
  }
  if (description) {
    description.textContent = "Explore diferentes formas de integrar piscina, arquitetura, tecnologia e espaço exterior — e use um projeto como ponto de partida para o seu pedido.";
  }
}

function enhanceProject(section, project) {
  const slide = section.querySelector(`.projeto-slide[data-project="${project.index}"]`);
  if (!slide) return;

  const title = slide.querySelector(".projeto-title")?.textContent?.trim() || `Projeto ${project.index}`;
  slide.id ||= `projeto-${project.index}`;
  slide.dataset.projectSlug = project.slug;
  slide.dataset.projectTheme = project.theme;
  if (project.serviceCategory) slide.dataset.serviceCategory = project.serviceCategory;
  else delete slide.dataset.serviceCategory;

  const category = slide.querySelector(".projeto-category");
  if (category) category.textContent = project.serviceLabel || "Projeto SOLIMA";

  const sideLabel = slide.querySelector(".projeto-side .label");
  if (sideLabel) sideLabel.textContent = project.serviceLabel || project.themeLabel;

  const content = slide.querySelector(".projeto-content");
  if (!content) return;

  content.querySelector(".project-v2-taxonomy")?.remove();
  content.querySelector(".project-v2-quote-cta")?.remove();

  const meta = content.querySelector(".projeto-meta-info");
  const taxonomy = createTaxonomy(project);
  if (meta) meta.insertAdjacentElement("afterend", taxonomy);
  else content.prepend(taxonomy);

  const tags = content.querySelector(".projeto-tags");
  const cta = createQuoteCta(project, title);
  if (tags) tags.insertAdjacentElement("afterend", cta);
  else content.append(cta);
}

function syncNextProjectLinks(section) {
  const slides = [...section.querySelectorAll(".projeto-slide")];
  slides.forEach((slide, index) => {
    const teaser = slide.querySelector(".projeto-next-teaser");
    if (!teaser) return;
    const nextSlide = slides[(index + 1) % slides.length];
    if (nextSlide?.id) teaser.href = `#${nextSlide.id}`;
  });
}

function placeAfterProof(section) {
  const proof = document.querySelector("[data-proof-v2]");
  if (!proof || proof.nextElementSibling === section) return;
  proof.insertAdjacentElement("afterend", section);
}

export function initProjectsV2() {
  ensureProjectStyles();
  const section = document.querySelector("#projetos");
  if (!section) return;

  section.dataset.projectsV2 = "";
  section.setAttribute("aria-labelledby", "projectsV2Title");

  const introTitle = section.querySelector(".projetos-intro-title");
  if (introTitle) introTitle.id = "projectsV2Title";

  normalizeIntro(section);
  PROJECTS.forEach((project) => enhanceProject(section, project));
  syncNextProjectLinks(section);
  placeAfterProof(section);
}
