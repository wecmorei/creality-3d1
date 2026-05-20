const supabaseConfig = {
  url: "https://fmlqsivgffzjryilnjcj.supabase.co",
  publishableKey: "sb_publishable_BRjLzisbkSCzarxEWpZG7w_JI5y9GwM",
};

const statusLabels = {
  quote_requested: "Orçamento solicitado",
  quoted: "Orçamento enviado",
  awaiting_payment: "Aguardando pagamento",
  paid: "Pagamento confirmado",
  in_production: "Em produção",
  ready: "Pronto",
  shipped: "Enviado",
  completed: "Concluído",
  cancelled: "Cancelado",
};

const paymentStatusLabels = {
  pending: "Aguardando pagamento",
  authorized: "Autorizado",
  paid: "Pago",
  failed: "Falhou",
  refunded: "Reembolsado",
  cancelled: "Cancelado",
};

const loginSection = document.querySelector("#admin-login");
const loginForm = document.querySelector("#admin-login-form");
const loginStatus = document.querySelector("#admin-login-status");
const adminPanel = document.querySelector("#admin-panel");
const dashboardContainer = document.querySelector("#admin-dashboard");
const ordersContainer = document.querySelector("#admin-orders");
const customersContainer = document.querySelector("#admin-customers");
const orderFiltersForm = document.querySelector("#admin-order-filters");
const clearOrderFiltersButton = document.querySelector("#clear-order-filters");
const exportCsvButton = document.querySelector("#export-orders-csv");
const paginationBox = document.querySelector("#admin-pagination");
const paginationMeta = document.querySelector("#admin-pagination-meta");
const prevPageButton = document.querySelector("#admin-prev-page");
const nextPageButton = document.querySelector("#admin-next-page");
const productsContainer = document.querySelector("#admin-products");
const productForm = document.querySelector("#admin-product-form");
const productStatus = document.querySelector("#admin-product-status");
const resetProductFormButton = document.querySelector("#reset-product-form");
const refreshButton = document.querySelector("#refresh-orders");
const logoutButton = document.querySelector("#logout-admin");
const adminTabs = document.querySelectorAll("[data-admin-tab]");

let catalogCategories = [];
let catalogProducts = [];
let cachedOrders = [];
let orderFilters = { status: "", q: "", com_fotos: false };
let orderPage = { offset: 0, limit: 25, total: 0, has_more: false };

const MAX_IMAGE_WIDTH = 1400;
const JPEG_QUALITY = 0.85;

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };

    return entities[character];
  });
}

function getSession() {
  const rawSession = window.localStorage.getItem("miniforge_admin_session");
  return rawSession ? JSON.parse(rawSession) : null;
}

function setSession(session) {
  window.localStorage.setItem("miniforge_admin_session", JSON.stringify(session));
}

function clearSession() {
  window.localStorage.removeItem("miniforge_admin_session");
}

