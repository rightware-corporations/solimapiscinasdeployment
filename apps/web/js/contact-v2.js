const CONTACT_STYLE_HREF = "/css/contact-v2.css";

const PHONES = Object.freeze([
  { href: "tel:+258824407120", label: "+258 82 440 7120" },
  { href: "tel:+258843892558", label: "+258 84 389 2558", whatsappHref: "https://wa.me/258843892558" },
  { href: "tel:+258847949100", label: "+258 84 794 9100" },
]);

// Official public contact details approved for the SOLIMA landing.
const CURRENT_PUBLIC_EMAIL = "solima.piscinas@gmail.com";
const CURRENT_PUBLIC_ADDRESS = "Bairro de Campoane, Casa nº 1845, Município de Boane — Maputo";

const SOCIAL_LINKS = Object.freeze([
  { label: "Instagram", href: "https://instagram.com/solimapiscinas", icon: "instagram" },
  { label: "Facebook", href: "https://facebook.com/solimapiscinas", icon: "facebook" },
  { label: "TikTok", href: "https://tiktok.com/@solimapiscinas", icon: "music-2" },
  { label: "YouTube", href: "https://www.youtube.com/watch?v=MgiXGiHG8_I", icon: "play" },
]);

function ensureContactStyles() {
  if (document.querySelector('link[data-solima-contact-v2]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = CONTACT_STYLE_HREF;
  link.dataset.solimaContactV2 = "";
  document.head.append(link);
}

function icon(name) {
  const element = document.createElement("i");
  element.dataset.lucide = name;
  element.setAttribute("aria-hidden", "true");
  return element;
}

function createContactItem({ iconName, label, content }) {
  const item = document.createElement("div");
  item.className = "contact-v2-item";

  const marker = document.createElement("span");
  marker.className = "contact-v2-item-icon";
  marker.setAttribute("aria-hidden", "true");
  marker.append(icon(iconName));

  const body = document.createElement("div");
  body.className = "contact-v2-item-body";

  const heading = document.createElement("div");
  heading.className = "contact-v2-item-label";
  heading.textContent = label;

  const value = document.createElement("div");
  value.className = "contact-v2-item-value";
  if (typeof content === "string") value.textContent = content;
  else value.append(content);

  body.append(heading, value);
  item.append(marker, body);
  return item;
}

function createPhoneList() {
  const list = document.createElement("div");
  list.className = "contact-v2-phone-list";
  list.setAttribute("aria-label", "Telefones da SOLIMA");

  PHONES.forEach((phone) => {
    const item = document.createElement("div");
    item.className = "contact-v2-phone-item";

    const link = document.createElement("a");
    link.href = phone.href;
    link.textContent = phone.label;
    link.className = "contact-v2-phone";
    link.dataset.contactChannel = "PHONE";
    item.append(link);

    if (phone.whatsappHref) {
      const whatsapp = document.createElement("a");
      whatsapp.href = phone.whatsappHref;
      whatsapp.target = "_blank";
      whatsapp.rel = "noopener noreferrer";
      whatsapp.className = "contact-v2-whatsapp";
      whatsapp.dataset.contactChannel = "WHATSAPP";
      whatsapp.setAttribute("aria-label", `Conversar pelo WhatsApp: ${phone.label}`);
      whatsapp.append(icon("message-circle"));

      const whatsappLabel = document.createElement("span");
      whatsappLabel.textContent = "WhatsApp";
      whatsapp.append(whatsappLabel);
      item.append(whatsapp);
    }

    list.append(item);
  });
  return list;
}

function createSocials() {
  const nav = document.createElement("nav");
  nav.className = "contact-v2-socials";
  nav.setAttribute("aria-label", "Redes sociais SOLIMA");

  SOCIAL_LINKS.forEach((social) => {
    const link = document.createElement("a");
    link.href = social.href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.className = "contact-v2-social-link";
    link.setAttribute("aria-label", social.label);
    link.dataset.contactChannel = social.label.toUpperCase();
    link.append(icon(social.icon));

    const text = document.createElement("span");
    text.textContent = social.label;
    link.append(text);
    nav.append(link);
  });

  return nav;
}

function buildContact(section) {
  section.replaceChildren();
  section.dataset.contactV2 = "";
  section.setAttribute("aria-labelledby", "contactV2Title");

  const background = document.createElement("div");
  background.className = "contact-v2-bg";
  background.setAttribute("aria-hidden", "true");

  const inner = document.createElement("div");
  inner.className = "contact-v2-inner";

  const header = document.createElement("header");
  header.className = "contact-v2-header";

  const eyebrow = document.createElement("p");
  eyebrow.className = "contact-v2-eyebrow";
  eyebrow.textContent = "Contacto";

  const title = document.createElement("h2");
  title.id = "contactV2Title";
  title.className = "contact-v2-title";
  title.innerHTML = 'Estamos em Maputo. <span>Fale com a SOLIMA.</span>';
  title.setAttribute("aria-label", "Estamos em Maputo. Fale com a SOLIMA.");

  const lead = document.createElement("p");
  lead.className = "contact-v2-lead";
  lead.textContent = "Para um novo projeto, modernização ou manutenção, pode enviar o pedido pelo formulário ou contactar a equipa diretamente por telefone.";

  header.append(eyebrow, title, lead);

  const layout = document.createElement("div");
  layout.className = "contact-v2-layout";

  const details = document.createElement("div");
  details.className = "contact-v2-details";

  details.append(
    createContactItem({ iconName: "map-pin", label: "Sede", content: CURRENT_PUBLIC_ADDRESS }),
    createContactItem({ iconName: "phone", label: "Telefones", content: createPhoneList() }),
  );

  const email = document.createElement("a");
  email.href = `mailto:${CURRENT_PUBLIC_EMAIL}`;
  email.textContent = CURRENT_PUBLIC_EMAIL;
  email.dataset.contactEmailSource = "OFFICIAL_APPROVED";
  details.append(createContactItem({ iconName: "mail", label: "Email", content: email }));
  details.append(createSocials());

  const action = document.createElement("aside");
  action.className = "contact-v2-action";
  action.setAttribute("aria-labelledby", "contactV2ActionTitle");

  const actionMarker = document.createElement("span");
  actionMarker.className = "contact-v2-action-mark";
  actionMarker.setAttribute("aria-hidden", "true");
  actionMarker.append(document.createElement("span"), document.createElement("span"), document.createElement("span"));

  const actionEyebrow = document.createElement("p");
  actionEyebrow.className = "contact-v2-action-eyebrow";
  actionEyebrow.textContent = "Próximo passo";

  const actionTitle = document.createElement("h3");
  actionTitle.id = "contactV2ActionTitle";
  actionTitle.className = "contact-v2-action-title";
  actionTitle.textContent = "Conte-nos o que pretende construir ou melhorar.";

  const actionText = document.createElement("p");
  actionText.className = "contact-v2-action-text";
  actionText.textContent = "O formulário demora poucos passos e permite anexar fotografias se isso ajudar a explicar o espaço.";

  const quote = document.createElement("a");
  quote.href = "#orcamento";
  quote.className = "contact-v2-quote-cta";
  quote.dataset.intentAction = "QUOTE";
  quote.dataset.intentSource = "CONTACT";
  quote.innerHTML = '<span>Pedir orçamento</span><span aria-hidden="true">↗</span>';

  action.append(actionMarker, actionEyebrow, actionTitle, actionText, quote);

  layout.append(details, action);
  inner.append(header, layout);
  section.append(background, inner);
}

function buildFooter(footer) {
  footer.replaceChildren();
  footer.className = "footer contact-v2-footer";
  footer.dataset.footerV2 = "";

  const inner = document.createElement("div");
  inner.className = "contact-v2-footer-inner";

  const brand = document.createElement("a");
  brand.className = "contact-v2-footer-brand";
  brand.href = "#top";
  brand.setAttribute("aria-label", "SOLIMA Piscinas — voltar ao início");

  const mark = document.createElement("img");
  mark.src = "/assets/brand/solima-compact-mark.svg";
  mark.alt = "";
  mark.width = 46;
  mark.height = 46;

  const brandText = document.createElement("span");
  brandText.className = "contact-v2-footer-brand-copy";
  const name = document.createElement("strong");
  name.textContent = "SOLIMA";
  const descriptor = document.createElement("span");
  descriptor.textContent = "Construção & Manutenção de Piscinas";
  brandText.append(name, descriptor);
  brand.append(mark, brandText);

  const meta = document.createElement("div");
  meta.className = "contact-v2-footer-meta";

  const place = document.createElement("span");
  place.textContent = "Maputo · Moçambique";

  const privacy = document.createElement("a");
  privacy.href = "/privacy.html";
  privacy.textContent = "Política de privacidade";

  const copyright = document.createElement("span");
  copyright.textContent = `© ${new Date().getFullYear()} SOLIMA Lda`;

  meta.append(place, privacy, copyright);
  inner.append(brand, meta);
  footer.append(inner);
}

export function initContactV2() {
  ensureContactStyles();
  const section = document.querySelector("#contacto");
  const footer = document.querySelector("footer.footer");
  if (!section || !footer) return;

  buildContact(section);
  buildFooter(footer);
}
