const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const finePointer = matchMedia("(hover: hover) and (pointer: fine)");

export function initLoader() {
  const loader = document.querySelector("#loader");
  if (!loader) return;
  const finish = () => {
    loader.classList.add("is-exiting");
    document.documentElement.classList.remove("lenis-stopped");
    setTimeout(() => loader.remove(), reducedMotion.matches ? 20 : 280);
  };
  setTimeout(finish, reducedMotion.matches ? 80 : 750);
}

export function initSmoothScroll() {
  if (!window.Lenis || reducedMotion.matches || !finePointer.matches || innerWidth < 1180) return;
  const lenis = new window.Lenis({ duration: .9, smoothWheel: true, wheelMultiplier: .9, touchMultiplier: 1 });
  window.solimaLenis = lenis;
  const raf = (time) => { lenis.raf(time); requestAnimationFrame(raf); };
  requestAnimationFrame(raf);
}

export function initMotion() {
  assignImages();
  initReveals();
  initHero();
  initParallax();
  initProjectRail();
}

function assignImages() {
  document.querySelectorAll("[data-img-key]").forEach((img) => {
    const source = window.SOLIMA_IMG?.[`i${img.dataset.imgKey}`];
    if (source) {
      img.src = source;
      img.loading = img.closest(".hero") ? "eager" : "lazy";
      img.decoding = "async";
    }
  });
}

function initReveals() {
  const elements = document.querySelectorAll("[data-reveal],[data-reveal-text]");
  if (reducedMotion.matches || !("IntersectionObserver" in window)) {
    elements.forEach((el) => el.classList.add("is-visible"));
    return;
  }
  const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add("is-visible");
    observer.unobserve(entry.target);
  }), { threshold: .12, rootMargin: "0px 0px -7% 0px" });
  elements.forEach((el) => observer.observe(el));
}

function initHero() {
  const hero = document.querySelector(".hero");
  const content = document.querySelector("#heroContent");
  if (!hero || !content) return;
  const layers = [...hero.querySelectorAll(".hero-video-layer")];
  const rows = [...hero.querySelectorAll(".hero-scene-row")];
  const words = [...hero.querySelectorAll(".hero-title-morph-word")];
  let active = -1;
  const update = () => {
    const rect = hero.getBoundingClientRect();
    const distance = Math.max(1, hero.offsetHeight - innerHeight);
    const progress = Math.max(0, Math.min(1, -rect.top / distance));
    const scene = Math.min(2, Math.floor(progress * 3));
    if (scene !== active) {
      active = scene;
      [layers, rows, words].forEach((group) => group.forEach((el, index) => el.classList.toggle("is-active", index === scene)));
      layers.forEach((layer, index) => {
        const video = layer.querySelector("video");
        if (!video) return;
        if (index === scene && !reducedMotion.matches) video.play().catch(() => {});
        else video.pause();
      });
    }
    if (innerWidth >= 768 && !reducedMotion.matches) {
      const shift = Math.min(72, innerHeight * .08);
      content.style.transform = `translate3d(0, ${-progress * shift}px, 0)`;
      content.style.opacity = String(1 - progress * .18);
    } else {
      content.style.transform = "";
      content.style.opacity = "";
    }
  };
  addEventListener("scroll", update, { passive: true });
  addEventListener("resize", update, { passive: true });
  update();
}

function initParallax() {
  const media = [...document.querySelectorAll(".parallax-media")];
  if (!media.length) return;
  const multiplier = () => reducedMotion.matches ? 0 : innerWidth >= 1180 ? 1 : innerWidth >= 768 ? .4 : .16;
  const update = () => {
    const factor = multiplier();
    media.forEach((img) => {
      const rect = img.parentElement.getBoundingClientRect();
      const progress = (rect.top + rect.height / 2 - innerHeight / 2) / innerHeight;
      const strength = Number(img.dataset.parallaxStrength || -40);
      img.style.setProperty("--parallax-y", `${Math.max(-60, Math.min(60, progress * strength * factor))}px`);
    });
  };
  addEventListener("scroll", update, { passive: true });
  addEventListener("resize", update, { passive: true });
  addEventListener("orientationchange", update, { passive: true });
  update();
}

function initProjectRail() {
  const slides = [...document.querySelectorAll(".projeto-slide")];
  const fill = document.querySelector("#projetosRailFill");
  const counter = document.querySelector("#projetosRailCounter");
  const dots = [...document.querySelectorAll("[data-rail-dot]")];
  if (!slides.length || !fill || !counter) return;
  const update = () => {
    let closest = 0, distance = Infinity;
    slides.forEach((slide, index) => {
      const value = Math.abs(slide.getBoundingClientRect().top);
      if (value < distance) { distance = value; closest = index; }
    });
    fill.style.transform = `scaleY(${(closest + 1) / slides.length})`;
    counter.innerHTML = `${String(closest + 1).padStart(2, "0")} <span class="total">/ ${String(slides.length).padStart(2, "0")}</span>`;
    dots.forEach((dot, index) => dot.classList.toggle("is-active", index === closest));
  };
  addEventListener("scroll", update, { passive: true });
  update();
}