async function signIn(email, password) {
  const response = await fetch(`${supabaseConfig.url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: supabaseConfig.publishableKey,
    },
    body: JSON.stringify({ email, password }),
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.error_description ?? data.msg ?? data.message ?? data.error ?? "Não foi possível entrar.",
    );
  }

  return data;
}

async function adminRequest(path, options = {}, query = {}) {
  const session = getSession();

  if (!session?.access_token) {
    throw new Error("Sessão expirada.");
  }

  const endpoint = new URL(`${supabaseConfig.url}/functions/v1/${path}`);
  Object.entries(query).forEach(([key, value]) => {
    if (value) endpoint.searchParams.set(key, value);
  });

  const response = await fetch(endpoint.toString(), {
    ...options,
    headers: {
      "Content-Type": "application/json",
      apikey: supabaseConfig.publishableKey,
      Authorization: `Bearer ${session.access_token}`,
      ...options.headers,
    },
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error ?? "A solicitação falhou.");
  }

  return data;
}

function slugify(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function showPanel() {
  loginSection.hidden = true;
  adminPanel.hidden = false;
}

function showLogin(message = "") {
  loginSection.hidden = false;
  adminPanel.hidden = true;
  loginStatus.textContent = message;
}

function renderDashboard(orders) {
  if (!dashboardContainer) return;

  if (!orders.length) {
    dashboardContainer.innerHTML = '<p class="loading-message">Nenhum pedido para exibir no resumo.</p>';
    return;
  }

  const counts = orders.reduce((acc, order) => {
    acc[order.status] = (acc[order.status] ?? 0) + 1;
    return acc;
  }, {});

  const total = orders.length;
  const awaiting = (counts.awaiting_payment ?? 0) + (counts.quote_requested ?? 0);
  const production = (counts.in_production ?? 0) + (counts.paid ?? 0);
  const done = (counts.completed ?? 0) + (counts.shipped ?? 0) + (counts.ready ?? 0);
  const quotesWithPhotos = orders.filter((order) => (order.order_attachments ?? []).length > 0).length;

  dashboardContainer.innerHTML = `
    <div class="admin-stats-grid">
      <article class="admin-stat-card">
        <p class="eyebrow">Total</p>
        <strong>${total}</strong>
        <span>pedidos registrados</span>
      </article>
      <article class="admin-stat-card">
        <p class="eyebrow">Aguardando</p>
        <strong>${awaiting}</strong>
        <span>orçamento ou pagamento</span>
      </article>
      <article class="admin-stat-card">
        <p class="eyebrow">Produção</p>
        <strong>${production}</strong>
        <span>pagos ou em produção</span>
      </article>
      <article class="admin-stat-card">
        <p class="eyebrow">Concluídos</p>
        <strong>${done}</strong>
        <span>prontos, enviados ou finalizados</span>
      </article>
    </div>
    ${
      quotesWithPhotos
        ? `<p class="admin-dashboard-actions">
            <button type="button" class="button button-primary" id="admin-quick-quotes-photos">
              Ver orçamentos com foto (${quotesWithPhotos})
            </button>
          </p>`
        : ""
    }
    <div class="admin-status-breakdown">
      <h3>Por status</h3>
      <ul>
        ${Object.entries(statusLabels)
          .map(([status, label]) => {
            const count = counts[status] ?? 0;
            if (!count) return "";
            return `<li><span>${escapeHtml(label)}</span><strong>${count}</strong></li>`;
          })
          .filter(Boolean)
          .join("")}
      </ul>
    </div>
  `;
}

function productHasImage(product) {
  const images = product?.product_images;
  return Array.isArray(images) && images.length > 0;
}

async function compressImageFile(file) {
  if (!(file instanceof File) || file.size === 0) return "";

  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });

  const scale = image.width > MAX_IMAGE_WIDTH ? MAX_IMAGE_WIDTH / image.width : 1;
  const width = Math.round(image.width * scale);
  const height = Math.round(image.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(image, 0, 0, width, height);

  const mime = file.type === "image/png" ? "image/png" : "image/jpeg";
  return canvas.toDataURL(mime, JPEG_QUALITY);
}

function formatMoney(cents) {
  if (!cents || cents <= 0) return "Sob orçamento";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return "";
  }
}

function buildWhatsappLink(phone, message) {
  const digits = String(phone ?? "").replace(/\D/g, "");
  if (!digits) return "#";
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

function renderOrderEvents(events) {
  if (!Array.isArray(events) || !events.length) {
    return '<p class="admin-hint">Sem eventos registrados.</p>';
  }

  return `<ul class="admin-events-list">${events
    .map((event) => {
      const when = formatDate(event.created_at);
      const msg = event.message ? `: ${escapeHtml(event.message)}` : "";
      return `<li><time>${escapeHtml(when)}</time> — ${escapeHtml(statusLabels[event.status] ?? event.status)}${msg}</li>`;
    })
    .join("")}</ul>`;
}

function renderOrderAttachments(attachments) {
  if (!Array.isArray(attachments) || !attachments.length) {
    return "";
  }

  const thumbs = attachments
    .map((file) => {
      const href = file.signed_url ? escapeHtml(file.signed_url) : "#";
      const label = escapeHtml(file.file_name ?? "Referência");
      return `<a class="admin-ref-thumb" href="${href}" target="_blank" rel="noopener noreferrer" title="${label}">
        <img src="${href}" alt="${label}" loading="lazy" width="96" height="96" />
        <span>${label}</span>
      </a>`;
    })
    .join("");

  return `
    <div class="admin-order-refs">
      <p><strong>Fotos de referência (${attachments.length}):</strong></p>
      <div class="admin-ref-grid">${thumbs}</div>
    </div>
  `;
}

function filterOrdersForDisplay(orders) {
  if (!orderFilters.com_fotos) return orders;
  return orders.filter((order) => (order.order_attachments ?? []).length > 0);
}

function renderOrders(orders) {
  const visible = filterOrdersForDisplay(orders);
  if (!visible.length) {
    ordersContainer.innerHTML = '<p class="loading-message">Nenhum pedido encontrado com os filtros atuais.</p>';
    return;
  }

  ordersContainer.innerHTML = visible
    .map((order) => {
      const customer = order.customers ?? {};
      const items = order.order_items ?? [];
      const events = order.order_events ?? [];
      const attachments = order.order_attachments ?? [];
      const refsHtml = renderOrderAttachments(attachments);
      const itemsLabel =
        items.length > 1
          ? items.map((item) => `${item.quantity}x ${item.product_name}`).join(", ")
          : items[0]?.product_name ?? "Pedido personalizado";
      const waMessage = `Olá ${customer.full_name ?? ""}! Sobre o pedido ${order.public_code} na MiniForge 3D.`;

      return `
        <article class="admin-order-card">
          <div class="admin-order-main">
            <p class="eyebrow">${escapeHtml(order.public_code)} · ${escapeHtml(formatDate(order.created_at))}</p>
            <h3>${escapeHtml(customer.full_name ?? "Cliente")}</h3>
            <p>${escapeHtml(customer.phone ?? "")} ${customer.email ? `· ${escapeHtml(customer.email)}` : ""}</p>
            <p><strong>Itens:</strong> ${escapeHtml(itemsLabel)}</p>
            <p><strong>Valor:</strong> ${escapeHtml(formatMoney(order.total_cents))}</p>
            <p><strong>Status:</strong> ${escapeHtml(statusLabels[order.status] ?? order.status)}</p>
            <p><strong>Pagamento:</strong> ${escapeHtml(paymentStatusLabels[order.payment_status] ?? order.payment_status)}</p>
            ${order.notes ? `<p class="admin-order-notes"><strong>Notas:</strong> ${escapeHtml(order.notes)}</p>` : ""}
            ${refsHtml}
            <p class="admin-order-links">
              <a href="${escapeHtml(buildWhatsappLink(customer.phone, waMessage))}" target="_blank" rel="noopener noreferrer">WhatsApp</a>
              · <a href="acompanhar.html?pedido=${encodeURIComponent(order.public_code)}" target="_blank" rel="noopener noreferrer">Ver como cliente</a>
            </p>
            <details class="admin-order-timeline">
              <summary>Histórico (${events.length})</summary>
              ${renderOrderEvents(events)}
            </details>
          </div>
          <form class="admin-update-form" data-order-id="${escapeHtml(order.id)}">
            <label>
              Status do pedido
              <select name="status">
                ${Object.entries(statusLabels)
                  .map(
                    ([value, label]) =>
                      `<option value="${value}" ${value === order.status ? "selected" : ""}>${label}</option>`,
                  )
                  .join("")}
              </select>
            </label>
            <label>
              Status do pagamento
              <select name="payment_status">
                ${Object.entries(paymentStatusLabels)
                  .map(
                    ([value, label]) =>
                      `<option value="${value}" ${value === order.payment_status ? "selected" : ""}>${label}</option>`,
                  )
                  .join("")}
              </select>
            </label>
            <label>
              Mensagem no histórico
              <textarea name="message" rows="3" placeholder="Ex.: Peça entrou em produção."></textarea>
            </label>
            <label class="admin-checks">
              <input type="checkbox" name="notify_email" />
              Enviar e-mail ao cliente (se configurado no Supabase)
            </label>
            <button class="button button-primary" type="submit">Salvar alterações</button>
          </form>
        </article>
      `;
    })
    .join("");
}

function renderCustomers(orders) {
  if (!customersContainer) return;

  const byPhone = new Map();

  for (const order of orders) {
    const customer = order.customers ?? {};
    const phone = customer.phone ?? "sem-telefone";
    if (!byPhone.has(phone)) {
      byPhone.set(phone, {
        full_name: customer.full_name ?? "Cliente",
        phone,
        email: customer.email ?? "",
        orders: [],
      });
    }
    byPhone.get(phone).orders.push(order);
  }

  const clients = [...byPhone.values()].sort((a, b) => b.orders.length - a.orders.length);

  if (!clients.length) {
    customersContainer.innerHTML = '<p class="loading-message">Nenhum cliente nos pedidos carregados.</p>';
    return;
  }

  customersContainer.innerHTML = clients
    .map((client) => {
      const latest = client.orders[0];
      return `
        <article class="admin-customer-card">
          <h3>${escapeHtml(client.full_name)}</h3>
          <p>${escapeHtml(client.phone)} ${client.email ? `· ${escapeHtml(client.email)}` : ""}</p>
          <p><strong>${client.orders.length}</strong> pedido(s) · último: ${escapeHtml(latest?.public_code ?? "")}</p>
          <ul>${client.orders
            .slice(0, 5)
            .map(
              (order) =>
                `<li>${escapeHtml(order.public_code)} — ${escapeHtml(statusLabels[order.status] ?? order.status)}</li>`,
            )
            .join("")}</ul>
        </article>
      `;
    })
    .join("");
}

function populateStatusFilterOptions() {
  const select = orderFiltersForm?.elements.status;
  if (!select || select.options.length > 1) return;

  Object.entries(statusLabels).forEach(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    select.appendChild(option);
  });
}

function updatePaginationUi() {
  if (!paginationBox) return;
  const start = orderPage.total === 0 ? 0 : orderPage.offset + 1;
  const end = Math.min(orderPage.offset + cachedOrders.length, orderPage.total);
  paginationBox.hidden = orderPage.total === 0;
  paginationMeta.textContent = `Exibindo ${start}–${end} de ${orderPage.total} pedidos`;
  prevPageButton.disabled = orderPage.offset <= 0;
  nextPageButton.disabled = !orderPage.has_more;
}

function exportOrdersCsv() {
  if (!cachedOrders.length) {
    window.alert("Nenhum pedido para exportar.");
    return;
  }

  const rows = [
    ["codigo", "status", "pagamento", "cliente", "telefone", "email", "total_centavos", "criado_em", "itens"].join(
      ",",
    ),
  ];

  for (const order of cachedOrders) {
    const customer = order.customers ?? {};
    const items = (order.order_items ?? []).map((i) => `${i.quantity}x ${i.product_name}`).join(" | ");
    rows.push(
      [
        order.public_code,
        order.status,
        order.payment_status,
        csvEscape(customer.full_name ?? ""),
        csvEscape(customer.phone ?? ""),
        csvEscape(customer.email ?? ""),
        order.total_cents ?? 0,
        order.created_at ?? "",
        csvEscape(items),
      ].join(","),
    );
  }

  const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `miniforge-pedidos-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function csvEscape(value) {
  const text = String(value).replace(/"/g, '""');
  return `"${text}"`;
}

async function loadOrders() {
  ordersContainer.innerHTML = '<p class="loading-message">Carregando pedidos...</p>';
  if (dashboardContainer) {
    dashboardContainer.innerHTML = '<p class="loading-message">Carregando resumo...</p>';
  }

  try {
    const data = await adminRequest(
      "admin-orders",
      {},
      {
        status: orderFilters.status,
        q: orderFilters.q,
        limit: String(orderPage.limit),
        offset: String(orderPage.offset),
      },
    );
    cachedOrders = data.orders ?? [];
    orderPage.total = data.total ?? cachedOrders.length;
    orderPage.has_more = Boolean(data.has_more);
    renderDashboard(cachedOrders);
    renderOrders(cachedOrders);
    renderCustomers(cachedOrders);
    updatePaginationUi();
  } catch (error) {
    console.warn(error);
    clearSession();
    showLogin("Acesso não autorizado ou sessão expirada.");
  }
}

function renderCategoryOptions() {
  const select = productForm.elements.category_id;
  select.innerHTML = catalogCategories
    .filter((category) => category.is_active)
    .map((category) => `<option value="${escapeHtml(category.id)}">${escapeHtml(category.name)}</option>`)
    .join("");
}

function renderProductsAdmin() {
  if (!catalogProducts.length) {
    productsContainer.innerHTML = '<p class="loading-message">Nenhum produto cadastrado.</p>';
    return;
  }

  productsContainer.innerHTML = catalogProducts
    .map(
      (product) => `
        <article class="admin-product-card">
          <div>
            <p class="eyebrow">${escapeHtml(product.categories?.name ?? "Sem categoria")}</p>
            <h3>${escapeHtml(product.name)}</h3>
            <p>${escapeHtml(product.price_label)} · ${escapeHtml(product.lead_time_label)}</p>
            <p>${product.is_active ? "Ativo" : "Inativo"} ${product.is_featured ? "· Destaque" : ""} ${productHasImage(product) ? "" : "· <span class='admin-warn'>Sem foto</span>"}</p>
          </div>
          <button class="button button-secondary" type="button" data-edit-product="${escapeHtml(product.id)}">
            Editar
          </button>
        </article>
      `,
    )
    .join("");
}

async function loadCatalogAdmin() {
  productsContainer.innerHTML = '<p class="loading-message">Carregando produtos...</p>';

  try {
    const data = await adminRequest("admin-products");
    catalogCategories = data.categories ?? [];
    catalogProducts = data.products ?? [];
    renderCategoryOptions();
    renderProductsAdmin();
  } catch (error) {
    console.warn(error);
    productsContainer.innerHTML = '<p class="tracking-result is-error">Não foi possível carregar produtos.</p>';
  }
}

function resetProductForm() {
  productForm.reset();
  productForm.elements.id.value = "";
  productForm.elements.is_active.checked = true;
  productForm.querySelector("h3").textContent = "Novo produto";
  productStatus.textContent = "";
  productStatus.classList.remove("is-error");
}

function fillProductForm(product) {
  productForm.elements.id.value = product.id;
  productForm.elements.category_id.value = product.category_id;
  productForm.elements.name.value = product.name;
  productForm.elements.slug.value = product.slug;
  productForm.elements.short_description.value = product.short_description;
  if (productForm.elements.description) {
    productForm.elements.description.value = product.description ?? product.short_description;
  }
  productForm.elements.price_label.value = product.price_label;
  productForm.elements.starting_price_cents.value = product.starting_price_cents ?? "";
  productForm.elements.lead_time_label.value = product.lead_time_label;
  productForm.elements.scale_label.value = product.scale_label;
  productForm.elements.finish_label.value = product.finish_label;
  productForm.elements.is_featured.checked = product.is_featured;
  productForm.elements.is_active.checked = product.is_active;
  productForm.querySelector("h3").textContent = `Editar ${product.name}`;
  productStatus.textContent = "";
  productForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(loginForm);
  const submitButton = loginForm.querySelector('button[type="submit"]');

  submitButton.disabled = true;
  submitButton.textContent = "Entrando...";
  loginStatus.textContent = "";

  try {
    const session = await signIn(formData.get("email"), formData.get("password"));
    setSession(session);
    showPanel();
    await Promise.all([loadOrders(), loadCatalogAdmin()]);
  } catch (error) {
    loginStatus.textContent = error.message;
    loginStatus.classList.add("is-error");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Entrar no painel";
  }
});

adminTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    const tabName = tab.dataset.adminTab;

    adminTabs.forEach((item) => item.classList.toggle("is-active", item === tab));
    document.querySelectorAll(".admin-tab-panel").forEach((panel) => {
      panel.classList.toggle("is-active", panel.id === `admin-tab-${tabName}`);
    });
  });
});

