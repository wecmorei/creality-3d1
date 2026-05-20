const Store = window.MiniForgeStore;
const Orders = window.MiniForgeCustomerOrders;
const Auth = window.MiniForgeCustomerAuth;

const listEl = document.querySelector("#my-orders-list");
const cloudListEl = document.querySelector("#cloud-orders-list");
const cloudSection = document.querySelector("#cloud-orders-section");
const clearBtn = document.querySelector("#clear-orders-btn");
const addForm = document.querySelector("#add-order-form");
const addResult = document.querySelector("#add-order-result");
const loginForm = document.querySelector("#customer-login-form");
const loginStatus = document.querySelector("#customer-login-status");
const loggedInBox = document.querySelector("#customer-logged-in");
const emailLabel = document.querySelector("#customer-email-label");
const logoutBtn = document.querySelector("#customer-logout-btn");
const refreshCloudBtn = document.querySelector("#refresh-cloud-orders");
const oauthButtons = document.querySelector("#oauth-buttons");
const oauthUnavailable = document.querySelector("#oauth-unavailable");
const oauthDivider = document.querySelector("#oauth-divider");
const oauthStatus = document.querySelector("#oauth-status");
const accountTabs = document.querySelectorAll("[data-account-tab]");
const panelLocal = document.querySelector("#account-panel-local");
const panelCloud = document.querySelector("#account-panel-cloud");

function formatSavedAt(iso) {
  try {
    return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return "";
  }
}

