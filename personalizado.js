const Store = window.MiniForgeStore;

const quoteForm = document.querySelector("#quote-form");
const quoteFormStatus = document.querySelector("#quote-form-status");
const referencesInput = document.querySelector("#quote-references");
const previewList = document.querySelector("#reference-preview-list");
const uploadProgress = document.querySelector("#quote-upload-progress");
const uploadProgressBar = document.querySelector("#quote-upload-progress-bar");
const uploadProgressLabel = document.querySelector("#quote-upload-progress-label");

const MAX_FILES = 5;
const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

let previewUrls = [];

function setFormStatus(message, type = "success") {
  if (!quoteFormStatus) return;
  quoteFormStatus.textContent = message;
  quoteFormStatus.classList.toggle("is-error", type === "error");
}

function setUploadProgress(percent, label) {
  if (!uploadProgress || !uploadProgressBar) return;
  if (percent <= 0) {
    uploadProgress.hidden = true;
    uploadProgressBar.style.width = "0%";
    uploadProgressBar.setAttribute("aria-valuenow", "0");
    if (uploadProgressLabel) uploadProgressLabel.textContent = "";
    return;
  }
  uploadProgress.hidden = false;
  uploadProgressBar.style.width = `${Math.min(100, percent)}%`;
  uploadProgressBar.setAttribute("aria-valuenow", String(Math.min(100, percent)));
  if (uploadProgressLabel) uploadProgressLabel.textContent = label ?? "";
}

function revokePreviewUrls() {
  for (const url of previewUrls) URL.revokeObjectURL(url);
  previewUrls = [];
}

function renderReferencePreviews(files) {
  if (!previewList) return;
  revokePreviewUrls();
  previewList.innerHTML = "";

  Array.from(files).forEach((file, index) => {
    const url = URL.createObjectURL(file);
    previewUrls.push(url);
    const li = document.createElement("li");
    li.className = "reference-preview-item";
    li.innerHTML = `
      <img src="${url}" alt="" width="72" height="72" />
      <span>${Store.escapeHtml(file.name)}</span>
      <button type="button" class="btn-text" data-remove-index="${index}" aria-label="Remover ${Store.escapeHtml(file.name)}">Remover</button>
    `;
    previewList.appendChild(li);
  });
}

function validateReferenceFiles(fileList) {
  const files = Array.from(fileList);
  if (!files.length) return { ok: true, files: [] };
  if (files.length > MAX_FILES) {
    return { ok: false, error: `Envie no máximo ${MAX_FILES} fotos.` };
  }
  for (const file of files) {
    const mime = file.type || "image/jpeg";
    if (!ALLOWED_TYPES.has(mime)) {
      return { ok: false, error: `Formato não permitido: ${file.name}. Use JPG, PNG ou WebP.` };
    }
    if (file.size > MAX_BYTES) {
      return { ok: false, error: `${file.name} excede 8 MB.` };
    }
  }
  return { ok: true, files };
}

function removeFileAtIndex(index) {
  if (!referencesInput?.files) return;
  const dt = new DataTransfer();
  Array.from(referencesInput.files).forEach((file, i) => {
    if (i !== index) dt.items.add(file);
  });
  referencesInput.files = dt.files;
  renderReferencePreviews(referencesInput.files);
}

referencesInput?.addEventListener("change", () => {
  const check = validateReferenceFiles(referencesInput.files);
  if (!check.ok) {
    setFormStatus(check.error, "error");
    referencesInput.value = "";
    renderReferencePreviews([]);
    return;
  }
  setFormStatus("", "success");
  renderReferencePreviews(referencesInput.files);
});

previewList?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-remove-index]");
  if (!button) return;
  removeFileAtIndex(Number(button.dataset.removeIndex));
});

quoteForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(quoteForm);
  if (formData.get("company")) return;

  if (formData.get("consent") !== "on") {
    setFormStatus("Aceite a política de privacidade para continuar.", "error");
    return;
  }

  const fileCheck = validateReferenceFiles(referencesInput?.files ?? []);
  if (!fileCheck.ok) {
    setFormStatus(fileCheck.error, "error");
    return;
  }

  const submitButton = quoteForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  submitButton.textContent = "Registrando...";
  setFormStatus("Registrando seu pedido...");

  let orderCode = null;
  let uploadedCount = 0;

  try {
    const order = await Store.createOrder({
      type: "quote",
      consent: true,
      customer: {
        name: formData.get("name"),
        phone: formData.get("phone"),
        email: formData.get("email"),
      },
      item: {
        category: formData.get("category"),
        size: formData.get("size"),
        description: formData.get("description"),
      },
    });
    orderCode = order.public_code;

    if (fileCheck.files.length > 0) {
      setFormStatus(`Pedido ${orderCode} criado. Enviando fotos...`);
      setUploadProgress(15, `Enviando 0 de ${fileCheck.files.length} foto(s)...`);
      const upload = await Store.uploadQuoteReferences(orderCode, fileCheck.files);
      uploadedCount = upload.uploaded_count ?? fileCheck.files.length;
      setUploadProgress(100, `${uploadedCount} foto(s) recebida(s) com sucesso.`);
    }

    Store.rememberCustomerOrder({
      public_code: orderCode,
      type: "quote",
      label: "Orçamento personalizado",
    });
    Store.trackEvent("quote_request", { order_code: orderCode, references: uploadedCount });
    const message = [
      "Olá! Quero fazer um orçamento personalizado na MiniForge 3D.",
      `Pedido: ${orderCode}`,
      `Nome: ${formData.get("name")}`,
      `WhatsApp: ${formData.get("phone")}`,
      formData.get("email") ? `E-mail: ${formData.get("email")}` : null,
      `Tipo: ${formData.get("category")}`,
      `Tamanho: ${formData.get("size")}`,
      `Ideia: ${formData.get("description")}`,
      uploadedCount > 0 ? `Enviei ${uploadedCount} foto(s) de referência pelo site.` : null,
    ]
      .filter(Boolean)
      .join("\n");
    Store.redirectToOrderSuccess({
      code: orderCode,
      type: "quote",
      photos: uploadedCount,
      customerName: formData.get("name"),
      whatsappMessage: message,
    });
    return;
  } catch (error) {
    setUploadProgress(0, "");
    setFormStatus(error.message || "Continue pelo WhatsApp.", "error");
    submitButton.disabled = false;
    submitButton.textContent = "Solicitar orçamento";
  }
});

Store.setPageMeta({
  title: "Personalizado | MiniForge 3D",
  description:
    "Orçamento de peças personalizadas em impressão 3D. Envie fotos de referência para bustos, figures e miniaturas.",
  path: "/personalizado.html",
});

Store.setSocialMeta({
  title: "Personalizado | MiniForge 3D",
  description: "Peça sob medida em impressão 3D com envio de fotos de referência.",
  path: "/personalizado.html",
});