ordersContainer.addEventListener("submit", async (event) => {
  const form = event.target.closest(".admin-update-form");

  if (!form) {
    return;
  }

  event.preventDefault();

  const formData = new FormData(form);
  const submitButton = form.querySelector('button[type="submit"]');

  submitButton.disabled = true;
  submitButton.textContent = "Salvando...";

  try {
    await adminRequest("admin-orders", {
      method: "PATCH",
      body: JSON.stringify({
        id: form.dataset.orderId,
        status: formData.get("status"),
        payment_status: formData.get("payment_status"),
        message: formData.get("message"),
        notify_email: formData.get("notify_email") === "on",
      }),
    });
    await loadOrders();
  } catch (error) {
    window.alert(error.message);
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Salvar alterações";
  }
});

orderFiltersForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(orderFiltersForm);
  orderFilters = {
    status: String(formData.get("status") ?? ""),
    q: String(formData.get("q") ?? "").trim().toUpperCase(),
    com_fotos: formData.get("com_fotos") === "1",
  };
  orderPage.offset = 0;
  loadOrders();
});

clearOrderFiltersButton?.addEventListener("click", () => {
  orderFilters = { status: "", q: "", com_fotos: false };
  orderPage.offset = 0;
  if (orderFiltersForm) orderFiltersForm.reset();
  loadOrders();
});

