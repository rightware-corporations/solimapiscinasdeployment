const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const finePointer = matchMedia("(hover: hover) and (pointer: fine)");

export function initLoader() {
  const loader = document.querySelector("#loader");
  if (!loader) return;
  let complete = false;
  const finish = () => {
    if (complete) return;
    complete = true;
    loader.classList.add("is-exiting");
    document.documentElement.classList.remove("lenis-stopped");
    setTimeout(() => loader.remove(), reducedMotion.matches ? 20 : 280);
  };

  const minimumDelay = new Promise((resolve) => {
    setTimeout(resolve, reducedMotion.matches ? 40 : 520);
  });
  const fontTimeout = new Promise((resolve) => setTimeout(resolve, 1400));
  const fontsReady = document.fonts
    ? Promise.allSettled([
        document.fonts.load("400 1em Fraunces"),
        document.fonts.load("300 italic 1em Fraunces"),
        document.fonts.load("400 1em Inter"),
      ])
    : Promise.resolve();

  Promise.all([minimumDelay, Promise.race([fontsReady, fontTimeout])]).then(finish);
}

export function initSmoothScroll() {
  if (!window.Lenis) return;

  const desktop = matchMedia("(min-width: 1180px)");
  let lenis;
  let rafId;

  const stop = () => {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = undefined;
    lenis?.destroy?.();
    lenis = undefined;
    delete window.solimaLenis;
    document.documentElement.classList.remove("lenis", "lenis-smooth", "lenis-scrolling", "lenis-stopped");
  };

  const start = () => {
    if (lenis || reducedMotion.matches || !finePointer.matches || !desktop.matches) return;
    lenis = new window.Lenis({ duration: .9, smoothWheel: true, wheelMultiplier: .9 });
    window.solimaLenis = lenis;
    const raf = (time) => {
      if (!lenis) return;
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    };
    rafId = requestAnimationFrame(raf);
  };

  const sync = () => {
    if (reducedMotion.matches || !finePointer.matches || !desktop.matches) stop();
    else start();
  };

  desktop.addEventListener?.("change", sync);
  finePointer.addEventListener?.("change", sync);
  reducedMotion.addEventListener?.("change", sync);
  addEventListener("orientationchange", sync, { passive: true });
  sync();
}

export function initMotion() {
  assignImages();
  initReveals();
  initHero();
  initParallax();
  initProjectRail();
  initMobileProjectReveals();
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
  const desktop = matchMedia("(min-width: 1180px)");
  const saveData = navigator.connection?.saveData === true;
  let active = -1;
  let ticking = false;

  const videoEnabled = () =>
    desktop.matches && finePointer.matches && !reducedMotion.matches && !saveData;

  const syncVideoSources = () => {
    const enabled = videoEnabled();
    layers.forEach((layer, index) => {
      const video = layer.querySelector("video");
      if (!video) return;

      if (!enabled) {
        video.pause();
        video.removeAttribute("src");
        video.preload = "none";
        video.load();
        return;
      }

      if (!video.src && video.dataset.src) {
        video.src = video.dataset.src;
        video.preload = index === active ? "auto" : "metadata";
        video.load();
      }
    });
  };

  const update = () => {
    ticking = false;
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
        if (index === scene && videoEnabled()) video.play().catch(() => {});
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

  const requestUpdate = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  };

  const sync = () => {
    syncVideoSources();
    requestUpdate();
  };

  addEventListener("scroll", requestUpdate, { passive: true });
  addEventListener("resize", requestUpdate, { passive: true });
  addEventListener("orientationchange", sync, { passive: true });
  desktop.addEventListener?.("change", sync);
  finePointer.addEventListener?.("change", sync);
  reducedMotion.addEventListener?.("change", sync);
  syncVideoSources();
  update();
}

function initParallax() {
  const media = [...document.querySelectorAll(".parallax-media, .projeto-image-wrap img")].map((img) => {
    const projectImage = img.matches(".projeto-image-wrap img");
    return {
      img,
      projectImage,
      strength: Number(img.dataset.parallaxStrength || (projectImage ? -36 : -40)),
      limit: projectImage ? 46 : 60,
      activeFactor: null
    };
  });
  if (!media.length) return;

  let ticking = false;

  const multiplier = (item) => {
    if (reducedMotion.matches) return 0;
    if (item.projectImage) {
      return innerWidth >= 1180 && finePointer.matches ? 1 : 0;
    }
    if (!finePointer.matches) return 0;
    return innerWidth >= 1180 ? 1 : innerWidth >= 768 ? .32 : 0;
  };

  const update = () => {
    ticking = false;
    media.forEach((item) => {
      const factor = multiplier(item);
      if (!factor) {
        if (item.activeFactor !== 0) {
          item.img.style.setProperty("--parallax-y", "0px");
          item.activeFactor = 0;
        }
        return;
      }
      item.activeFactor = factor;

      const rect = item.img.parentElement.getBoundingClientRect();
      if (rect.bottom < -rect.height || rect.top > innerHeight + rect.height) return;

      const progress = (rect.top + rect.height / 2 - innerHeight / 2) / innerHeight;
      const offset = Math.max(-item.limit, Math.min(item.limit, progress * item.strength * factor));
      item.img.style.setProperty("--parallax-y", `${offset.toFixed(2)}px`);
    });
  };

  const requestUpdate = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  };

  addEventListener("scroll", requestUpdate, { passive: true });
  addEventListener("resize", requestUpdate, { passive: true });
  addEventListener("orientationchange", requestUpdate, { passive: true });
  reducedMotion.addEventListener?.("change", requestUpdate);
  update();
}

