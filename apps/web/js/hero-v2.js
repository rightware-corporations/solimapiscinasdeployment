import { HERO_MODE, getHeroCapability, watchHeroCapability } from "./capability.js";

const WORD_INTERVAL_MS = 4500;
const HERO_STYLE_HREF = "/css/hero-v2.css";

function ensureHeroStyles() {
  if (document.querySelector('link[data-solima-hero-v2]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = HERO_STYLE_HREF;
  link.dataset.solimaHeroV2 = "";
  document.head.append(link);
}

/**
 * The legacy motion module still contains its original hero controller.
 * During this refactor phase we deliberately leave that hardened file intact.
 * Temporarily hiding #heroContent makes only the legacy hero initializer return
 * early while all other reveal/parallax/project initializers still run.
 */
export function prepareHeroForV2() {
  ensureHeroStyles();
  const content = document.querySelector("#heroContent");
  if (!content) return () => {};

  content.id = "heroContentV2Pending";
  document.documentElement.dataset.heroController = "v2-pending";

  return () => {
    if (content.isConnected) content.id = "heroContent";
    document.documentElement.dataset.heroController = "v2";
  };
}

function configureHeroCopy(hero) {
  const eyebrow = hero.querySelector("#heroContent .eyebrow");
  if (eyebrow) eyebrow.textContent = "Piscinas · Maputo · Moçambique";

  const sub = hero.querySelector(".hero-sub");
  if (sub) {
    sub.textContent = "Construção, modernização e manutenção de piscinas para espaços residenciais, comerciais e institucionais em Moçambique.";
  }

  const projectCta = hero.querySelector('.hero-ctas a[href="#projetos"]');
  if (projectCta) {
    projectCta.classList.add("hero-project-cta");
    projectCta.classList.remove("btn-primary");
    projectCta.classList.add("btn-ghost");
    const label = projectCta.querySelector("span");
    if (label) label.textContent = "Ver projetos";
  }

  const quoteCta = hero.querySelector('.hero-ctas a[href="#orcamento"]');
  if (quoteCta) {
    quoteCta.classList.add("hero-quote-cta");
    quoteCta.classList.remove("btn-ghost");
    quoteCta.classList.add("btn-primary");
    const label = quoteCta.querySelector("span");
    if (label) label.textContent = "Pedir orçamento";
  }
}

function setActiveWord(words, index) {
  words.forEach((word, wordIndex) => {
    const active = wordIndex === index;
    word.classList.toggle("is-active", active);
    word.setAttribute("aria-hidden", active ? "false" : "true");
  });
}

function setActiveScene(rows, index) {
  rows.forEach((row, rowIndex) => {
    const active = rowIndex === index;
    row.classList.toggle("is-active", active);
    row.setAttribute("aria-current", active ? "true" : "false");
  });
}

function resetVideo(video) {
  if (!video) return;
  video.pause();
  video.removeAttribute("src");
  video.preload = "none";
  video.load();
}

function ensureVideoSource(video, preload = "metadata") {
  if (!video?.dataset.src) return false;
  if (!video.getAttribute("src")) {
    video.src = video.dataset.src;
    video.preload = preload;
    video.load();
  }
  return true;
}

function sceneWeights(progress) {
  const p = Math.max(0, Math.min(1, progress));
  if (p <= .5) {
    return [1 - (p * 2), p * 2, 0];
  }
  return [0, 2 - (p * 2), (p * 2) - 1];
}

export function initHeroV2() {
  ensureHeroStyles();

  const hero = document.querySelector(".hero");
  const content = document.querySelector("#heroContent");
  if (!hero || !content) return;

  configureHeroCopy(hero);

  const layers = [...hero.querySelectorAll(".hero-video-layer")];
  const videos = layers.map((layer) => layer.querySelector("video"));
  const rows = [...hero.querySelectorAll(".hero-scene-row")];
  const words = [...hero.querySelectorAll(".hero-title-morph-word")];
  const ambientVideo = videos[0];
  const ambientVideoAvailable = Boolean(ambientVideo?.dataset.src);

  let mode = null;
  let wordIndex = 0;
  let wordTimer = null;
  let scrollTicking = false;
  let heroVisible = true;
  let videoUnavailable = false;
  let visibilityObserver = null;

  const clearWordTimer = () => {
    if (wordTimer) clearInterval(wordTimer);
    wordTimer = null;
  };

  const pauseAllVideos = () => videos.forEach((video) => video?.pause());

  const playVideo = async (video) => {
    if (!video || !heroVisible || document.hidden) return true;
    try {
      await video.play();
      return true;
    } catch {
      return false;
    }
  };

  const startAmbientWords = () => {
    clearWordTimer();
    if (mode !== HERO_MODE.AMBIENT_VIDEO || !heroVisible || document.hidden) return;
    wordTimer = setInterval(() => {
      wordIndex = (wordIndex + 1) % Math.max(1, words.length);
      setActiveWord(words, wordIndex);
    }, WORD_INTERVAL_MS);
  };

  const setStaticMode = (reason) => {
    mode = HERO_MODE.STATIC_PREMIUM;
    hero.dataset.heroMode = mode;
    hero.dataset.heroModeReason = reason || "static";
    document.documentElement.dataset.heroMode = mode;
    clearWordTimer();
    pauseAllVideos();
    videos.forEach(resetVideo);
    layers.forEach((layer, index) => {
      layer.style.opacity = index === 0 ? "1" : "0";
      layer.classList.toggle("is-active", index === 0);
    });
    wordIndex = 0;
    setActiveWord(words, 0);
    setActiveScene(rows, 0);
    content.style.transform = "";
    content.style.opacity = "";
  };

  const updateCinema = () => {
    scrollTicking = false;
    if (mode !== HERO_MODE.SCROLL_CINEMA) return;

    const rect = hero.getBoundingClientRect();
    const distance = Math.max(1, hero.offsetHeight - innerHeight);
    const progress = Math.max(0, Math.min(1, -rect.top / distance));
    const weights = sceneWeights(progress);
    const activeScene = progress < .25 ? 0 : progress < .75 ? 1 : 2;

    layers.forEach((layer, index) => {
      layer.style.opacity = String(weights[index] ?? 0);
      layer.classList.toggle("is-active", index === activeScene);
    });
    setActiveScene(rows, activeScene);
    setActiveWord(words, activeScene);

    videos.forEach((video, index) => {
      if (!video) return;
      if (index === activeScene && heroVisible && !document.hidden) {
        playVideo(video).then((played) => {
          if (!played && mode === HERO_MODE.SCROLL_CINEMA) {
            videoUnavailable = true;
            applyCapability();
          }
        });
      } else {
        video.pause();
      }
    });

    const shift = Math.min(36, innerHeight * .04);
    content.style.transform = `translate3d(0, ${(-progress * shift).toFixed(2)}px, 0)`;
    content.style.opacity = String(1 - (progress * .08));
  };

  const requestCinemaUpdate = () => {
    if (scrollTicking || mode !== HERO_MODE.SCROLL_CINEMA) return;
    scrollTicking = true;
    requestAnimationFrame(updateCinema);
  };

  const applyCinemaMode = () => {
    mode = HERO_MODE.SCROLL_CINEMA;
    hero.dataset.heroMode = mode;
    hero.dataset.heroModeReason = "desktop-capable";
    document.documentElement.dataset.heroMode = mode;
    clearWordTimer();

    layers.forEach((layer) => { layer.style.opacity = "0"; });
    videos.forEach((video, index) => ensureVideoSource(video, index === 0 ? "auto" : "metadata"));
    requestCinemaUpdate();
  };

  const applyAmbientMode = async () => {
    mode = HERO_MODE.AMBIENT_VIDEO;
    hero.dataset.heroMode = mode;
    hero.dataset.heroModeReason = "ambient-capable";
    document.documentElement.dataset.heroMode = mode;
    content.style.transform = "";
    content.style.opacity = "";

    layers.forEach((layer, index) => {
      const active = index === 0;
      layer.style.opacity = active ? "1" : "0";
      layer.classList.toggle("is-active", active);
    });
    setActiveScene(rows, 0);
    setActiveWord(words, wordIndex);

    videos.slice(1).forEach(resetVideo);
    if (!ensureVideoSource(ambientVideo, "metadata")) {
      setStaticMode("no-ambient-source");
      return;
    }

    startAmbientWords();
    const played = await playVideo(ambientVideo);
    if (!played && mode === HERO_MODE.AMBIENT_VIDEO) {
      videoUnavailable = true;
      setStaticMode("autoplay-failed");
    }
  };

  const applyCapability = () => {
    const capability = getHeroCapability({ ambientVideoAvailable, videoUnavailable });
    hero.dataset.heroModeReason = capability.reason;

    if (capability.mode === mode) {
      if (mode === HERO_MODE.SCROLL_CINEMA) requestCinemaUpdate();
      if (mode === HERO_MODE.AMBIENT_VIDEO) startAmbientWords();
      return;
    }

    pauseAllVideos();
    clearWordTimer();

    if (capability.mode === HERO_MODE.SCROLL_CINEMA) {
      applyCinemaMode();
      return;
    }

    if (capability.mode === HERO_MODE.AMBIENT_VIDEO) {
      void applyAmbientMode();
      return;
    }

    setStaticMode(capability.reason);
  };

  const onVisibilityChange = () => {
    if (document.hidden || !heroVisible) {
      pauseAllVideos();
      clearWordTimer();
      return;
    }

    if (mode === HERO_MODE.AMBIENT_VIDEO) {
      startAmbientWords();
      void playVideo(ambientVideo);
    } else if (mode === HERO_MODE.SCROLL_CINEMA) {
      requestCinemaUpdate();
    }
  };

  if ("IntersectionObserver" in window) {
    visibilityObserver = new IntersectionObserver((entries) => {
      const entry = entries[0];
      heroVisible = Boolean(entry?.isIntersecting);
      onVisibilityChange();
    }, { threshold: .04 });
    visibilityObserver.observe(hero);
  }

  addEventListener("scroll", requestCinemaUpdate, { passive: true });
  addEventListener("resize", requestCinemaUpdate, { passive: true });
  document.addEventListener("visibilitychange", onVisibilityChange);
  const stopCapabilityWatch = watchHeroCapability(applyCapability);

  hero.dataset.heroController = "v2";
  applyCapability();

  return () => {
    clearWordTimer();
    pauseAllVideos();
    visibilityObserver?.disconnect();
    stopCapabilityWatch?.();
    removeEventListener("scroll", requestCinemaUpdate);
    removeEventListener("resize", requestCinemaUpdate);
    document.removeEventListener("visibilitychange", onVisibilityChange);
  };
}
