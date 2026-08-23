const finePointer = matchMedia("(hover: hover) and (pointer: fine)");
const desktopNavigation = matchMedia("(min-width: 900px)");
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

const NAV_ITEMS = [
  { href: "#projetos", label: "Projetos" },
  { href: "#servicos", label: "Serviços" },
  { href: "#sobre", label: "Sobre" },
  { href: "#contacto", label: "Contacto" },
];

function ensureNavigationStyles() {
  if (document.querySelector('link[data-solima-navigation-v2]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "/css/navigation-v2.css";
  link.dataset.solimaNavigationV2 = "";
  document.head.append(link);
}

function setMeta(selector, attribute, value) {
  const element = document.querySelector(selector);
  if (element) element.setAttribute(attribute, value);
}

function configureBrandAndHead() {
  document.documentElement.dataset.frontendFoundation = "v2";
  document.title = "SOLIMA — Construção & Manutenção de Piscinas em Moçambique";

  setMeta('meta[name="theme-color"]', "content", "#041e3c");
  setMeta(
    'meta[name="description"]',
    "content",
    "Construção, modernização e manutenção de piscinas em Moçambique. Engenharia, design e acompanhamento SOLIMA.",
  );
  setMeta(
    'meta[property="og:description"]',
    "content",
    "Construção, modernização e manutenção de piscinas em Moçambique.",
  );

  const favicon = document.querySelector('link[rel~="icon"]') || document.createElement("link");
  favicon.rel = "icon";
  favicon.type = "image/svg+xml";
  favicon.href = "/assets/brand/solima-favicon.svg";
  favicon.dataset.solimaBrand = "favicon";
  if (!favicon.parentNode) document.head.append(favicon);

  const loaderLogo = document.querySelector(".loader-logo");
  if (loaderLogo) {
    loaderLogo.innerHTML = '<img src="/assets/brand/solima-compact-mark.svg" alt="" width="64" height="64">';
  }
  const loaderTagline = document.querySelector(".loader-tagline");
  if (loaderTagline) loaderTagline.textContent = "CONSTRUÇÃO & MANUTENÇÃO DE PISCINAS";

  const nav = document.querySelector("#nav");
  nav?.setAttribute("aria-label", "Navegação principal");

  const brand = document.querySelector(".nav-brand");
  brand?.setAttribute("aria-label", "SOLIMA — início");

  const brandMark = document.querySelector(".nav-brand-mark");
  if (brandMark) {
    brandMark.innerHTML = '<img src="/assets/brand/solima-compact-mark.svg" alt="" width="40" height="40">';
  }

  const brandText = document.querySelector(".nav-brand-text");
  if (brandText) {
    brandText.innerHTML = "<div>SOLIMA</div><div>PISCINAS · MOÇAMBIQUE</div>";
  }

  const links = document.querySelector(".nav-links");
  if (links) {
    links.innerHTML = NAV_ITEMS.map(
      ({ href, label }) => `<a class="nav-link" href="${href}" data-cursor="hover">${label}</a>`,
    ).join("");
  }

  const overlayLinks = document.querySelector(".nav-overlay-links");
  if (overlayLinks) {
    overlayLinks.innerHTML = [
      ...NAV_ITEMS,
      { href: "#orcamento", label: "Pedir orçamento" },
    ].map(
      ({ href, label }) => `<a class="nav-overlay-link" href="${href}" data-menu-close>${label}</a>`,
    ).join("");
  }

  document.querySelectorAll(".nav-cta > span:last-child").forEach((label) => {
    label.textContent = "Pedir orçamento";
  });

  const overlayMeta = document.querySelector(".nav-overlay-meta");
  if (overlayMeta) {
    overlayMeta.innerHTML = [
      "<div>Maputo · Moçambique</div>",
      '<div><a href="#contacto" data-menu-close>Ver contactos</a></div>',
    ].join("");
  }
}

function ensureSkipLink() {
  if (document.querySelector("[data-skip-link]")) return;
  const skip = document.createElement("a");
  skip.href = "#top";
  skip.className = "nav-v2-skip-link";
  skip.dataset.skipLink = "";
  skip.textContent = "Saltar para o conteúdo";
  document.body.prepend(skip);
}

export function initNavigation() {
  ensureNavigationStyles();
  configureBrandAndHead();
  ensureSkipLink();

  const nav = document.querySelector(".nav");
  const burger = document.querySelector("#navBurger");
  const overlay = document.querySelector("#navOverlay");
  const rail = document.querySelector("#scrollRail");

  if (burger && overlay) {
    burger.setAttribute("aria-controls", "navOverlay");
    burger.setAttribute("aria-expanded", "false");
    burger.setAttribute("aria-label", "Abrir menu");
    overlay.setAttribute("aria-label", "Menu principal");
    overlay.setAttribute("aria-hidden", "true");
    overlay.setAttribute("inert", "");
  }

  let previousFocus = null;

  const menuIsOpen = () => document.body.classList.contains("menu-open");

  const focusableMenuItems = () => overlay
    ? [...overlay.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')]
      .filter((element) => !element.hasAttribute("hidden"))
    : [];

  const closeMenu = ({ restoreFocus = true } = {}) => {
    if (!menuIsOpen()) return;
    burger?.classList.remove("is-open");
    overlay?.classList.remove("is-open");
    burger?.setAttribute("aria-expanded", "false");
    burger?.setAttribute("aria-label", "Abrir menu");
    overlay?.setAttribute("aria-hidden", "true");
    overlay?.setAttribute("inert", "");
    document.body.classList.remove("menu-open");
    window.solimaLenis?.start?.();

    if (restoreFocus) {
      const fallback = burger;
      const target = previousFocus instanceof HTMLElement && previousFocus.isConnected ? previousFocus : fallback;
      target?.focus?.({ preventScroll: true });
    }
    previousFocus = null;
  };

  const openMenu = () => {
    if (!burger || !overlay || desktopNavigation.matches || menuIsOpen()) return;
    previousFocus = document.activeElement;
    burger.classList.add("is-open");
    overlay.classList.add("is-open");
    burger.setAttribute("aria-expanded", "true");
    burger.setAttribute("aria-label", "Fechar menu");
    overlay.removeAttribute("inert");
    overlay.setAttribute("aria-hidden", "false");
    document.body.classList.add("menu-open");
    window.solimaLenis?.stop?.();
    requestAnimationFrame(() => focusableMenuItems()[0]?.focus());
  };

  burger?.addEventListener("click", () => menuIsOpen() ? closeMenu() : openMenu());

  overlay?.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeMenu();
      return;
    }
    if (event.key !== "Tab") return;

    const items = focusableMenuItems();
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && menuIsOpen()) {
      event.preventDefault();
      closeMenu();
    }
  });

  desktopNavigation.addEventListener?.("change", (event) => {
    if (event.matches) closeMenu({ restoreFocus: false });
  });

  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener("click", (event) => {
      // F10: quote intents own their scroll/focus lifecycle. The attributes can
      // be added after navigation initialization, so evaluate them at click time.
      if (link.matches('[data-intent-action="QUOTE"], [data-intent-type="PROCESS"]')) {
        if (menuIsOpen()) closeMenu({ restoreFocus: false });
        return;
      }

      const href = link.getAttribute("href");
      if (!href || href === "#") return;
      const target = document.querySelector(href);
      if (!target) return;

      event.preventDefault();
      if (menuIsOpen()) closeMenu();

      if (link.matches("[data-skip-link]")) {
        if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
        target.focus({ preventScroll: true });
      }

      if (window.solimaLenis) {
        window.solimaLenis.scrollTo(target, { offset: -72, duration: reducedMotion.matches ? 0 : .9 });
      } else {
        target.scrollIntoView({ behavior: reducedMotion.matches ? "auto" : "smooth", block: "start" });
      }
    });
  });

  let scrollTicking = false;
  const updateScrollUI = () => {
    scrollTicking = false;
    const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    const progress = Math.min(1, Math.max(0, scrollY / max));
    nav?.classList.toggle("is-scrolled", scrollY > 24);
    if (rail) rail.style.transform = `scaleX(${progress})`;
  };
  const requestScrollUIUpdate = () => {
    if (scrollTicking) return;
    scrollTicking = true;
    requestAnimationFrame(updateScrollUI);
  };
  addEventListener("scroll", requestScrollUIUpdate, { passive: true });
  addEventListener("resize", requestScrollUIUpdate, { passive: true });
  updateScrollUI();

  document.querySelectorAll("[data-toggle]").forEach((button) => {
    button.setAttribute("aria-expanded", "false");
    button.addEventListener("click", () => {
      const open = button.classList.toggle("is-open");
      button.setAttribute("aria-expanded", String(open));
    });
  });

  if (finePointer.matches) {
    initCursor();
    document.querySelectorAll(".magnetic").forEach((element) => {
      element.addEventListener("pointermove", (event) => {
        const rect = element.getBoundingClientRect();
        element.style.transform = `translate3d(${(event.clientX - rect.left - rect.width / 2) * .08}px, ${(event.clientY - rect.top - rect.height / 2) * .08}px, 0)`;
      });
      element.addEventListener("pointerleave", () => { element.style.transform = ""; });
    });
  }
}

function initCursor() {
  const dot = document.querySelector("#cursor");
  const ring = document.querySelector("#cursor-ring");
  if (!dot || !ring) return;

  let x = innerWidth / 2;
  let y = innerHeight / 2;
  let rx = x;
  let ry = y;

  addEventListener("pointermove", (event) => {
    x = event.clientX;
    y = event.clientY;
    dot.style.transform = `translate3d(${x}px,${y}px,0)`;
  }, { passive: true });

  const tick = () => {
    rx += (x - rx) * .16;
    ry += (y - ry) * .16;
    ring.style.transform = `translate3d(${rx}px,${ry}px,0)`;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  document.querySelectorAll("a,button,[data-cursor=hover]").forEach((element) => {
    element.addEventListener("pointerenter", () => {
      dot.classList.add("is-hovering");
      ring.classList.add("is-hovering");
    });
    element.addEventListener("pointerleave", () => {
      dot.classList.remove("is-hovering");
      ring.classList.remove("is-hovering");
    });
  });
}