function formatMoney(cents) {
  if (!cents || cents <= 0) return "Sob orçamento";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function renderOrderTypeBadge(type) {
  const label = Store.getOrderTypeLabel(type);
  if (!label || type === "order") return "";
  return `<span class="order-type-badge order-type-badge--${Store.escapeHtml(type)}">${Store.escapeHtml(label)}</span>`;
}

function switchAccountTab(tabId) {
  accountTabs.forEach((btn) => {
    const active = btn.dataset.accountTab === tabId;
    btn.classList.toggle("is-active", active);
    btn.setAttribute("aria-selected", active ? "true" : "false");
  });
  if (panelLocal) panelLocal.hidden = tabId !== "local";
  if (panelCloud) panelCloud.hidden = tabId !== "cloud";
  try {
    window.sessionStorage.setItem("miniforge_account_tab", tabId);
  } catch {
    /* ignore */
  }
}

function renderLocalOrdersList() {
  const saved = Orders.readOrders();

  if (!saved.length) {
    listEl.innerHTML = `
      <div class="account-empty">
        <p>Nenhum pedido salvo neste navegador ainda.</p>
        <p>Após finalizar uma compra ou orçamento, o código MF3D aparece aqui automaticamente.</p>
      </div>
    `;
    clearBtn.hidden = true;
    return;
  }

  clearBtn.hidden = false;
  listEl.innerHTML = saved.map(renderLocalOrderCard).join("");
}

function renderLocalOrderCard(entry) {
  const badge = renderOrderTypeBadge(entry.type);
  return `
    <article class="my-order-card" data-code="${Store.escapeHtml(entry.public_code)}">
      <div class="my-order-card-head">
        <p class="eyebrow">${Store.escapeHtml(entry.public_code)} ${badge}</p>
        <p class="my-order-meta">${Store.escapeHtml(entry.label || "Pedido registrado")} · ${Store.escapeHtml(formatSavedAt(entry.saved_at))}</p>
      </div>
      <div class="my-order-actions">
        <button type="button" class="btn btn-outline btn-sm" data-refresh-order="${Store.escapeHtml(entry.public_code)}">Atualizar status</button>
        <a class="btn-text" href="acompanhar.html?pedido=${encodeURIComponent(entry.public_code)}">Ver detalhes</a>
        <button type="button" class="btn-text" data-remove-order="${Store.escapeHtml(entry.public_code)}">Remover</button>
      </div>
      <div class="my-order-detail tracking-result" data-order-detail="${Store.escapeHtml(entry.public_code)}" hidden></div>
    </article>
  `;
}

function renderCloudOrders(orders) {
  if (!orders.length) {
    cloudListEl.innerHTML =
      '<p class="account-empty">Nenhum pedido vinculado a este e-mail ainda. Faça um pedido usando o mesmo e-mail ou adicione um código na aba Neste aparelho.</p>';
    return;
  }

  cloudListEl.innerHTML = orders
    .map((order) => {
      const items = Array.isArray(order.order_items) ? order.order_items : [];
      const itemsLabel = items.map((i) => `${i.quantity}x ${i.product_name}`).join(", ") || "Pedido";
      const type = order.type ?? (order.status === "quote_requested" ? "quote" : "order");
      const badge = renderOrderTypeBadge(type);
      return `
        <article class="my-order-card">
          <div class="my-order-card-head">
            <p class="eyebrow">${Store.escapeHtml(order.public_code)} ${badge}</p>
            <p class="my-order-meta">${Store.escapeHtml(Store.getOrderStatusLabel(order.status))} · ${Store.escapeHtml(formatMoney(order.total_cents))}</p>
            <p class="my-order-meta">${Store.escapeHtml(itemsLabel)}</p>
          </div>
          <div class="my-order-actions">
            <a class="btn btn-outline btn-sm" href="acompanhar.html?pedido=${encodeURIComponent(order.public_code)}">Ver detalhes</a>
          </div>
        </article>
      `;
    })
    .join("");

  for (const order of orders) {
    Orders.rememberOrder({
      public_code: order.public_code,
      type: order.type,
      label: Store.getOrderStatusLabel(order.status),
    });
  }
}

async function refreshOrderDetail(code, targetEl) {
  targetEl.hidden = false;
  targetEl.textContent = "Consultando...";
  targetEl.classList.remove("is-error");

  try {
    const order = await Store.trackOrder(code);
    targetEl.innerHTML = Store.renderTrackingHtml(order);
    Orders.rememberOrder({
      public_code: order.public_code,
      type: order.type,
      label: Store.getOrderStatusLabel(order.status),
    });
    renderLocalOrdersList();
  } catch {
    targetEl.classList.add("is-error");
    targetEl.textContent = "Não foi possível atualizar. Verifique o código.";
  }
}

async function loadCloudOrders() {
  if (!Auth.getAccessToken()) return;

  cloudSection.hidden = false;
  cloudListEl.innerHTML = '<p class="loading-message">Carregando pedidos...</p>';

  try {
    const data = await Auth.fetchMyOrders();
    renderCloudOrders(data.orders ?? []);
    if (emailLabel && data.email) emailLabel.textContent = data.email;
  } catch (error) {
    cloudListEl.innerHTML = `<p class="tracking-result is-error">${Store.escapeHtml(error.message)}</p>`;
  }
}

function setupOAuthVisibility() {
  const socialEnabled =
    Store.isFeatureEnabled("socialLoginEnabled") || Auth.isSocialLoginEnabled?.();
  if (oauthButtons) oauthButtons.hidden = !socialEnabled;
  if (oauthUnavailable) oauthUnavailable.hidden = socialEnabled;
  if (oauthDivider) oauthDivider.hidden = !socialEnabled;
}

function updateAuthUi() {
  const session = Auth.getSession();
  const isLoggedIn = Boolean(session?.access_token);

  loginForm.hidden = isLoggedIn;
  loggedInBox.hidden = !isLoggedIn;
  if (oauthButtons) oauthButtons.hidden = isLoggedIn || !Store.isFeatureEnabled("socialLoginEnabled");
  cloudSection.hidden = !isLoggedIn;

  if (isLoggedIn) {
    const label = session.email ?? "sua conta";
    const provider = Auth.getProviderLabel?.() ?? "";
    emailLabel.textContent = provider && provider !== "E-mail" ? `${label} (${provider})` : label;
    loadCloudOrders();
    switchAccountTab("cloud");
  }
}

async function handleOAuthClick(event) {
  const button = event.target.closest("[data-oauth]");
  if (!button) return;

  const provider = button.dataset.oauth;
  oauthStatus.textContent = "Redirecionando...";
  oauthStatus.classList.remove("is-error");

  try {
    await Auth.signInWithProvider(provider);
  } catch (error) {
    oauthStatus.textContent = error.message;
    oauthStatus.classList.add("is-error");
  }
}

accountTabs.forEach((btn) => {
  btn.addEventListener("click", () => switchAccountTab(btn.dataset.accountTab));
});

listEl.addEventListener("click", (event) => {
  const refreshBtn = event.target.closest("[data-refresh-order]");
  if (refreshBtn) {
    const code = refreshBtn.dataset.refreshOrder;
    const detail = listEl.querySelector(`[data-order-detail="${code}"]`);
    if (detail) refreshOrderDetail(code, detail);
    return;
  }

  const removeBtn = event.target.closest("[data-remove-order]");
  if (removeBtn) {
    Orders.removeOrder(removeBtn.dataset.removeOrder);
    renderLocalOrdersList();
  }
});

clearBtn?.addEventListener("click", () => {
  if (window.confirm("Remover todos os pedidos salvos neste navegador?")) {
    Orders.clearOrders();
    renderLocalOrdersList();
  }
});

loginForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = String(new FormData(loginForm).get("email") ?? "").trim();
  const submitBtn = loginForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  loginStatus.textContent = "Enviando link...";
  loginStatus.classList.remove("is-error");

  try {
    await Auth.requestMagicLink(email);
    loginStatus.textContent = "Link enviado! Abra seu e-mail e clique para entrar.";
  } catch (error) {
    loginStatus.textContent = error.message;
    loginStatus.classList.add("is-error");
  } finally {
    submitBtn.disabled = false;
  }
});

logoutBtn?.addEventListener("click", async () => {
  await Auth.signOut();
  updateAuthUi();
});

oauthButtons?.addEventListener("click", handleOAuthClick);

refreshCloudBtn?.addEventListener("click", loadCloudOrders);

Store.setupTrackingForm(addForm, addResult, {
  type: "manual",
  onSuccess: () => renderLocalOrdersList(),
});

window.addEventListener("miniforge-orders-updated", renderLocalOrdersList);
window.addEventListener("miniforge-customer-auth-changed", updateAuthUi);

(async function initAccount() {
  setupOAuthVisibility();
  const savedTab = window.sessionStorage.getItem("miniforge_account_tab");
  if (savedTab === "cloud" || savedTab === "local") {
    switchAccountTab(savedTab);
  }
  await Auth.initSession();
  if (Auth.getAccessToken()) {
    await Auth.linkPastOrders();
  }
  updateAuthUi();
  renderLocalOrdersList();
})();

Store.setPageMeta({
  title: "Minha conta | MiniForge 3D",
  description: "Pedidos salvos, login por e-mail e acompanhamento MiniForge 3D.",
  path: "/minha-conta.html",
});