function initProjectRail() {
  const section = document.querySelector("#projetos");
  const slides = [...document.querySelectorAll(".projeto-slide")];
  const rail = document.querySelector("#projetosRail");
  const fill = document.querySelector("#projetosRailFill");
  const counter = document.querySelector("#projetosRailCounter");
  const dots = [...document.querySelectorAll("[data-rail-dot]")];
  const desktop = matchMedia("(min-width: 1180px)");
  if (!section || !slides.length) return;

  let activeIndex = -1;
  let ticking = false;

  dots.forEach((dot, index) => {
    const denominator = Math.max(1, dots.length - 1);
    dot.style.top = `${(index / denominator) * 100}%`;
  });

  const getClosestSlide = () => {
    const viewportCenter = innerHeight / 2;
    let closestIndex = 0;
    let closestDistance = Infinity;

    slides.forEach((slide, index) => {
      const rect = slide.getBoundingClientRect();
      const slideCenter = rect.top + rect.height / 2;
      const distance = Math.abs(slideCenter - viewportCenter);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });

    return closestIndex;
  };

  const setActiveSlide = (nextIndex) => {
    activeIndex = nextIndex;
    slides.forEach((slide, index) => {
      const active = index === activeIndex;
      slide.classList.toggle("is-active", active);
      slide.setAttribute("aria-current", active ? "true" : "false");
    });
    dots.forEach((dot, index) => dot.classList.toggle("is-active", index === activeIndex));
    if (counter) {
      counter.innerHTML =
        `${String(activeIndex + 1).padStart(2, "0")} ` +
        `<span class="total">/ ${String(slides.length).padStart(2, "0")}</span>`;
    }
    if (fill) fill.style.transform = `scaleY(${(activeIndex + 1) / slides.length})`;
  };

  const update = () => {
    ticking = false;

    if (!desktop.matches) {
      rail?.classList.remove("is-visible");
      if (activeIndex !== -1) {
        activeIndex = -1;
        slides.forEach((slide) => {
          slide.classList.remove("is-active");
          slide.setAttribute("aria-current", "false");
        });
        dots.forEach((dot) => dot.classList.remove("is-active"));
        if (fill) fill.style.transform = "scaleY(0)";
      }
      return;
    }

    const sectionRect = section.getBoundingClientRect();
    const sectionVisible =
      sectionRect.top < innerHeight * .8 &&
      sectionRect.bottom > innerHeight * .2;

    rail?.classList.toggle("is-visible", sectionVisible);

    const nextIndex = getClosestSlide();
    if (nextIndex !== activeIndex) setActiveSlide(nextIndex);
  };

  const requestUpdate = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  };

  addEventListener("scroll", requestUpdate, { passive: true });
  addEventListener("resize", requestUpdate, { passive: true });
  addEventListener("orientationchange", requestUpdate, { passive: true });
  desktop.addEventListener?.("change", requestUpdate);
  update();
}

function initMobileProjectReveals() {
  const slides = [...document.querySelectorAll(".projeto-slide")];
  const mobile = matchMedia("(max-width: 1179px)");
  if (!slides.length) return;

  let observer;

  slides.forEach((slide, index) => {
    const nextIndex = (index + 1) % slides.length;
    const nextTitle = slides[nextIndex].querySelector(".projeto-title")?.textContent?.trim();
    const content = slide.querySelector(".projeto-content");

    slide.id ||= `projeto-${index + 1}`;
    if (!content || slide.querySelector(".projeto-next-teaser")) return;

    const teaser = document.createElement("a");
    teaser.className = "projeto-next-teaser";
    teaser.href = `#projeto-${nextIndex + 1}`;
    teaser.setAttribute("aria-label", `Próximo projecto: ${nextTitle}`);
    teaser.innerHTML =
      '<span class="projeto-next-label">Próximo projecto</span>' +
      `<span class="projeto-next-title">${nextTitle}</span>` +
      '<span class="projeto-next-arrow" aria-hidden="true">↓</span>';
    content.insertAdjacentElement("afterend", teaser);
  });

  const reveal = (slide) => {
    slide.classList.add("is-revealed");
    setTimeout(() => slide.classList.add("is-reveal-complete"), 1100);
  };

  const setup = () => {
    observer?.disconnect();
    observer = undefined;

    slides.forEach((slide) => slide.classList.toggle("is-mobile-reveal-ready", mobile.matches));
    if (!mobile.matches) return;

    if (reducedMotion.matches || !("IntersectionObserver" in window)) {
      slides.forEach(reveal);
      return;
    }

    observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        reveal(entry.target);
        observer?.unobserve(entry.target);
      });
    }, {
      threshold: .22,
      rootMargin: "0px 0px -4% 0px"
    });

    slides
      .filter((slide) => !slide.classList.contains("is-revealed"))
      .forEach((slide) => observer.observe(slide));
  };

  mobile.addEventListener?.("change", setup);
  reducedMotion.addEventListener?.("change", setup);
  setup();
}
