/**
 * ECOWHEEL — Heliomorfismo
 * Motor de partículas + anillo líquido + flujo de la ruleta.
 * Sin dependencias externas.
 */
(() => {
  "use strict";

  /* ================= helpers ================= */
  const $ = (id) => document.getElementById(id);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  // Acepta #rgb, #rrggbb o rgb()/rgba() y devuelve [r,g,b]
  function toRGB(color, fallback = [56, 228, 242]) {
    if (!color) return fallback;
    const s = String(color).trim();
    let m = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (m) {
      let h = m[1];
      if (h.length === 3) h = [...h].map((c) => c + c).join("");
      return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    }
    m = s.match(/rgba?\s*\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
    if (m) return [+m[1], +m[2], +m[3]];
    return fallback;
  }
  const rgba = (rgb, a) => `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`;

  /* ================= theme ================= */
  const body = document.body;
  const themeBtn = $("theme-btn");
  const themeIcon = $("theme-icon");
  const SUN = "M12 3a9 9 0 1 0 9 9c0-.35-.02-.7-.05-1.04A7 7 0 0 1 12 3Z";
  const SUN_FULL = "M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0-15v2.4M12 19.6V22M4.2 4.2l1.7 1.7M18.1 18.1l1.7 1.7M2 12h2.4M19.6 12H22M4.2 19.8l1.7-1.7M18.1 5.9l1.7-1.7";

  let helioCache = null;
  const readHelio = () => {
    const cs = getComputedStyle(body);
    const a = toRGB(cs.getPropertyValue("--helio-a"), [56, 228, 242]);
    const b = toRGB(cs.getPropertyValue("--helio-b"), [124, 244, 255]);
    const c = toRGB(cs.getPropertyValue("--helio-c"), [28, 107, 216]);
    return { a, b, c, white: [255, 255, 255] };
  };
  const helio = () => helioCache || (helioCache = readHelio());

  function applyTheme(theme) {
    body.classList.toggle("theme-night", theme === "night");
    body.classList.toggle("theme-day", theme === "day");
    themeIcon.innerHTML = theme === "day"
      ? `<path d="${SUN_FULL}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`
      : `<path d="${SUN}" fill="currentColor"/>`;
    try { localStorage.setItem("ecowheel-theme", theme); } catch { /* privado */ }
    helioCache = null;
  }

  let currentTheme = "night";
  try {
    currentTheme = localStorage.getItem("ecowheel-theme") ||
      (typeof ECOWHEEL_DEFAULT_THEME !== "undefined" ? ECOWHEEL_DEFAULT_THEME : "night");
  } catch { /* noop */ }
  applyTheme(currentTheme);
  themeBtn.addEventListener("click", () => {
    currentTheme = currentTheme === "night" ? "day" : "night";
    applyTheme(currentTheme);
  });

  /* ================= screens / nav ================= */
  const backBtn = $("back-btn");
  const screenSpin = $("screen-spin");
  const screenResult = $("screen-result");
  const spinBtn = $("spin-btn");
  const hintText = $("hint-text");
  const resultImage = $("result-image");
  const questionText = $("question-text");
  const learnMoreBtn = $("learn-more-btn");
  const learnMoreInfo = $("learn-more-info");

  let spinning = false;
  function resetSpinButton() {
    spinning = false;
    spinBtn.classList.remove("charging");
    spinBtn.setAttribute("aria-busy", "false");
    anim.mode = "idle";
    hintText.style.opacity = "1";
    hintText.classList.remove("is-loading");
    hintText.textContent = "Toca el núcleo para iniciar el giro";
  }
  backBtn.addEventListener("click", () => {
    if (!screenResult.hidden) {
      screenResult.hidden = true;
      screenSpin.hidden = false;
      try { spinTimers.forEach(clearTimeout); spinTimers = []; } catch { /* noop */ }
      resetSpinButton();
    } else {
      window.location.href = "admin.html";
    }
  });

  /* ================= anillo líquido ================= */
  // BUG FIX: antes se alternaba dpr global entre canvas y se usaba coords del
  // botón para el canvas (escalas distintas). Ahora cada canvas tiene su dpr.
  const ringPath = $("ring-jagged");
  const RING_N = 26;
  const RING_R = 72;
  const RING_C = 100;
  const ringSeed = Array.from({ length: RING_N }, () => Math.random() * 1000);

  const anim = { mode: "idle", start: 0, t: 0, amp: 5.5, speed: 0.35 };

  function noise1D(x) {
    return Math.sin(x) * 0.6 + Math.sin(x * 2.13 + 1.7) * 0.3 + Math.sin(x * 4.07 + 3.1) * 0.15;
  }
  const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

  function drawRing(t) {
    const pts = [];
    for (let i = 0; i < RING_N; i++) {
      const ang = (i / RING_N) * Math.PI * 2;
      // doble onda: respiración lenta + rizo rápido = superficie criogénica
      const n = noise1D(ringSeed[i] + t * anim.speed) * 0.75
        + noise1D(ringSeed[i] * 1.7 + t * anim.speed * 2.3) * 0.25;
      const r = RING_R + n * anim.amp;
      pts.push({ x: RING_C + Math.cos(ang) * r, y: RING_C + Math.sin(ang) * r });
    }
    let d = "";
    const m0 = mid(pts[0], pts[1]);
    d = `M${m0.x.toFixed(2)},${m0.y.toFixed(2)} `;
    for (let i = 1; i <= RING_N; i++) {
      const p = pts[i % RING_N];
      const m = mid(p, pts[(i + 1) % RING_N]);
      d += `Q${p.x.toFixed(2)},${p.y.toFixed(2)} ${m.x.toFixed(2)},${m.y.toFixed(2)} `;
    }
    ringPath.setAttribute("d", d + "Z");
  }

  /* ================= partículas helio (más fluido, burbujas) ================= */
  const canvas = $("particle-canvas");
  const ctx = canvas.getContext("2d");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let cw = 0, ch = 0, cx = 0, cy = 0, dprP = 1;

  function resizeParticles() {
    const rect = canvas.getBoundingClientRect();
    dprP = Math.min(window.devicePixelRatio || 1, 2);
    cw = Math.max(1, rect.width); ch = Math.max(1, rect.height);
    canvas.width = Math.ceil(cw * dprP);
    canvas.height = Math.ceil(ch * dprP);
    ctx.setTransform(dprP, 0, 0, dprP, 0, 0);
    cx = cw / 2; cy = ch / 2;
    // BUG FIX: radio relativo al canvas real, no al botón.
    const base = Math.min(cw, ch);
    for (const p of particles) p.baseRadius = base * (0.20 + p.orbit * 0.22);
  }
  // radio del núcleo (solo referencia visual): % del canvas
  const coreRadius = () => Math.min(cw, ch) * 0.20;

  class Particle {
    constructor(i) {
      this.orbit = Math.random();       // 0 centro → 1 borde
      this.depth = 0.35 + Math.random() * 0.65; // paralaje: lejos=pequeño/lento
      this.reset(true);
      this.angle = Math.random() * Math.PI * 2;
    }
    reset(spread) {
      this.mode = "ring";
      this.angle = Math.random() * Math.PI * 2;
      const base = Math.min(cw || 300, ch || 300);
      this.baseRadius = base * (spread ? (0.18 + this.orbit * 0.42) : 0.22);
      this.radius = this.baseRadius;
      this.speed = (0.12 + Math.random() * 0.4) * (Math.random() < 0.5 ? 1 : -1);
      this.sizeBase = (0.7 + Math.random() * 2.0) * this.depth;
      this.size = this.sizeBase;
      this.hueMix = Math.random();
      this.wob = Math.random() * Math.PI * 2;
      this.wobSpeed = 1.2 + Math.random() * 2.2;
      this.life = 1;
      this.burstV = 0;
      this.burstVX = 0; this.burstVY = 0;
      this.dx = 0; this.dy = 0;
      this.tw = Math.random() * Math.PI * 2; // parpadeo
    }
  }

  const isMobile = matchMedia("(max-width: 700px)").matches;
  const PARTICLE_COUNT = reducedMotion ? 0 : (isMobile ? 80 : 160);
  const particles = Array.from({ length: PARTICLE_COUNT }, (_, i) => new Particle(i));

  // ondas de choque concéntricas: anillos que se expanden al estallar el núcleo
  let shockwaves = [];

  // BUG FIX: puntero medido en coords del CANVAS (no del botón).
  const pointer = { x: null, y: null, active: false };
  function setPointer(e) {
    const r = canvas.getBoundingClientRect();
    const p = e.touches ? e.touches[0] : e;
    pointer.x = p.clientX - r.left;
    pointer.y = p.clientY - r.top;
  }
  for (const ev of ["pointermove", "pointerenter", "pointerdown"]) {
    canvas.addEventListener(ev, (e) => { setPointer(e); pointer.active = true; }, { passive: true });
    spinBtn.addEventListener(ev, (e) => { setPointer(e); pointer.active = true; }, { passive: true });
  }
  for (const ev of ["pointerleave", "pointerup", "pointercancel"]) {
    spinBtn.addEventListener(ev, () => { pointer.active = false; }, { passive: true });
    canvas.addEventListener(ev, () => { pointer.active = false; }, { passive: true });
  }

  // sprite pre-renderizado: evita 110 createRadialGradient por frame
  const spriteCache = new Map();
  function glowSprite(rgb) {
    const key = rgb.join(",");
    let s = spriteCache.get(key);
    if (s) return s;
    s = document.createElement("canvas");
    s.width = s.height = 64;
    const g = s.getContext("2d");
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, `rgba(255,255,255,.95)`);
    grad.addColorStop(0.25, rgba(rgb, 0.85));
    grad.addColorStop(0.6, rgba(rgb, 0.28));
    grad.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    spriteCache.set(key, s);
    return s;
  }

  function updateParticles(dt) {
    // rastro líquido: en vez de borrar, funde con transparencia → motion trail
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "rgba(8,8,12,0.18)";
    ctx.fillRect(0, 0, cw, ch);
    if (!particles.length) return;
    const C = helio();
    ctx.globalCompositeOperation = "lighter";

    const charging = anim.mode === "charging";
    const bursting = anim.mode === "burst";
    const speedMul = charging ? 5.2 : 1;
    const pull = charging ? 0.10 : 0;

    // ondas de choque concéntricas al estallar
    for (const sw of shockwaves) {
      sw.r += dt * 340;
      sw.a -= dt * 1.3;
      if (sw.a > 0.02) {
        ctx.strokeStyle = rgba(C.b, clamp(sw.a * 0.45, 0, 0.45));
        ctx.lineWidth = clamp(sw.a * 3.5, 0.5, 3.5);
        ctx.beginPath();
        ctx.arc(cx, cy, sw.r, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    shockwaves = shockwaves.filter(sw => sw.a > 0.02);

    for (const p of particles) {
      if (bursting) {
        // decaimiento natural de velocidad (amortiguación)
        p.burstVX *= (1 - dt * 2.8);
        p.burstVY *= (1 - dt * 2.8);
        // helio asciende: sesgo vertical ascendente
        p.burstVY -= dt * 420;
        // acumular desplazamiento respecto al punto orbital
        p.dx += p.burstVX * dt * 60;
        p.dy += p.burstVY * dt * 60;
        p.angle += p.speed * 0.02 * dt * 60;
        const lifeRate = 0.35 + p.depth * 0.35 + Math.random() * 0.3;
        p.life -= dt * lifeRate;
        if (p.life < 0) p.life = 0;
        // variación de tamaño: algunas crecen, otras se encogen
        const targetScale = 0.5 + Math.random() * 1.2;
        p.size += (targetScale - p.size) * Math.min(1, dt * 5);
      } else {
        p.angle += p.speed * speedMul * dt * 0.36 * p.depth;
        p.wob += dt * p.wobSpeed;
        p.tw += dt * 3;
        const wobble = Math.sin(p.wob) * 8 * p.depth;
        const target = p.baseRadius * (1 - pull) + wobble;
        p.radius += (target - p.radius) * Math.min(1, dt * 6);
        // respiración sutil del tamaño en reposo
        const breathe = 1 + Math.sin(p.tw * 0.5) * 0.08 * p.depth;
        p.size = p.sizeBase * breathe;
        p.dx = 0; p.dy = 0;
        p.life = 1;
      }

      let px = cx + Math.cos(p.angle) * p.radius + p.dx;
      let py = cy + Math.sin(p.angle) * p.radius + p.dy;

      if (pointer.active && pointer.x != null && !bursting) {
        const dx = pointer.x - px, dy = pointer.y - py;
        const dist = Math.hypot(dx, dy) || 1;
        // repulsión suave tipo menisco líquido (no teletransporte)
        const f = clamp(900 / (dist * dist), 0, 1.6) * dt * 22 * p.depth;
        px -= (dx / dist) * f;
        py -= (dy / dist) * f;
      }

      // burbuja de helio: núcleo blanco + halo de color + aro especular
      const col = p.hueMix > 0.66 ? C.b : p.hueMix > 0.33 ? C.a : C.c;
      const twinkle = 0.65 + 0.35 * Math.sin(p.tw) * p.depth;
      const chargeScale = charging ? 1.8 : 1;
      const burstScale = bursting ? Math.max(0.3, p.life) : 1;
      const R = Math.max(2, p.size * 5 * chargeScale * burstScale);
      ctx.globalAlpha = clamp(0.5 * p.life * twinkle * (0.5 + p.depth * 0.5), 0, 1);
      ctx.drawImage(glowSprite(col), px - R, py - R, R * 2, R * 2);
      // micro-burbuja: punto denso que vende "líquido"
      ctx.globalAlpha = clamp(0.55 * p.life * twinkle, 0, 1);
      ctx.fillStyle = rgba(C.white, 1);
      ctx.beginPath();
      ctx.arc(px, py, Math.max(0.5, p.size * 0.45 * chargeScale * burstScale), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";

    if (bursting && particles.every((p) => p.life <= 0)) {
      anim.mode = "settle";
      particles.forEach((p) => p.reset(true));
      shockwaves = [];
    }
  }

  /* ================= niebla criogénica ================= */
  const fogCanvas = $("fog-canvas");
  const fctx = fogCanvas.getContext("2d");
  let fogBlobs = [];
  let fogW = 0, fogH = 0, dprF = 1;

  function initFog() {
    const rect = fogCanvas.getBoundingClientRect();
    dprF = Math.min(window.devicePixelRatio || 1, 2);
    fogW = Math.max(1, rect.width);
    fogH = Math.max(1, rect.height);
    fogCanvas.width = Math.ceil(fogW * dprF);
    fogCanvas.height = Math.ceil(fogH * dprF);
    fctx.setTransform(dprF, 0, 0, dprF, 0, 0);
    // vapor frío: deriva lenta horizontal, apenas vertical
    fogBlobs = Array.from({ length: 6 }, () => ({
      x: Math.random() * fogW,
      y: Math.random() * fogH,
      r: 130 + Math.random() * 190,
      vx: (Math.random() - 0.5) * 7,
      vy: (Math.random() - 0.5) * 2.5,
      a: 0.10 + Math.random() * 0.10,
    }));
  }
  function drawFog(dt) {
    fctx.clearRect(0, 0, fogW, fogH);
    const C = helio();
    for (const b of fogBlobs) {
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.x < -b.r) b.x = fogW + b.r;
      if (b.x > fogW + b.r) b.x = -b.r;
      if (b.y < -b.r) b.y = fogH + b.r;
      if (b.y > fogH + b.r) b.y = -b.r;
      const g = fctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
      g.addColorStop(0, rgba(C.c, b.a));
      g.addColorStop(0.55, rgba(C.a, b.a * 0.45));
      g.addColorStop(1, "rgba(0,0,0,0)");
      fctx.fillStyle = g;
      fctx.beginPath();
      fctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      fctx.fill();
    }
  }

  /* ================= loop ================= */
  let lastT = performance.now();
  const BASE_AMP = 5.5, BASE_SPEED = 0.35;
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);

  function loop(now) {
    const dt = clamp((now - lastT) / 1000, 0.001, 0.05);
    lastT = now;
    if (!document.hidden) {
      anim.t += dt;
      const m = anim.mode;
      if (m === "charging") {
        // ebullición: sube rápido y se estabiliza (antes crecía sin cota por ms)
        const k = easeOut(clamp((now - anim.start) / 1100, 0, 1));
        anim.amp = lerp(BASE_AMP, 34, k);
        anim.speed = lerp(BASE_SPEED, 5.2, k);
      } else if (m === "burst") {
        anim.amp = lerp(anim.amp, 46, Math.min(1, dt * 10));
        anim.speed = lerp(anim.speed, 7, Math.min(1, dt * 10));
      } else {
        anim.amp += (BASE_AMP - anim.amp) * Math.min(1, dt * 3);
        anim.speed += (BASE_SPEED - anim.speed) * Math.min(1, dt * 3);
      }
      drawRing(anim.t * 40);
      updateParticles(dt);
      drawFog(dt);
    }
    requestAnimationFrame(loop);
  }

  /* ================= rondas / giro ================= */
  let roundPool = [];
  let roundPoolSignature = "";
  let lastQuestionKey = "";
  let spinTimers = [];

  const IMAGE_DB_NAME = "ecowheel-images";
  const IMAGE_STORE_NAME = "images";
  let imageDbPromise = null;

  function openImageDb() {
    if (!imageDbPromise) {
      imageDbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(IMAGE_DB_NAME, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(IMAGE_STORE_NAME);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return imageDbPromise;
  }

  async function resolveImage(imageId) {
    if (!imageId) return "";
    try {
      const db = await openImageDb();
      const blob = await new Promise((resolve, reject) => {
        const req = db.transaction(IMAGE_STORE_NAME).objectStore(IMAGE_STORE_NAME).get(imageId);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      return blob ? URL.createObjectURL(blob) : "";
    } catch {
      return "";
    }
  }

  const keyOf = (r) => String(r?.question || "").trim().toLocaleLowerCase();

  async function pickRound() {
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

    const tail = roundPool[roundPool.length - 1];
    if (roundPool.length > 1 && lastQuestionKey && keyOf(tail) === lastQuestionKey) {
      const alt = roundPool.findIndex((r) => keyOf(r) !== lastQuestionKey);
      if (alt > -1) [roundPool[roundPool.length - 1], roundPool[alt]] = [roundPool[alt], roundPool[roundPool.length - 1]];
    }

    const round = roundPool.pop();
    lastQuestionKey = keyOf(round);
    if (round.imageId) round.image = (await resolveImage(round.imageId)) || round.image || "";
    return round;
  }

  const uniqueRounds = (rounds) => {
    const seen = new Set();
    return rounds.filter((r) => {
      const k = keyOf(r);
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  };

  const shuffleRounds = (rounds) => {
    const s = [...rounds];
    for (let i = s.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [s[i], s[j]] = [s[j], s[i]];
    }
    return s;
  };

  /* Flujo del giro: carga 1.5s -> estallido 0.9s -> muestra la tarjeta.
     NO se toca la estructura: solo se restaura la funcion que el refactor
     dejo sin definir (por eso el click no hacia nada). */
  function startSpin() {
    if (spinning) return;
    spinning = true;
    spinBtn.classList.add("charging");
    spinBtn.setAttribute("aria-busy", "true");
    anim.mode = "charging";
    anim.start = performance.now();
    hintText.classList.add("is-loading");
    hintText.textContent = "Preparando el núcleo";

    const CHARGE_MS = 1500;
    const BURST_MS = 900;

    spinTimers.forEach(clearTimeout);
    spinTimers = [];

    spinTimers.push(setTimeout(() => {
      anim.mode = "burst";
      particles.forEach((p) => {
        if (p.mode === "ring") {
          const a = Math.random() * Math.PI * 2;
          const sp = 10 + Math.random() * 18;
          p.burstVX = Math.cos(a) * sp;
          p.burstVY = Math.sin(a) * sp;
        }
        p.life = 1;
      });
      // onda de choque central al estallar
      shockwaves.push({ r: 0, a: 1 });
    }, CHARGE_MS));

    spinTimers.push(setTimeout(async () => {
      const round = await pickRound();
      showRound(round);
      screenSpin.hidden = true;
      screenResult.hidden = false;
    }, CHARGE_MS + BURST_MS));
  }

  function loadStoredRounds() {
    try {
      const raw = JSON.parse(localStorage.getItem("ecowheel-rounds")) || [];
      // Normaliza el formato guardado por admin.html (images[]) al que
      // espera el wheel (image único) sin perder el arreglo original.
      return raw.map((r) => ({
        image: (r.images && r.images[0]) || r.image || "",
        imageId: r.imageId || "",
        question: r.question || "",
        info: r.info || "",
        action: r.action || "1. Panel de Usuario",
      }));
    } catch {
      return [];
    }
  }

  // revoca el blob ANTERIOR (no el nuevo en onload: eso rompía la imagen al volver atrás)
  let lastBlobUrl = "";
  function showRound(round) {
    if (!round) {
      questionText.textContent = "Aún no hay contenido: configúralo en el panel.";
      resultImage.removeAttribute("src");
      resultImage.alt = "";
      learnMoreBtn.hidden = true;
      learnMoreInfo.hidden = true;
      return;
    }
    if (lastBlobUrl.startsWith("blob:")) URL.revokeObjectURL(lastBlobUrl);
    lastBlobUrl = String(round.image || "").startsWith("blob:") ? round.image : "";
    if (round.image) {
      resultImage.src = round.image;
      resultImage.alt = round.question;
    } else {
      resultImage.removeAttribute("src");
      resultImage.alt = round.question;
    }
    questionText.textContent = round.question;
    const hasInfo = Boolean(round.info);
    learnMoreBtn.hidden = !hasInfo;
    learnMoreInfo.hidden = true;
    if (hasInfo) {
      learnMoreInfo.textContent = round.info;
      learnMoreBtn.firstChild.textContent = "Aprender más ";
    }
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
