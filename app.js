/**
 * ECOWHEEL — Heliomorfismo
 * Motor de partículas + anillo líquido + flujo de la ruleta.
 * Sin dependencias externas.
 */
(() => {
  "use strict";

  /* ---------------------------------------------------------
     THEME (Día = Plata iPhone 18 Pro / Noche = Negro espacial)
  --------------------------------------------------------- */
  const body = document.body;
  const themeBtn = document.getElementById("theme-btn");
  const themeIcon = document.getElementById("theme-icon");

  const SUN =
    'M12 3a9 9 0 1 0 9 9c0-.35-.02-.7-.05-1.04A7 7 0 0 1 12 3Z';
  const SUN_FULL =
    'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0-15v2.4M12 19.6V22M4.2 4.2l1.7 1.7M18.1 18.1l1.7 1.7M2 12h2.4M19.6 12H22M4.2 19.8l1.7-1.7M18.1 5.9l1.7-1.7';

  function applyTheme(theme) {
    body.classList.toggle("theme-night", theme === "night");
    body.classList.toggle("theme-day", theme === "day");
    themeIcon.innerHTML =
      theme === "day"
        ? `<path d="${SUN_FULL}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`
        : `<path d="${SUN}" fill="currentColor"/>`;
    localStorage.setItem("ecowheel-theme", theme);
  }

  let currentTheme =
    localStorage.getItem("ecowheel-theme") ||
    (typeof ECOWHEEL_DEFAULT_THEME !== "undefined" ? ECOWHEEL_DEFAULT_THEME : "night");
  applyTheme(currentTheme);

  themeBtn.addEventListener("click", () => {
    currentTheme = currentTheme === "night" ? "day" : "night";
    applyTheme(currentTheme);
    helioColors = null;
  });

  /* ---------------------------------------------------------
     BACK BUTTON
  --------------------------------------------------------- */
  const backBtn = document.getElementById("back-btn");
  const screenSpin = document.getElementById("screen-spin");
  const screenResult = document.getElementById("screen-result");

  backBtn.addEventListener("click", () => {
    if (!screenResult.hidden) {
      screenResult.hidden = true;
      screenSpin.hidden = false;
      resetSpinButton();
    } else {
      // Aquí engancharías la navegación real a tu panel de usuario.
      window.history.length > 1 ? window.history.back() : null;
    }
  });

  /* ---------------------------------------------------------
     ANILLO LÍQUIDO (blob irregular tipo helio-morfismo)
  --------------------------------------------------------- */
  const ringPath = document.getElementById("ring-jagged");
  const spinBtn = document.getElementById("spin-btn");

  const RING_POINTS = 22;
  const RING_R = 72;
  const RING_CENTER = 100;
  const ringNoiseOffsets = Array.from({ length: RING_POINTS }, () => Math.random() * 1000);
  let ringAmplitude = 5.5; // idle wobble
  let ringSpeed = 0.35;

  function noise1D(x) {
    // pseudo-noise suave (suma de senos) — sin dependencias externas
    return (
      Math.sin(x) * 0.6 +
      Math.sin(x * 2.13 + 1.7) * 0.3 +
      Math.sin(x * 4.07 + 3.1) * 0.15
    );
  }

  function drawRing(t) {
    let d = "";
    for (let i = 0; i <= RING_POINTS; i++) {
      const angle = (i / RING_POINTS) * Math.PI * 2;
      const n = noise1D(ringNoiseOffsets[i % RING_POINTS] + t * ringSpeed);
      const r = RING_R + n * ringAmplitude;
      const x = RING_CENTER + Math.cos(angle) * r;
      const y = RING_CENTER + Math.sin(angle) * r;
      d += (i === 0 ? "M" : "L") + x.toFixed(2) + "," + y.toFixed(2) + " ";
    }
    d += "Z";
    ringPath.setAttribute("d", d);
  }

  /* ---------------------------------------------------------
     PARTÍCULAS DE HELIO LÍQUIDO (canvas, additive glow)
  --------------------------------------------------------- */
  const canvas = document.getElementById("particle-canvas");
  const ctx = canvas.getContext("2d");
  let cw = 0, ch = 0, cx = 0, cy = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    cw = rect.width; ch = rect.height;
    canvas.width = cw * dpr; canvas.height = ch * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx = cw / 2; cy = ch / 2;
  }

  const BASE_RADIUS = () => Math.min(cw, ch) * 0.29; // radio del núcleo (botón)

  class Particle {
    constructor() { this.reset(true); }
    reset(spread) {
      const a = Math.random() * Math.PI * 2;
      const r = BASE_RADIUS() * (spread ? (0.55 + Math.random() * 0.9) : 1.0);
      this.angle = a;
      this.radius = r;
      this.baseRadius = r;
      this.speed = (0.15 + Math.random() * 0.35) * (Math.random() < 0.5 ? 1 : -1);
      this.size = 0.8 + Math.random() * 2.1;
      this.hueMix = Math.random();
      this.wob = Math.random() * Math.PI * 2;
      this.life = 1;
      this.burstVX = 0;
    }
  }

  const PARTICLE_COUNT = 90;
  let particles = Array.from({ length: PARTICLE_COUNT }, () => new Particle());

  // Interacción puntero (mouse / touch) — atrae/perturba las partículas
  const pointer = { x: null, y: null, active: false };

  function setPointerFromEvent(e) {
    const rect = canvas.getBoundingClientRect();
    const p = e.touches ? e.touches[0] : e;
    pointer.x = p.clientX - rect.left;
    pointer.y = p.clientY - rect.top;
  }

  spinBtn.addEventListener("pointermove", (e) => {
    setPointerFromEvent(e);
    pointer.active = true;
  }, { passive: true });
  spinBtn.addEventListener("pointerenter", (e) => {
    setPointerFromEvent(e);
    pointer.active = true;
  }, { passive: true });
  ["pointerleave", "pointerup", "pointercancel"].forEach((eventName) => {
    spinBtn.addEventListener(eventName, () => { pointer.active = false; }, { passive: true });
  });

  let helioColors = null;

  function readHelioColors() {
    const styles = getComputedStyle(body);
    return {
      a: styles.getPropertyValue("--helio-a").trim() || "#38e4f2",
      b: styles.getPropertyValue("--helio-b").trim() || "#7cf4ff",
      c: styles.getPropertyValue("--helio-c").trim() || "#1c6bd8",
    };
  }

  function themeHelioColors() {
    return helioColors || (helioColors = readHelioColors());
  }

  /* ---------------------------------------------------------
     ESTADOS DE ANIMACIÓN: idle -> charging -> burst -> settle
  --------------------------------------------------------- */
  let mode = "idle"; // idle | charging | burst | settle
  let modeStart = 0;
  let globalT = 0;

  function updateParticles(dt) {
    const colors = themeHelioColors();
    ctx.clearRect(0, 0, cw, ch);
    ctx.globalCompositeOperation = "lighter";

    const speedMul = mode === "charging" ? 5.2 : mode === "burst" ? 1 : 1;
    const pullToCenter = mode === "charging" ? 0.06 : 0;

    for (const p of particles) {
      if (mode === "burst") {
        // Explosión radial tipo "quench" de helio
        p.radius += p.burstVX * dt * 60;
        p.angle += p.speed * 0.01 * dt * 60;
        p.life -= dt * 0.9;
        if (p.life < 0) p.life = 0;
      } else {
        p.angle += p.speed * 0.01 * speedMul * dt * 60 * 0.06;
        p.wob += dt * 2;
        const wobble = Math.sin(p.wob) * 6;
        const targetRadius = p.baseRadius * (1 - pullToCenter) + wobble;
        p.radius += (targetRadius - p.radius) * 0.08;
        p.life = 1;
      }

      let px = cx + Math.cos(p.angle) * p.radius;
      let py = cy + Math.sin(p.angle) * p.radius;

      // atracción sutil hacia el puntero (interacción usuario)
      if (pointer.active && pointer.x != null && mode !== "burst") {
        const dx = pointer.x - px, dy = pointer.y - py;
        const dist = Math.hypot(dx, dy) || 1;
        const force = Math.min(18 / dist, 0.9) * 10;
        px += (dx / dist) * force * dt * 6;
        py += (dy / dist) * force * dt * 6;
      }

      const glow = ctx.createRadialGradient(px, py, 0, px, py, p.size * 5);
      const col = p.hueMix > 0.66 ? colors.b : p.hueMix > 0.33 ? colors.a : colors.c;
      glow.addColorStop(0, col);
      glow.addColorStop(1, "transparent");
      ctx.globalAlpha = 0.55 * p.life;
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(px, py, p.size * (mode === "charging" ? 1.6 : 1), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";

    if (mode === "burst" && particles.every((p) => p.life <= 0)) {
      mode = "settle";
      particles.forEach((p) => p.reset(true));
    }
  }

  /* ---------------------------------------------------------
     NIEBLA CRIOGÉNICA DE FONDO
  --------------------------------------------------------- */
  const fogCanvas = document.getElementById("fog-canvas");
  const fctx = fogCanvas.getContext("2d");
  let fogBlobs = [];
  let fogWidth = 0;
  let fogHeight = 0;
  function initFog() {
    const rect = fogCanvas.getBoundingClientRect();
    fogWidth = rect.width;
    fogHeight = rect.height;
    fogCanvas.width = rect.width * dpr;
    fogCanvas.height = rect.height * dpr;
    fctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    fogBlobs = Array.from({ length: 6 }, () => ({
      x: Math.random() * rect.width,
      y: Math.random() * rect.height,
      r: 120 + Math.random() * 180,
      vx: (Math.random() - 0.5) * 6,
      vy: (Math.random() - 0.5) * 6,
    }));
  }
  function drawFog(dt) {
    fctx.clearRect(0, 0, fogWidth, fogHeight);
    const colors = themeHelioColors();
    for (const b of fogBlobs) {
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.x < -b.r) b.x = fogWidth + b.r;
      if (b.x > fogWidth + b.r) b.x = -b.r;
      if (b.y < -b.r) b.y = fogHeight + b.r;
      if (b.y > fogHeight + b.r) b.y = -b.r;
      const g = fctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
      g.addColorStop(0, colors.c + "22");
      g.addColorStop(1, "transparent");
      fctx.fillStyle = g;
      fctx.beginPath();
      fctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      fctx.fill();
    }
  }

  /* ---------------------------------------------------------
     LOOP PRINCIPAL
  --------------------------------------------------------- */
  let lastT = performance.now();
  function loop(now) {
    const dt = Math.min((now - lastT) / 1000, 0.05);
    lastT = now;
    globalT += dt;

    if (mode === "charging") {
      ringAmplitude = 5.5 + Math.min((now - modeStart) / 30, 34);
      ringSpeed = 0.35 + Math.min((now - modeStart) / 400, 6);
    } else if (mode !== "burst") {
      ringAmplitude += (5.5 - ringAmplitude) * 0.05;
      ringSpeed += (0.35 - ringSpeed) * 0.05;
    }

    drawRing(globalT * 40);
    updateParticles(dt);
    drawFog(dt);

    requestAnimationFrame(loop);
  }

  /* ---------------------------------------------------------
     SECUENCIA DE GIRO (juego de azar)
  --------------------------------------------------------- */
  const hintText = document.getElementById("hint-text");
  const resultImage = document.getElementById("result-image");
  const questionText = document.getElementById("question-text");
  const learnMoreBtn = document.getElementById("learn-more-btn");
  const learnMoreInfo = document.getElementById("learn-more-info");

  let spinning = false;
  let roundPool = [];
  let roundPoolSignature = "";
  let lastQuestionKey = "";

  function resetSpinButton() {
    spinBtn.classList.remove("charging");
    mode = "idle";
    hintText.style.opacity = "1";
    hintText.textContent = "Toca el núcleo para iniciar el giro";
    spinning = false;
  }

  function pickRound() {
    const stored = loadStoredRounds();
    const rounds = uniqueRounds(stored.length
      ? stored
      : (typeof ECOWHEEL_ROUNDS !== "undefined" ? ECOWHEEL_ROUNDS : []));
    if (!rounds.length) return null;

    const signature = rounds.map((round) => round.question.trim().toLocaleLowerCase()).join("|");
    if (signature !== roundPoolSignature || roundPool.length === 0) {
      roundPool = shuffleRounds(rounds);
      roundPoolSignature = signature;
    }

    if (roundPool.length > 1 && lastQuestionKey) {
      const nextQuestionKey = roundPool[roundPool.length - 1].question.trim().toLocaleLowerCase();
      if (nextQuestionKey === lastQuestionKey) {
        const alternativeIndex = roundPool.findIndex((round) => (
          round.question.trim().toLocaleLowerCase() !== lastQuestionKey
        ));
        [roundPool[roundPool.length - 1], roundPool[alternativeIndex]] = [
          roundPool[alternativeIndex],
          roundPool[roundPool.length - 1],
        ];
      }
    }

    const round = roundPool.pop();
    lastQuestionKey = round.question.trim().toLocaleLowerCase();
    return round;
  }

  function uniqueRounds(rounds) {
    const seenQuestions = new Set();
    return rounds.filter((round) => {
      const questionKey = (round.question || "").trim().toLocaleLowerCase();
      if (!questionKey || seenQuestions.has(questionKey)) return false;
      seenQuestions.add(questionKey);
      return true;
    });
  }

  function shuffleRounds(rounds) {
    const shuffled = [...rounds];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
    }
    return shuffled;
  }

  function loadStoredRounds() {
    try {
      const raw = JSON.parse(localStorage.getItem("ecowheel-rounds")) || [];
      // Normaliza el formato guardado por admin.html (images[]) al que
      // espera el wheel (image único) sin perder el arreglo original.
      return raw.map((r) => ({
        image: (r.images && r.images[0]) || r.image || "",
        question: r.question || "",
        info: r.info || "",
        action: r.action || "1. Panel de Usuario",
      }));
    } catch {
      return [];
    }
  }

  function startSpin() {
    if (spinning) return;
    spinning = true;
    spinBtn.classList.add("charging");
    mode = "charging";
    modeStart = performance.now();
    hintText.textContent = "Enfriando el resonador…";

    const CHARGE_MS = 1500;
    const BURST_MS = 900;

    setTimeout(() => {
      mode = "burst";
      particles.forEach((p) => {
        p.burstVX = 6 + Math.random() * 10;
        p.life = 1;
      });
    }, CHARGE_MS);

    setTimeout(() => {
      const round = pickRound();
      if (round) {
        resultImage.src = round.image;
        resultImage.alt = round.question;
        questionText.textContent = round.question;
        if (round.info) {
          learnMoreBtn.hidden = false;
          learnMoreInfo.hidden = true;
          learnMoreInfo.textContent = round.info;
        } else {
          learnMoreBtn.hidden = true;
          learnMoreInfo.hidden = true;
        }
      }
      screenSpin.hidden = true;
      screenResult.hidden = false;
    }, CHARGE_MS + BURST_MS);
  }

  spinBtn.addEventListener("click", startSpin);

  learnMoreBtn.addEventListener("click", () => {
    learnMoreInfo.hidden = !learnMoreInfo.hidden;
  });

  /* ---------------------------------------------------------
     INIT
  --------------------------------------------------------- */
  function init() {
    resizeCanvas();
    initFog();
    drawRing(0);
    requestAnimationFrame(loop);
  }

  window.addEventListener("resize", () => { resizeCanvas(); initFog(); });
  init();
})();
