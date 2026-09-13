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

  const STORAGE_KEY = "ecowheel-rounds";
  const MAX_IMAGES = 8;
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
  const bulkQuestionsInput = document.getElementById("bulk-questions");
  const bulkDropzone = document.getElementById("bulk-dropzone");
  const bulkFileInput = document.getElementById("bulk-file-input");
  const bulkFileCount = document.getElementById("bulk-file-count");
  const bulkThumbStrip = document.getElementById("bulk-thumb-strip");
  const bulkImportBtn = document.getElementById("bulk-import-btn");
  const bulkStatus = document.getElementById("bulk-status");

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

  /* ---------------- subida de imágenes ---------------- */
  function fileToDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function handleFiles(fileList) {
    const files = Array.from(fileList).slice(0, MAX_IMAGES - currentImages.length);
    for (const file of files) {
      if (!file.type.startsWith("image/")) continue;
      try {
        const dataUrl = await fileToDataURL(file);
        currentImages.push(dataUrl);
      } catch (e) { /* ignorar archivo fallido */ }
    }
    renderThumbs();
  }

  function renderThumbs() {
    thumbStrip.innerHTML = "";
    thumbStrip.hidden = currentImages.length === 0;
    currentImages.forEach((src, i) => {
      const item = document.createElement("div");
      item.className = "thumb-item";
      item.innerHTML = `<img src="${src}" alt="Imagen ${i + 1}" />
        <button type="button" class="thumb-remove" aria-label="Quitar imagen">×</button>`;
      item.querySelector(".thumb-remove").addEventListener("click", () => {
        currentImages.splice(i, 1);
        renderThumbs();
      });
      thumbStrip.appendChild(item);
    });
  }

  dropzone.addEventListener("click", () => fileInput.click());
  dropzone.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInput.click(); }
  });
  fileInput.addEventListener("change", (e) => handleFiles(e.target.files));

  ["dragenter", "dragover"].forEach((evt) =>
    dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.add("dragover"); })
  );
  ["dragleave", "drop"].forEach((evt) =>
    dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.remove("dragover"); })
  );
  dropzone.addEventListener("drop", (e) => {
    if (e.dataTransfer?.files?.length) handleFiles(e.dataTransfer.files);
  });

  /* ---------------- carga masiva: numeración intacta ---------------- */
  function parseBulkQuestions(text) {
    const questions = new Map();
    text.split(/\r?\n/).forEach((line) => {
      const match = line.match(/^\s*(\d+)\s*[.)\-:]\s*(.+?)\s*$/);
      if (match && match[2]) questions.set(Number(match[1]), match[2]);
    });
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
    const questions = parseBulkQuestions(bulkQuestionsInput.value);
    const files = Array.from(bulkFileInput.files || []).filter((file) => file.type.startsWith("image/"));
    if (!questions.size || !files.length) {
      bulkStatus.textContent = "Agrega preguntas numeradas e imágenes numeradas para continuar.";
      return;
    }

    const images = new Map();
    files.slice(0, MAX_BULK_ROUNDS).forEach((file) => {
      const number = getImageNumber(file);
      if (number && !images.has(number)) images.set(number, file);
    });
    const pairs = [...questions.keys()]
      .filter((number) => images.has(number))
      .sort((a, b) => a - b)
      .slice(0, MAX_BULK_ROUNDS);
    if (!pairs.length) {
      bulkStatus.textContent = "No hay coincidencias: revisa que el número del archivo y la pregunta sea igual.";
      return;
    }

    bulkImportBtn.disabled = true;
    bulkStatus.textContent = `Preparando ${pairs.length} pares numerados…`;
    const rounds = loadRounds();
    for (const number of pairs) {
      const file = images.get(number);
      const imageId = `img-${Date.now().toString(36)}-${number}-${Math.random().toString(36).slice(2, 7)}`;
      await storeImage(imageId, file);
      rounds.push({
        id: `r${Date.now().toString(36)}-${number}-${Math.random().toString(36).slice(2, 6)}`,
        question: questions.get(number),
        info: "",
        imageId,
        imageName: file.name,
        action: "1. Panel de Usuario",
        createdAt: Date.now(),
      });
    }
    saveRounds(rounds);
    bulkStatus.textContent = `✓ ${pairs.length} pares cargados. Los números mantienen cada imagen junto a su pregunta.`;
    bulkImportBtn.disabled = false;
    renderList();
    const firstFile = images.get(pairs[0]);
    currentImages = [await fileToDataURL(firstFile)];
    questionInput.value = questions.get(pairs[0]);
    renderThumbs();
  }

  /* ---------------- carga masiva: dropzone + memoria acumulativa ---------------- */
  // NOTA: no tocamos parseBulkQuestions / getImageNumber / importBulk.
  // Solo añadimos una capa de UX (dropzone + buffer) que alimenta a bulkFileInput.files.
  let bulkFiles = []; // buffer acumulativo: clic + varios drops se suman hasta 250

  function refreshBulkUI() {
    const count = bulkFiles.length;
    bulkFileCount.hidden = count === 0;
    if (count > 0) {
      bulkFileCount.textContent = `✓ ${count} imagen${count === 1 ? "" : "es"} lista${count === 1 ? "" : "s"} para emparejar`;
    }
    bulkThumbStrip.innerHTML = "";
    bulkThumbStrip.hidden = count === 0;
    // Vista previa liviana: solo las primeras 24 para no saturar el DOM con 250 imgs
    bulkFiles.slice(0, 24).forEach((file, i) => {
      const url = URL.createObjectURL(file);
      const img = document.createElement("img");
      img.src = url;
      img.alt = file.name || `Imagen ${i + 1}`;
      img.decoding = "async";
      // Alta resolución: el navegador conserva el bitmap original; contain evita recorte
      img.onload = () => URL.revokeObjectURL(url);
      bulkThumbStrip.appendChild(img);
    });
    if (count > 24) {
      const more = document.createElement("p");
      more.className = "bulk-file-count";
      more.textContent = `… y ${count - 24} más`;
      bulkThumbStrip.appendChild(more);
    }
  }

  function addBulkFiles(fileList) {
    const incoming = Array.from(fileList || []).filter((f) => f.type.startsWith("image/"));
    if (!incoming.length) return;
    // Acumula sin duplicar por (nombre + tamaño) y respeta el tope de 250
    const seen = new Set(bulkFiles.map((f) => `${f.name}::${f.size}`));
    for (const file of incoming) {
      const key = `${file.name}::${file.size}`;
      if (seen.has(key)) continue;
      if (bulkFiles.length >= MAX_BULK_ROUNDS) break;
      seen.add(key);
      bulkFiles.push(file);
    }
    // Sincroniza el <input> real para que importBulk() siga leyendo bulkFileInput.files sin cambios
    const dt = new DataTransfer();
    bulkFiles.forEach((f) => dt.items.add(f));
    bulkFileInput.files = dt.files;
    refreshBulkUI();
  }

  bulkDropzone.addEventListener("click", () => bulkFileInput.click());
  bulkDropzone.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); bulkFileInput.click(); }
  });
  bulkFileInput.addEventListener("change", (e) => {
    addBulkFiles(e.target.files);
    bulkFileInput.value = ""; // permite re-elegir el mismo archivo si se desea
    const dt = new DataTransfer();
    bulkFiles.forEach((f) => dt.items.add(f));
    bulkFileInput.files = dt.files;
  });

  ["dragenter", "dragover"].forEach((evt) =>
    bulkDropzone.addEventListener(evt, (e) => { e.preventDefault(); bulkDropzone.classList.add("dragover"); })
  );
  ["dragleave", "drop"].forEach((evt) =>
    bulkDropzone.addEventListener(evt, (e) => { e.preventDefault(); bulkDropzone.classList.remove("dragover"); })
  );
  bulkDropzone.addEventListener("drop", (e) => {
    if (e.dataTransfer?.files?.length) addBulkFiles(e.dataTransfer.files);
  });

  bulkImportBtn.addEventListener("click", async () => {
    await importBulk();
    // Limpia el buffer solo si el lote se cargó con éxito (el status empieza con ✓)
    if (bulkStatus.textContent.startsWith("✓")) {
      bulkFiles = [];
      const dt = new DataTransfer();
      bulkFileInput.files = dt.files;
      refreshBulkUI();
    }
  });

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
    const questions = parseBulkQuestions(bulkQuestionsInput.value);
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
    const pairs = [...questions.keys()].filter((n) => byNumber.has(n)).sort((a, b) => a - b).slice(0, MAX_BULK_ROUNDS);
    if (!pairs.length) {
      driveStatus.textContent = "Sin coincidencias: el archivo debe empezar con el número de la pregunta (1.imagenrm.jpg ↔ 1. Pregunta).";
      driveImportBtn.disabled = false;
      return;
    }
    driveStatus.textContent = `Descargando ${pairs.length} imágenes de Drive en máxima resolución…`;
    const rounds = loadRounds();
    let ok = 0;
    for (const number of pairs) {
      const f = byNumber.get(number);
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

  function renderList() {
    const rounds = loadRounds();
    listCountEl.textContent = `${rounds.length} item${rounds.length === 1 ? "" : "s"}`;
    listFooterEl.textContent =
      `✓ ${rounds.length} pregunta${rounds.length === 1 ? "" : "s"} activa${rounds.length === 1 ? "" : "s"} en el EcoWheel · Sincronización líquida`;

    listItemsEl.innerHTML = "";
    if (!rounds.length) {
      listItemsEl.innerHTML = `<p class="list-empty">Todavía no hay preguntas guardadas. Completa el formulario y presiona "Guardar en EcoWheel".</p>`;
      return;
    }

    rounds.forEach((round) => {
      const row = document.createElement("div");
      row.className = "list-item";
      row.innerHTML = `
        <div class="list-item-thumb">
          ${round.images && round.images[0] ? `<img src="${round.images[0]}" alt="" />` : "?"}
        </div>
        <div class="list-item-body">
          <div class="list-item-question">${escapeHtml(round.question)}</div>
          <div class="list-item-meta"><span class="dot"></span> Estabilizado · ${round.imageId ? "1 img" : `${round.images ? round.images.length : 0} img`}</div>
        </div>
        <div class="list-item-actions">
          <button type="button" data-action="edit" aria-label="Editar" title="Editar">
            <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M4 20h4L18.4 9.6a1 1 0 0 0 0-1.4l-2.6-2.6a1 1 0 0 0-1.4 0L4 15.5V20Z"/></svg>
          </button>
          <button type="button" data-action="delete" aria-label="Eliminar" title="Eliminar">
            <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M6 7h12l-1 14H7L6 7Zm3-4h6l1 2H8l1-2Z"/></svg>
          </button>
        </div>
      `;
      row.querySelector('[data-action="edit"]').addEventListener("click", () => startEdit(round));
      row.querySelector('[data-action="delete"]').addEventListener("click", () => deleteRound(round.id));
      listItemsEl.appendChild(row);
    });
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str || "";
    return div.innerHTML;
  }

  function startEdit(round) {
    editingId = round.id;
    questionInput.value = round.question || "";
    infoInput.value = round.info || "";
    currentImages = [...(round.images || [])];
    renderThumbs();
    saveBtn.innerHTML = `<span aria-hidden="true">✨</span> Actualizar en EcoWheel`;
    cancelEditBtn.hidden = false;
    questionInput.focus();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() {
    editingId = null;
    form.reset();
    currentImages = [];
    renderThumbs();
    saveBtn.innerHTML = `<span aria-hidden="true">✨</span> Guardar en EcoWheel`;
    cancelEditBtn.hidden = true;
  }

  function deleteRound(id) {
    const rounds = loadRounds().filter((r) => r.id !== id);
    saveRounds(rounds);
    renderList();
    if (editingId === id) resetForm();
  }

  cancelEditBtn.addEventListener("click", resetForm);

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const question = questionInput.value.trim();
    if (!question) { questionInput.focus(); return; }
    if (!currentImages.length) { dropzone.focus(); return; }

    const rounds = loadRounds();

    if (editingId) {
      const idx = rounds.findIndex((r) => r.id === editingId);
      if (idx !== -1) {
        rounds[idx] = { ...rounds[idx], question, info: infoInput.value.trim(), images: currentImages };
      }
    } else {
      rounds.push({
        id: "r" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        question,
        info: infoInput.value.trim(),
        images: currentImages,
        action: "1. Panel de Usuario",
        createdAt: Date.now(),
      });
    }

    saveRounds(rounds);
    renderList();
    resetForm();
  });

  /* ---------------- init ---------------- */
  renderList();

  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEY) {
      renderList();
    }
  });
})();
