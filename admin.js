/**
 * ECOWHEEL — Panel de administración (admin.html)
 * -------------------------------------------------
 * Guarda el contenido del wheel en localStorage bajo la clave
 * "ecowheel-rounds". app.js (la app principal) lee esa misma
 * clave primero, y solo si está vacía usa el contenido de
 * config.js. Así el panel y el wheel quedan conectados sin
 * necesidad de un servidor/backend.
 */
(() => {
  "use strict";

  /* ---------------- tema día/noche (misma clave e iconos que el wheel) --- */
  const THEME_MOON = "M12 3a9 9 0 1 0 9 9c0-.35-.02-.7-.05-1.04A7 7 0 0 1 12 3Z";
  const THEME_SUN = "M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0-15v2.4M12 19.6V22M4.2 4.2l1.7 1.7M18.1 18.1l1.7 1.7M2 12h2.4M19.6 12H22M4.2 19.8l1.7-1.7M18.1 5.9l1.7-1.7";
  function applyAdminTheme(theme) {
    document.body.classList.toggle("theme-night", theme !== "day");
    document.body.classList.toggle("theme-day", theme === "day");
    try { localStorage.setItem("ecowheel-theme", theme); } catch { /* noop */ }
    const icon = document.getElementById("admin-theme-icon");
    if (icon) {
      icon.innerHTML = theme === "day"
        ? `<path d="${THEME_SUN}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`
        : `<path d="${THEME_MOON}" fill="currentColor"/>`;
    }
  }
  try {
    applyAdminTheme(localStorage.getItem("ecowheel-theme") || "night");
  } catch { /* noop */ }
  document.getElementById("admin-theme-btn")?.addEventListener("click", () => {
    const isDay = document.body.classList.contains("theme-day");
    applyAdminTheme(isDay ? "night" : "day");
  });
  window.addEventListener("storage", (e) => {
    if (e.key === "ecowheel-theme" && e.newValue) applyAdminTheme(e.newValue);
  });

  const STORAGE_KEY = "ecowheel-rounds";
  const MAX_IMAGES = 250;
  const MAX_BULK_ROUNDS = 250;
  const IMAGE_DB_NAME = "ecowheel-images";
  const IMAGE_STORE_NAME = "images";

  const questionInput = document.getElementById("question-input");
  const infoInput = document.getElementById("info-input");
  const dropzone = document.getElementById("dropzone");
  const fileInput = document.getElementById("file-input");
  const thumbStrip = document.getElementById("thumb-strip");
  const form = document.getElementById("round-form");
  const saveBtn = document.getElementById("save-btn");
  const cancelEditBtn = document.getElementById("cancel-edit-btn");
  const formStatus = document.getElementById("form-status");
  const fileCount = document.getElementById("file-count");

  const pdfDropzone = document.getElementById("pdf-dropzone");
  const pdfInput = document.getElementById("pdf-input");
  const pdfStrip = document.getElementById("pdf-strip");
  const pdfCount = document.getElementById("pdf-count");

  const listItemsEl = document.getElementById("list-items");
  const listCountEl = document.getElementById("list-count");
  const listFooterEl = document.getElementById("list-footer");

  let currentImages = []; // dataURLs de la ronda en edición
  let editingId = null;

  /* ---------------- almacenamiento ---------------- */
  function loadRounds() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch {
      return [];
    }
  }
  function saveRounds(rounds) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rounds));
  }

  function openImageDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(IMAGE_DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(IMAGE_STORE_NAME);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function getImageBlob(id) {
    if (!id) return null;
    try {
      const db = await openImageDb();
      const blob = await new Promise((resolve, reject) => {
        const req = db.transaction(IMAGE_STORE_NAME).objectStore(IMAGE_STORE_NAME).get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
      db.close();
      return blob instanceof Blob ? blob : null;
    } catch {
      return null;
    }
  }

  async function deleteImageBlob(id) {
    if (!id) return;
    try {
      const db = await openImageDb();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(IMAGE_STORE_NAME, "readwrite");
        tx.objectStore(IMAGE_STORE_NAME).delete(id);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    } catch { /* noop */ }
  }

  // Cache de objectURLs por imageId: la lista reutiliza la misma URL
  // sin re-leer IndexedDB en cada render. Se revocan al eliminar.
  const thumbUrlCache = new Map(); // imageId -> objectURL
  async function thumbUrlForId(imageId) {
    if (!imageId) return "";
    if (thumbUrlCache.has(imageId)) return thumbUrlCache.get(imageId);
    const blob = await getImageBlob(imageId);
    if (!blob) return "";
    const url = URL.createObjectURL(blob);
    thumbUrlCache.set(imageId, url);
    return url;
  }
  function forgetThumbUrl(imageId) {
    const url = thumbUrlCache.get(imageId);
    if (url) {
      try { URL.revokeObjectURL(url); } catch { /* noop */ }
      thumbUrlCache.delete(imageId);
    }
  }

  // Fuente de previsualización para CUALQUIER round, sin importar
  // cómo se guardó: formulario (images[]), masiva/Drive (imageId) o legado (image).
  async function thumbSrcFor(round) {
    if (!round) return "";
    if (round.images && round.images[0]) return round.images[0];
    if (round.imageId) return await thumbUrlForId(round.imageId);
    if (round.image) return round.image;
    return "";
  }

  async function storeImage(id, file) {
    const db = await openImageDb();
    await new Promise((resolve, reject) => {
      const transaction = db.transaction(IMAGE_STORE_NAME, "readwrite");
      transaction.objectStore(IMAGE_STORE_NAME).put(file, id);
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });
    db.close();
  }

  /* ---------------- subida ÚNICA: equipo + Drive alimentan el mismo lote ----------------
     Una sola zona (dropzone/fileInput) + Drive: todo cae a stagedFiles y se
     previsualiza en thumbStrip automáticamente. El guardado decide:
     1 pregunta -> 1 tarjeta con la primera imagen; lista "1. .. 2. .." ->
     N tarjetas emparejadas por número de archivo. */
  let stagedFiles = []; // File[] acumulados (equipo o descargados de Drive)
  const stagedUrls = new Map(); // File -> objectURL para preview inmediata
  let stagedPdfs = []; // File[] PDF de solución acumulados (numerados 1. 2. 3.…)

  function setStatus(msg, ok) {
    if (!formStatus) return;
    formStatus.textContent = msg || "";
    formStatus.classList.toggle("is-ok", !!ok);
  }

  function refreshStagedUI() {
    const count = stagedFiles.length;
    if (fileCount) {
      fileCount.hidden = count === 0;
      if (count > 0) fileCount.textContent = `✓ ${count} imagen${count === 1 ? "" : "es"} lista${count === 1 ? "" : "s"} para emparejar`;
    }
    thumbStrip.innerHTML = "";
    thumbStrip.hidden = count === 0;
    // Preview automática: hasta 24 para no saturar el DOM; el resto se cuenta.
    stagedFiles.slice(0, 24).forEach((file, i) => {
      let url = stagedUrls.get(file);
      if (!url) { url = URL.createObjectURL(file); stagedUrls.set(file, url); }
      const item = document.createElement("div");
      item.className = "thumb-item";
      const img = document.createElement("img");
      img.src = url;
      img.alt = file.name || `Imagen ${i + 1}`;
      img.decoding = "async";
      const rm = document.createElement("button");
      rm.type = "button";
      rm.className = "thumb-remove";
      rm.setAttribute("aria-label", "Quitar imagen");
      rm.textContent = "×";
      rm.addEventListener("click", () => {
        const url2 = stagedUrls.get(file);
        if (url2) { try { URL.revokeObjectURL(url2); } catch { /* noop */ } stagedUrls.delete(file); }
        stagedFiles = stagedFiles.filter((f) => f !== file);
        syncFileInput();
        refreshStagedUI();
      });
      item.appendChild(img);
      item.appendChild(rm);
      thumbStrip.appendChild(item);
    });
    if (count > 24) {
      const more = document.createElement("p");
      more.className = "bulk-file-count";
      more.textContent = `… y ${count - 24} más`;
      thumbStrip.appendChild(more);
    }
  }

  function syncFileInput() {
    try {
      const dt = new DataTransfer();
      stagedFiles.forEach((f) => dt.items.add(f));
      fileInput.files = dt.files;
    } catch { /* Safari antiguo: se sigue con stagedFiles */ }
  }

  function addStagedFiles(fileList) {
    const incoming = Array.from(fileList || []).filter((f) => f && f.type && f.type.startsWith("image/"));
    if (!incoming.length) return 0;
    const seen = new Set(stagedFiles.map((f) => `${f.name}::${f.size}::${f.lastModified || 0}`));
    let added = 0;
    for (const file of incoming) {
      const key = `${file.name}::${file.size}::${file.lastModified || 0}`;
      if (seen.has(key)) continue;
      if (stagedFiles.length >= MAX_IMAGES) break;
      seen.add(key);
      stagedFiles.push(file);
      added += 1;
    }
    syncFileInput();
    refreshStagedUI();
    return added;
  }

  // Vista previa automática del lote en curso (stagedFiles = File reales).
  // Durante una EDICIÓN sin archivos nuevos, pinta además la imagen actual
  // de la tarjeta (currentImages) para que siempre se vea lo cargado.
  function renderThumbs() {
    refreshStagedUI();
    if (!stagedFiles.length && currentImages.length) {
      thumbStrip.hidden = false;
      currentImages.slice(0, 24).forEach((src, i) => {
        const item = document.createElement("div");
        item.className = "thumb-item";
        const img = document.createElement("img");
        img.src = src;
        img.alt = `Imagen actual ${i + 1}`;
        img.decoding = "async";
        const rm = document.createElement("button");
        rm.type = "button";
        rm.className = "thumb-remove";
        rm.setAttribute("aria-label", "Quitar imagen actual");
        rm.textContent = "×";
        rm.addEventListener("click", () => {
          currentImages = [];
          renderThumbs();
        });
        item.appendChild(img);
        item.appendChild(rm);
        thumbStrip.appendChild(item);
      });
    }
  }

  const isPdf = (f) => f && (f.type === "application/pdf" || /\.pdf$/i.test(String(f.name || "")));

  function syncPdfInput() {
    try {
      const dt = new DataTransfer();
      stagedPdfs.forEach((f) => dt.items.add(f));
      pdfInput.files = dt.files;
    } catch { /* Safari antiguo: se sigue con stagedPdfs */ }
  }

  function addStagedPdfs(fileList) {
    const incoming = Array.from(fileList || []).filter(isPdf);
    if (!incoming.length) return 0;
    const seen = new Set(stagedPdfs.map((f) => `${f.name}::${f.size}::${f.lastModified || 0}`));
    let added = 0;
    for (const file of incoming) {
      const key = `${file.name}::${file.size}::${file.lastModified || 0}`;
      if (seen.has(key)) continue;
      if (stagedPdfs.length >= MAX_IMAGES) break;
      seen.add(key);
      stagedPdfs.push(file);
      added += 1;
    }
    syncPdfInput();
    refreshPdfUI();
    return added;
  }

  function refreshPdfUI() {
    const n = stagedPdfs.length;
    if (pdfCount) {
      pdfCount.hidden = n === 0;
      if (n > 0) pdfCount.textContent = `✓ ${n} PDF de solución${n === 1 ? "" : "es"} listo${n === 1 ? "" : "s"} para emparejar`;
    }
    if (!pdfStrip) return;
    pdfStrip.innerHTML = "";
    pdfStrip.hidden = n === 0;
    stagedPdfs.forEach((file, i) => {
      const item = document.createElement("div");
      item.className = "pdf-item";
      const badge = document.createElement("span");
      badge.className = "pdf-badge";
      badge.textContent = "PDF";
      const name = document.createElement("span");
      name.className = "pdf-name";
      name.textContent = file.name || `Solución ${i + 1}`;
      name.title = file.name || "";
      const rm = document.createElement("button");
      rm.type = "button";
      rm.className = "thumb-remove";
      rm.setAttribute("aria-label", "Quitar PDF");
      rm.textContent = "×";
      rm.addEventListener("click", () => {
        stagedPdfs = stagedPdfs.filter((x) => x !== file);
        syncPdfInput();
        refreshPdfUI();
      });
      item.appendChild(badge);
      item.appendChild(name);
      item.appendChild(rm);
      pdfStrip.appendChild(item);
    });
  }

  dropzone.addEventListener("click", () => fileInput.click());
  dropzone.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInput.click(); }
  });
  fileInput.addEventListener("change", (e) => {
    if (!e.target.files?.length) return; // reset del input: no pinta mensaje
    addStagedFiles(e.target.files);
    fileInput.value = ""; // permite re-elegir el mismo archivo
    syncFileInput();
    setStatus(stagedFiles.length ? "" : "Sube al menos 1 imagen (equipo o Drive).", false);
  });

  ["dragenter", "dragover"].forEach((evt) =>
    dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.add("dragover"); })
  );
  ["dragleave", "drop"].forEach((evt) =>
    dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.remove("dragover"); })
  );
  dropzone.addEventListener("drop", (e) => {
    if (e.dataTransfer?.files?.length) addStagedFiles(e.dataTransfer.files);
  });

  pdfDropzone.addEventListener("click", () => pdfInput.click());
  pdfDropzone.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pdfInput.click(); }
  });
  pdfInput.addEventListener("change", (e) => {
    if (!e.target.files?.length) return;
    addStagedPdfs(e.target.files);
    pdfInput.value = "";
    syncPdfInput();
  });
  ["dragenter", "dragover"].forEach((evt) =>
    pdfDropzone.addEventListener(evt, (e) => { e.preventDefault(); pdfDropzone.classList.add("dragover"); })
  );
  ["dragleave", "drop"].forEach((evt) =>
    pdfDropzone.addEventListener(evt, (e) => { e.preventDefault(); pdfDropzone.classList.remove("dragover"); })
  );
  pdfDropzone.addEventListener("drop", (e) => {
    if (e.dataTransfer?.files?.length) addStagedPdfs(e.dataTransfer.files);
  });

  /* ---------------- parseo único: 1 pregunta o lista "1. .." ----------------
     Acepta saltos de línea o todo en una línea ("1. A 2. B 3. C").
     Devuelve Map(numero -> texto). Si no hay números, el texto completo es la #1. */
  function parseBulkQuestions(text) {
    const questions = new Map();
    const raw = String(text || "").trim();
    if (!raw) return questions;
    const cleaned = raw.replace(/\r/g, "\n");
    const numbered = [...cleaned.matchAll(/(?:^|\n)\s*(\d+)\s*[.)\-:]\s*([\s\S]*?)(?=(?:\n\s*\d+\s*[.)\-:])|$)/g)];
    if (numbered.length) {
      numbered.forEach((m) => {
        const n = Number(m[1]);
        const q = String(m[2] || "").replace(/\s+/g, " ").trim();
        if (Number.isFinite(n) && n >= 1 && n <= MAX_BULK_ROUNDS && q) questions.set(n, q);
      });
      // Respaldo: si el regex no capturó pero hay líneas "N. texto", línea por línea.
      if (!questions.size) {
        cleaned.split(/\n/).forEach((line) => {
          const match = line.match(/^\s*(\d+)\s*[.)\-:]\s*(.+?)\s*$/);
          if (match && match[2]) questions.set(Number(match[1]), match[2].trim());
        });
      }
      return questions;
    }
    questions.set(1, raw.replace(/\s+/g, " ").trim());
    return questions;
  }

  function getImageNumber(fileOrName) {
    // Regla única anti-confusión: el número va AL INICIO del nombre.
    // Acepta "1.jpg", "1.imagenrm.jpg", "02 - foto.png", "3_cualquier-nombre.webp".
    const name = typeof fileOrName === "string" ? fileOrName : (fileOrName?.name || "");
    const match = String(name).trim().match(/^(\d+)\s*[.\-_)}\s:]?/);
    if (!match) return null;
    const n = Number(match[1]);
    return Number.isFinite(n) && n >= 1 && n <= MAX_BULK_ROUNDS ? n : null;
  }

  async function importBulk() {
    const questions = parseBulkQuestions(questionInput.value);
    const files = Array.from(fileInput.files?.length ? fileInput.files : stagedFiles).filter((file) => file.type.startsWith("image/"));
    if (!questions.size || !files.length) {
      setStatus("Escribe la pregunta (o lista 1. 2. 3.) y sube al menos 1 imagen.", false);
      return 0;
    }

    const images = new Map();
    files.slice(0, MAX_BULK_ROUNDS).forEach((file) => {
      const number = getImageNumber(file);
      if (number && !images.has(number)) images.set(number, file);
    });
    // Caso simple: 1 sola pregunta sin número -> usa la primera imagen tal cual.
    const singleQuestion = questions.size === 1 && questions.has(1) && ![...files].some((f) => getImageNumber(f));
    let pairs = [...questions.keys()]
      .filter((number) => images.has(number))
      .sort((a, b) => a - b)
      .slice(0, MAX_BULK_ROUNDS);
    if (singleQuestion) pairs = [1];
    if (!pairs.length) {
      setStatus("No hay coincidencias: revisa que el número del archivo y la pregunta sea igual.", false);
      return 0;
    }

    saveBtn.disabled = true;
    setStatus(`Preparando ${pairs.length} tarjeta${pairs.length === 1 ? "" : "s"}…`, false);
    const rounds = loadRounds();
    const infoText = infoInput.value.trim();
    // Soluciones PDF: se emparejan por el número al inicio del nombre
    // (1.solucion.pdf -> tarjeta #1), igual que imágenes y preguntas.
    const pdfsByNumber = new Map();
    // Solo se emparejan PDFs cuando el modo elegido es "Cargar PDF";
    // en modo "Redactar" la solución es el texto escrito (info).
    if (solutionMode === "pdf") {
      stagedPdfs.forEach((file) => {
        const n = getImageNumber(file);
        if (n && !pdfsByNumber.has(n)) pdfsByNumber.set(n, file);
      });
    }
    for (const number of pairs) {
      const file = singleQuestion ? files[0] : images.get(number);
      const imageId = `img-${Date.now().toString(36)}-${number}-${Math.random().toString(36).slice(2, 7)}`;
      await storeImage(imageId, file);
      // PDF de solución de esta tarjeta (1 sola pregunta -> primer PDF del lote).
      const solutionFile = singleQuestion ? (pdfsByNumber.get(1) || stagedPdfs[0]) : pdfsByNumber.get(number);
      let solutionId = "";
      if (solutionFile) {
        solutionId = `pdf-${Date.now().toString(36)}-${number}-${Math.random().toString(36).slice(2, 7)}`;
        await storeImage(solutionId, solutionFile);
      }
      rounds.push({
        id: `r${Date.now().toString(36)}-${number}-${Math.random().toString(36).slice(2, 6)}`,
        question: questions.get(number),
        info: solutionMode === "write" ? infoText : (pairs.length === 1 ? infoText : ""),
        imageId,
        imageName: file.name,
        solutionId,
        solutionName: solutionFile ? solutionFile.name : "",
        action: "1. Panel de Usuario",
        createdAt: Date.now(),
      });
    }
    saveRounds(rounds);
    setStatus(`✓ ${pairs.length} tarjeta${pairs.length === 1 ? " guardada" : "s guardadas"} en el EcoWheel.`, true);
    saveBtn.disabled = false;
    renderList();
    resetForm(); // limpia el formulario + lote unificado (equipo o Drive)
    return pairs.length;
  }

  /* ------------------------------------------------------------------
     Importar desde Google Drive.
     La subida de archivos es UNA SOLA zona (dropzone) arriba; aquí solo
     vive el importador de carpetas públicas/privadas de Drive.
     ------------------------------------------------------------------ */
  const driveLinkInput = document.getElementById("drive-link-input");
  const driveApiKeyInput = document.getElementById("drive-api-key");
  const driveAuthBtn = document.getElementById("drive-auth-btn");
  const driveImportBtn = document.getElementById("drive-import-btn");
  const driveAuthStatus = document.getElementById("drive-auth-status");
  const driveThumbStrip = document.getElementById("drive-thumb-strip");
  const driveStatus = document.getElementById("drive-status");
  const GOOGLE_CLIENT_ID_KEY = "ecowheel-gdrive-client-id";
  let driveAccessToken = null;
  let driveFiles = [];

  try {
    const savedKey = localStorage.getItem("ecowheel-gdrive-apikey") || "";
    if (savedKey) driveApiKeyInput.value = savedKey;
  } catch { /* noop */ }

  function extractDriveFolderId(link) {
    const text = String(link || "").trim();
    const m = text.match(/folders\/([A-Za-z0-9_-]+)/) || text.match(/[?&]id=([A-Za-z0-9_-]+)/);
    if (m) return m[1];
    if (/^[A-Za-z0-9_-]{10,}$/.test(text)) return text;
    return null;
  }

  function refreshDriveUI() {
    if (!driveThumbStrip) return;
    driveThumbStrip.innerHTML = "";
    driveThumbStrip.hidden = driveFiles.length === 0;
    driveFiles.slice(0, 24).forEach((f) => {
      const img = document.createElement("img");
      img.src = `https://drive.google.com/thumbnail?id=${encodeURIComponent(f.id)}&sz=w256`;
      img.alt = f.name || "Imagen de Drive";
      img.decoding = "async";
      driveThumbStrip.appendChild(img);
    });
    if (driveFiles.length > 24) {
      const more = document.createElement("p");
      more.className = "bulk-file-count";
      more.textContent = `… y ${driveFiles.length - 24} más`;
      driveThumbStrip.appendChild(more);
    }
  }
  async function listDriveImages(folderId) {
    const key = driveApiKeyInput.value.trim();
    try { localStorage.setItem("ecowheel-gdrive-apikey", key); } catch { /* noop */ }
    const query = encodeURIComponent(`'${folderId}' in parents and trashed=false and (mimeType contains 'image/')`);
    const fields = encodeURIComponent("nextPageToken,files(id,name,mimeType)");
    let url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=${fields}&pageSize=250&orderBy=name_natural`;
    const headers = {};
    if (driveAccessToken) headers.Authorization = `Bearer ${driveAccessToken}`;
    else if (key) url += `&key=${encodeURIComponent(key)}`;
    else {
      driveStatus.textContent = "Esta carpeta necesita autorización: pulsa «Autorizar con Google» o pega una clave API.";
      return [];
    }
    const out = [];
    let pageToken = "";
    for (let page = 0; page < 4 && out.length < MAX_BULK_ROUNDS; page += 1) {
      const res = await fetch(url + (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""), { headers });
      if (res.status === 401 || res.status === 403) {
        driveStatus.textContent = "Drive denegó el acceso (401/403): autoriza con Google o haz la carpeta pública (Lector).";
        return [];
      }
      if (!res.ok) {
        driveStatus.textContent = `Drive respondió ${res.status}. Revisa el enlace o la clave API.`;
        return [];
      }
      const data = await res.json();
      (data.files || []).forEach((f) => {
        if (out.length < MAX_BULK_ROUNDS && f?.id && f?.name) out.push({ id: f.id, name: f.name, mimeType: f.mimeType || "image/jpeg" });
      });
      pageToken = data.nextPageToken || "";
      if (!pageToken) break;
    }
    return out;
  }

  async function downloadDriveBlob(file) {
    if (driveAccessToken) {
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}?alt=media`, {
        headers: { Authorization: `Bearer ${driveAccessToken}` },
      });
      if (!res.ok) throw new Error(`Drive media ${res.status}`);
      return await res.blob();
    }
    const key = driveApiKeyInput.value.trim();
    const pub = `https://drive.google.com/uc?export=download&id=${encodeURIComponent(file.id)}${key ? `&key=${encodeURIComponent(key)}` : ""}`;
    const res = await fetch(pub);
    if (!res.ok) throw new Error(`Drive uc ${res.status}`);
    return await res.blob();
  }

  function requestDriveAuth() {
    return new Promise((resolve) => {
      driveAuthStatus.textContent = "Solicitando autorización de Google… (solo lectura, si es necesario)";
      let clientId = "";
      try { clientId = localStorage.getItem(GOOGLE_CLIENT_ID_KEY) || ""; } catch { /* noop */ }
      const typed = prompt("Pega tu Google OAuth Client ID (solo para autorizar carpeta privada):", clientId);
      if (!typed) {
        driveAuthStatus.textContent = "Autorización cancelada: puedes usar carpetas públicas sin autorizar.";
        resolve(false);
        return;
      }
      try { localStorage.setItem(GOOGLE_CLIENT_ID_KEY, typed.trim()); } catch { /* noop */ }
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.onload = () => {
        try {
          const client = window.google.accounts.oauth2.initTokenClient({
            client_id: typed.trim(),
            scope: "https://www.googleapis.com/auth/drive.readonly",
            callback: (resp) => {
              if (resp?.access_token) {
                driveAccessToken = resp.access_token;
                driveAuthStatus.textContent = "✓ Autorizado con Google (solo lectura). Ya puedes traer las imágenes.";
                resolve(true);
              } else {
                driveAuthStatus.textContent = "Google no entregó el permiso. Intenta de nuevo.";
                resolve(false);
              }
            },
          });
          client.requestAccessToken({ prompt: "consent" });
        } catch {
          driveAuthStatus.textContent = "No se pudo abrir el permiso de Google. Revisa el Client ID.";
          resolve(false);
        }
      };
      script.onerror = () => {
        driveAuthStatus.textContent = "Sin conexión a accounts.google.com. Usa carpeta pública + API key.";
        resolve(false);
      };
      document.head.appendChild(script);
    });
  }

  driveAuthBtn.addEventListener("click", async () => {
    driveAuthBtn.disabled = true;
    await requestDriveAuth();
    driveAuthBtn.disabled = false;
  });

  async function importFromDrive() {
    const folderId = extractDriveFolderId(driveLinkInput.value);
    if (!folderId) {
      driveStatus.textContent = "Pega un enlace válido de carpeta Drive (…/drive/folders/ABC123) o solo el ID.";
      return;
    }
    driveImportBtn.disabled = true;
    driveStatus.textContent = "Listando imágenes de la carpeta Drive…";
    driveFiles = await listDriveImages(folderId);
    if (!driveFiles.length) {
      driveImportBtn.disabled = false;
      refreshDriveUI();
      return;
    }
    refreshDriveUI();
    const questions = parseBulkQuestions(questionInput.value);
    if (!questions.size) {
      driveStatus.textContent = `Encontré ${driveFiles.length} imágenes en Drive. Pega las preguntas (1. …) arriba y pulsa de nuevo.`;
      driveImportBtn.disabled = false;
      return;
    }
    const byNumber = new Map();
    driveFiles.forEach((f) => {
      const n = getImageNumber(f.name);
      if (n && !byNumber.has(n)) byNumber.set(n, f);
    });
    // Igual que en equipo: 1 sola pregunta sin numeración usa la primera imagen.
    const singleQuestion = questions.size === 1 && questions.has(1) && !driveFiles.some((f) => getImageNumber(f));
    const pairs = singleQuestion ? [1] : [...questions.keys()].filter((n) => byNumber.has(n)).sort((a, b) => a - b).slice(0, MAX_BULK_ROUNDS);
    if (!pairs.length) {
      driveStatus.textContent = "Sin coincidencias: el archivo debe empezar con el número de la pregunta (1.imagenrm.jpg ↔ 1. Pregunta).";
      driveImportBtn.disabled = false;
      return;
    }
    driveStatus.textContent = `Descargando ${pairs.length} imágenes de Drive en máxima resolución…`;
    // Guarda el enlace como predeterminado si el usuario lo pidió:
    // la próxima vez se rellena solo y la conexión es directa (sin alucinaciones).
    const driveSaveCb = document.getElementById("drive-save-link");
    if (driveSaveCb && driveSaveCb.checked) {
      try { localStorage.setItem("ecowheel-drive-link", driveLinkInput.value.trim()); } catch { /* noop */ }
    }
    const rounds = loadRounds();
    let ok = 0;
    for (const number of pairs) {
      const f = singleQuestion ? driveFiles[0] : byNumber.get(number);
      try {
        const blob = await downloadDriveBlob(f);
        const ext = (f.name.split(".").pop() || "jpg").slice(0, 5);
        const file = new File([blob], f.name, { type: blob.type || f.mimeType || "image/jpeg" });
        const imageId = `img-${Date.now().toString(36)}-${number}-${Math.random().toString(36).slice(2, 7)}`;
        await storeImage(imageId, file);
        rounds.push({
          id: `r${Date.now().toString(36)}-${number}-${Math.random().toString(36).slice(2, 6)}`,
          question: questions.get(number),
          info: "",
          imageId,
          imageName: `${number}.${ext}`,
          action: "1. Panel de Usuario",
          createdAt: Date.now(),
        });
        ok += 1;
        driveStatus.textContent = `Descargando ${ok}/${pairs.length}…`;
      } catch { /* continúa con el siguiente par */ }
    }
    saveRounds(rounds);
    renderList();
    driveStatus.textContent = ok
      ? `✓ ${ok} pares desde Drive cargados en el EcoWheel (numeración 1., 2., 3. intacta).`
      : "No se pudo descargar ninguna imagen de Drive. Revisa permisos de la carpeta.";
    driveImportBtn.disabled = false;
  }

  driveImportBtn.addEventListener("click", importFromDrive);

  async function renderList() {
    const rounds = loadRounds();
    listCountEl.textContent = `${rounds.length} item${rounds.length === 1 ? "" : "s"}`;
    listFooterEl.textContent =
      `✓ ${rounds.length} pregunta${rounds.length === 1 ? "" : "s"} activa${rounds.length === 1 ? "" : "s"} en el EcoWheel · Sincronización líquida`;

    listItemsEl.innerHTML = "";
    if (!rounds.length) {
      listItemsEl.innerHTML = `<p class="list-empty">Todavía no hay preguntas guardadas. Completa el formulario y presiona "Guardar en EcoWheel".</p>`;
      return;
    }

    for (const round of rounds) {
      const row = document.createElement("div");
      row.className = "list-item";
      const imgCount = round.imageId ? 1 : (round.images ? round.images.length : (round.image ? 1 : 0));
      const solBadge = round.solutionId ? `<span class="list-item-sol" title="Solución en PDF: ${escapeHtml(round.solutionName || "")}">PDF</span>` : "";
      row.innerHTML = `
        <div class="list-item-thumb" data-thumb>
          <span class="thumb-fallback" aria-hidden="true">?</span>
        </div>
        <div class="list-item-body">
          <div class="list-item-question">${escapeHtml(round.question)}</div>
          <div class="list-item-meta"><span class="dot"></span> Estabilizado · ${imgCount} img ${solBadge}</div>
        </div>
        <div class="list-item-actions">
          <button type="button" data-action="edit" aria-label="Editar" title="Editar">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3Z"/></svg>
          </button>
          <button type="button" data-action="delete" aria-label="Eliminar" title="Eliminar">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
          </button>
        </div>
      `;
      row.querySelector('[data-action="edit"]').addEventListener("click", () => startEdit(round));
      row.querySelector('[data-action="delete"]').addEventListener("click", () => deleteRound(round.id));
      listItemsEl.appendChild(row);

      // Previsualización AUTOMÁTICA: siempre intenta pintar la imagen real.
      // El "?" solo queda si de verdad no hay imagen recuperable.
      const thumbBox = row.querySelector("[data-thumb]");
      try {
        const src = await thumbSrcFor(round);
        if (src && thumbBox.isConnected) {
          thumbBox.innerHTML = "";
          const img = document.createElement("img");
          img.src = src;
          img.alt = "";
          img.decoding = "async";
          img.loading = "lazy";
          img.addEventListener("error", () => {
            thumbBox.innerHTML = `<span class="thumb-fallback" aria-hidden="true">?</span>`;
          });
          thumbBox.appendChild(img);
        }
      } catch { /* se queda el "?" de respaldo */ }
    }
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str || "";
    return div.innerHTML;
  }

  async function startEdit(round) {
    editingId = round.id;
    questionInput.value = round.question || "";
    infoInput.value = round.info || "";
    currentImages = [...(round.images || [])];
    // Si el round vive en IndexedDB (carga masiva / Drive), trae su
    // imagen real al editor para que también se previsualice y no se pierda.
    if (!currentImages.length && (round.imageId || round.image)) {
      try {
        const src = await thumbSrcFor(round);
        if (src) currentImages = [src];
      } catch { /* editor sin imagen previa */ }
    }
    renderThumbs();
    saveBtn.innerHTML = `<svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16"><path fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" d="M5 12.5l4.5 4.5L19 7"/></svg>Actualizar en EcoWheel`;
    cancelEditBtn.hidden = false;
    questionInput.focus();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() {
    editingId = null;
    form.reset();
    currentImages = [];
    stagedFiles = [];
    stagedUrls.forEach((url) => { try { URL.revokeObjectURL(url); } catch { /* noop */ } });
    stagedUrls.clear();
    stagedPdfs = [];
    try { fileInput.value = ""; } catch { /* noop */ }
    renderThumbs();
    saveBtn.innerHTML = `<svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16"><path fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" d="M5 12.5l4.5 4.5L19 7"/></svg>Guardar en EcoWheel`;
    cancelEditBtn.hidden = true;
  }

  async function deleteRound(id) {
    const rounds = loadRounds();
    const target = rounds.find((r) => r.id === id);
    const rest = rounds.filter((r) => r.id !== id);
    // Limpieza total: borra también el blob en IndexedDB y revoca su URL
    // para no dejar basura huérfana que ocupe espacio.
    if (target?.imageId) {
      forgetThumbUrl(target.imageId);
      await deleteImageBlob(target.imageId);
    }
    if (target?.solutionId) {
      await deleteImageBlob(target.solutionId);
    }
    saveRounds(rest);
    renderList();
    if (editingId === id) resetForm();
  }

  cancelEditBtn.addEventListener("click", resetForm);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const question = questionInput.value.trim();
    if (!question) { questionInput.focus(); return; }

    // --- Modo edición: actualiza SOLO la tarjeta en curso ---
    if (editingId) {
      const rounds = loadRounds();
      const idx = rounds.findIndex((r) => r.id === editingId);
      if (idx === -1) return;
      const patch = { question, info: infoInput.value.trim() };
      // Si durante la edición se subió un PDF nuevo, reemplaza la solución
      // de la tarjeta (blob nuevo en IndexedDB y limpieza del anterior).
      if (stagedPdfs[0]) {
        const prevSolId = rounds[idx].solutionId;
        const pdfFile = stagedPdfs[0];
        const solutionId = `pdf-${Date.now().toString(36)}-edit-${Math.random().toString(36).slice(2, 7)}`;
        await storeImage(solutionId, pdfFile);
        if (prevSolId) void deleteImageBlob(prevSolId);
        patch.solutionId = solutionId;
        patch.solutionName = pdfFile.name;
      }
      // Si durante la edición se subió una imagen nueva, reemplaza la imagen
      // de la tarjeta (blob nuevo en IndexedDB y limpieza del antiguo).
      if (stagedFiles[0]) {
        const prevId = rounds[idx].imageId;
        const file = stagedFiles[0];
        const imageId = "img-" + Date.now().toString(36) + "-edit-" + Math.random().toString(36).slice(2, 7);
        await storeImage(imageId, file);
        if (prevId) { forgetThumbUrl(prevId); void deleteImageBlob(prevId); }
        patch.imageId = imageId;
        patch.imageName = file.name;
        patch.images = undefined;
      }
      rounds[idx] = { ...rounds[idx], ...patch };
      if (patch.images === undefined) delete rounds[idx].images;
      saveRounds(rounds);
      renderList();
      resetForm();
      return;
    }

    // --- Modo crear: UNA SOLA zona que funciona igual que antes.
    // 1 pregunta -> 1 tarjeta con la primera imagen.
    // Lista "1. … 2. …" -> N tarjetas emparejadas por número de imagen. ---
    void importBulk();
  });

  /* ---------------- Modo de solución: Redactar (texto) vs PDF ---------------- */
  const solutionModeEl = document.getElementById("solution-mode");
  const blockWrite = document.getElementById("block-write");
  const blockPdf = document.getElementById("block-pdf");
  let solutionMode = "pdf";
  function applySolutionMode(mode) {
    solutionMode = mode === "write" ? "write" : "pdf";
    solutionModeEl?.querySelectorAll(".seg-btn").forEach((b) => b.classList.toggle("is-active", b.dataset.mode === solutionMode));
    if (blockWrite) blockWrite.hidden = solutionMode !== "write";
    if (blockPdf) blockPdf.hidden = solutionMode !== "pdf";
  }
  solutionModeEl?.addEventListener("click", (e) => {
    const btn = e.target.closest(".seg-btn");
    if (btn) applySolutionMode(btn.dataset.mode);
  });
  applySolutionMode("pdf");

  /* ---------------- Reinicio total (botón flecha, esquina superior) ---------------- */
  const resetAllBtn = document.getElementById("reset-all-btn");
  resetAllBtn?.addEventListener("click", async () => {
    const ok = window.confirm(
      "¿Reiniciar TODO el EcoWheel?\n\n" +
      "Se borrará: preguntas, imágenes, soluciones (PDF), el enlace de Drive guardado, " +
      "el contador de visitas y el mazo anti-repetición.\n\n" +
      "Después podrás volver a cargar contenido y enlazar Drive desde cero."
    );
    if (!ok) return;
    ["ecowheel-rounds", "ecowheel-pool", "ecowheel-drive-link", "ecowheel-gdrive-client-id", "ecowheel-visits"]
      .forEach((k) => { try { localStorage.removeItem(k); } catch { /* noop */ } });
    // Limpieza total de blobs (imágenes + PDFs) en IndexedDB.
    try {
      const db = await openImageDb();
      await new Promise((res, rej) => {
        const tx = db.transaction(IMAGE_STORE_NAME, "readwrite");
        tx.objectStore(IMAGE_STORE_NAME).clear();
        tx.oncomplete = res;
        tx.onerror = () => rej(tx.error);
      });
      db.close();
    } catch { /* noop */ }
    thumbUrlCache.forEach((url) => { try { URL.revokeObjectURL(url); } catch { /* noop */ } });
    thumbUrlCache.clear();
    resetForm();
    renderList();
    if (driveLinkInput) driveLinkInput.value = "";
    const driveSaveCb = document.getElementById("drive-save-link");
    if (driveSaveCb) driveSaveCb.checked = true;
    setStatus("♻️ EcoWheel reiniciado. Pega tu enlace de Drive y vuelve a guardar el contenido.", true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  /* ---------------- init ---------------- */
  // Enlace de Drive predeterminado: se rellena solo si se guardó antes.
  try {
    const savedDriveLink = localStorage.getItem("ecowheel-drive-link");
    if (savedDriveLink && driveLinkInput && !driveLinkInput.value) driveLinkInput.value = savedDriveLink;
  } catch { /* noop */ }
  // Píldora de visitas (cuenta los giros/visitas del wheel).
  const visitsPill = document.getElementById("visits-pill");
  if (visitsPill) {
    const v = parseInt(localStorage.getItem("ecowheel-visits") || "0", 10) || 0;
    visitsPill.hidden = false;
    visitsPill.innerHTML = `<span class="dot" aria-hidden="true"></span>${v} visita${v === 1 ? "" : "s"} al wheel registradas en este equipo`;
  }
  // URL LAN real para presentar en proyector/TV/PC de la misma red.
  const lanUrlInput = document.getElementById("share-lan-url");
  if (lanUrlInput && location.protocol.startsWith("http") && location.hostname && location.hostname !== "localhost") {
    lanUrlInput.value = `${location.protocol}//${location.hostname}${location.port ? ":" + location.port : ""}`;
  }

  renderList();

  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEY) {
      renderList();
    }
  });
})();