dashboardContainer?.addEventListener("click", (event) => {
  const quickBtn = event.target.closest("#admin-quick-quotes-photos");
  if (!quickBtn) return;

  orderFilters = { status: "", q: "", com_fotos: true };
  orderPage.offset = 0;
  if (orderFiltersForm) {
    orderFiltersForm.elements.status.value = "";
    orderFiltersForm.elements.q.value = "";
    orderFiltersForm.elements.com_fotos.checked = true;
  }

  const ordersTab = document.querySelector('[data-admin-tab="orders"]');
  ordersTab?.click();
  renderOrders(cachedOrders);
});

exportCsvButton?.addEventListener("click", exportOrdersCsv);

prevPageButton?.addEventListener("click", () => {
  orderPage.offset = Math.max(0, orderPage.offset - orderPage.limit);
  loadOrders();
});

nextPageButton?.addEventListener("click", () => {
  if (orderPage.has_more) {
    orderPage.offset += orderPage.limit;
    loadOrders();
  }
});

productForm.elements.name.addEventListener("input", () => {
  if (!productForm.elements.id.value) {
    productForm.elements.slug.value = slugify(productForm.elements.name.value);
  }
});

productForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(productForm);
  const submitButton = productForm.querySelector('button[type="submit"]');
  const imageFile = formData.get("image_file");
  let imageDataUrl = "";

  if (imageFile instanceof File && imageFile.size > 0) {
    imageDataUrl = await compressImageFile(imageFile);
  }

  const productId = formData.get("id");
  const existing = catalogProducts.find((item) => item.id === productId);
  const willBeActive = formData.get("is_active") === "on";

  if (willBeActive && !imageDataUrl && !productHasImage(existing)) {
    productStatus.textContent = "Produto ativo precisa de foto. Envie uma imagem ou desative o produto.";
    productStatus.classList.add("is-error");
    return;
  }

  const payload = {
    id: formData.get("id"),
    category_id: formData.get("category_id"),
    name: formData.get("name"),
    slug: formData.get("slug"),
    short_description: formData.get("short_description"),
    description: formData.get("description"),
    image_data_url: imageDataUrl,
    image_alt: formData.get("name"),
    price_label: formData.get("price_label"),
    starting_price_cents: Number(formData.get("starting_price_cents") || 0),
    lead_time_label: formData.get("lead_time_label"),
    scale_label: formData.get("scale_label"),
    finish_label: formData.get("finish_label"),
    is_featured: formData.get("is_featured") === "on",
    is_active: formData.get("is_active") === "on",
  };

  submitButton.disabled = true;
  submitButton.textContent = "Salvando...";
  productStatus.textContent = "";
  productStatus.classList.remove("is-error");

  try {
    await adminRequest("admin-products", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    resetProductForm();
    productStatus.textContent = "Produto salvo com sucesso.";
    await loadCatalogAdmin();
  } catch (error) {
    productStatus.textContent = error.message;
    productStatus.classList.add("is-error");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Salvar produto";
  }
});

productsContainer.addEventListener("click", (event) => {
  const button = event.target.closest("[data-edit-product]");

  if (!button) {
    return;
  }

  const product = catalogProducts.find((item) => item.id === button.dataset.editProduct);

  if (product) {
    fillProductForm(product);
  }
});

resetProductFormButton.addEventListener("click", resetProductForm);

refreshButton.addEventListener("click", loadOrders);
logoutButton.addEventListener("click", () => {
  clearSession();
  showLogin("Sessão encerrada.");
});

populateStatusFilterOptions();

if (getSession()) {
  showPanel();
  loadOrders();
  loadCatalogAdmin();
}
