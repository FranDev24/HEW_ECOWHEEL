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

  const questionInput = document.getElementById("question-input");
  const infoInput = document.getElementById("info-input");
  const dropzone = document.getElementById("dropzone");
  const fileInput = document.getElementById("file-input");
  const thumbStrip = document.getElementById("thumb-strip");
  const form = document.getElementById("round-form");
  const saveBtn = document.getElementById("save-btn");
  const cancelEditBtn = document.getElementById("cancel-edit-btn");

  const previewThumb = document.getElementById("preview-thumb");
  const previewPlaceholder = document.getElementById("preview-placeholder");
  const previewQuestion = document.getElementById("preview-question");
  const previewLearn = document.getElementById("preview-learn");
  const previewLearnInfo = document.getElementById("preview-learn-info");

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
    updatePreview();
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
        updatePreview();
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

  /* ---------------- vista previa en vivo ---------------- */
  function updatePreview() {
    const q = questionInput.value.trim();
    previewQuestion.textContent = q || "¿Qué es un spin?";

    if (currentImages[0]) {
      previewThumb.src = currentImages[0];
      previewThumb.hidden = false;
      previewPlaceholder.hidden = true;
    } else {
      previewThumb.hidden = true;
      previewPlaceholder.hidden = false;
    }

    previewLearn.hidden = false;
    previewLearnInfo.hidden = true;
  }

  previewLearn.addEventListener("click", () => {
    const info = infoInput.value.trim();
    previewLearnInfo.textContent = info || "Aún no agregaste una respuesta / info adicional.";
    previewLearnInfo.hidden = !previewLearnInfo.hidden;
  });

  [questionInput, infoInput].forEach((el) => el.addEventListener("input", updatePreview));

  /* ---------------- lista de contenido ---------------- */
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
          <div class="list-item-meta"><span class="dot"></span> Estabilizado · ${round.images ? round.images.length : 0} img</div>
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
    updatePreview();
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
    updatePreview();
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
  updatePreview();
  renderList();
})();
