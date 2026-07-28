const finePointer = matchMedia("(hover: hover) and (pointer: fine)");

export function initNavigation() {
  const nav = document.querySelector(".nav");
  const burger = document.querySelector("#navBurger");
  const overlay = document.querySelector("#navOverlay");
  const rail = document.querySelector("#scrollRail");

  const closeMenu = () => {
    burger?.classList.remove("is-open");
    overlay?.classList.remove("is-open");
    burger?.setAttribute("aria-expanded", "false");
    document.body.classList.remove("menu-open");
    window.solimaLenis?.start?.();
  };
  const openMenu = () => {
    burger?.classList.add("is-open");
    overlay?.classList.add("is-open");
    burger?.setAttribute("aria-expanded", "true");
    document.body.classList.add("menu-open");
    window.solimaLenis?.stop?.();
  };

  burger?.setAttribute("aria-expanded", "false");
  burger?.addEventListener("click", () => overlay?.classList.contains("is-open") ? closeMenu() : openMenu());
  overlay?.querySelectorAll("[data-menu-close]").forEach((link) => link.addEventListener("click", closeMenu));

  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener("click", (event) => {
      const target = document.querySelector(link.getAttribute("href"));
      if (!target) return;
      event.preventDefault();
      closeMenu();
      if (window.solimaLenis) window.solimaLenis.scrollTo(target, { offset: -72, duration: .9 });
      else target.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    });
  });

  const updateScrollUI = () => {
    const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    const progress = Math.min(1, scrollY / max);
    nav?.classList.toggle("is-scrolled", scrollY > 24);
    if (rail) rail.style.transform = `scaleY(${progress})`;
  };
  addEventListener("scroll", updateScrollUI, { passive: true });
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
  let x = innerWidth / 2, y = innerHeight / 2, rx = x, ry = y;
  addEventListener("pointermove", (event) => { x = event.clientX; y = event.clientY; dot.style.transform = `translate3d(${x}px,${y}px,0)`; }, { passive: true });
  const tick = () => {
    rx += (x - rx) * .16; ry += (y - ry) * .16;
    ring.style.transform = `translate3d(${rx}px,${ry}px,0)`;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  document.querySelectorAll("a,button,[data-cursor=hover]").forEach((el) => {
    el.addEventListener("pointerenter", () => ring.classList.add("is-hover"));
    el.addEventListener("pointerleave", () => ring.classList.remove("is-hover"));
  });
}
