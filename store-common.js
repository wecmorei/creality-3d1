const whatsappNumber = "5511960544031";
const siteOrigin = "https://miniforge.btencacorretora.com";

const ORDER_TYPE_LABELS = {
  quote: "Orçamento",
  catalog: "Compra catálogo",
  cart: "Carrinho",
  order: "Pedido",
};

function getAssetVersion() {
  return window.MiniForgeConfig?.assets?.version ?? "20260521c";
}

function isFeatureEnabled(name) {
  return window.MiniForgeConfig?.features?.[name] === true;
}

function getOrderTypeLabel(type) {
  return ORDER_TYPE_LABELS[type] ?? "Pedido";
}

function hasDirectPurchasePrice(product) {
  const cents = product?.startingPrice ?? product?.starting_price_cents ?? product?.startingPriceCents;
  return typeof cents === "number" && cents > 0;
}

function renderProductPriceBadge(product) {
  if (hasDirectPurchasePrice(product)) {
    return '<span class="product-price-badge product-price-badge--direct">Compra direta</span>';
  }
  return '<span class="product-price-badge product-price-badge--quote">Sob orçamento</span>';
}

function stashLastOrder(payload) {
  try {
    window.sessionStorage.setItem("miniforge_last_order", JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

function readLastOrder() {
  try {
    const raw = window.sessionStorage.getItem("miniforge_last_order");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function buildOrderSuccessUrl({ code, type = "order", photos = 0 }) {
  const url = new URL("pedido-registrado.html", window.location.href);
  url.searchParams.set("pedido", code);
  if (type) url.searchParams.set("tipo", type);
  if (photos > 0) url.searchParams.set("fotos", String(photos));
  return url.toString();
}

function redirectToOrderSuccess({ code, type, photos = 0, customerName, whatsappMessage }) {
  stashLastOrder({
    public_code: code,
    type: type ?? "order",
    photos,
    customerName: customerName ?? "",
    whatsappMessage: whatsappMessage ?? "",
    saved_at: new Date().toISOString(),
  });
  window.location.assign(buildOrderSuccessUrl({ code, type, photos }));
}
const storageBucket = "product-images";

const supabaseConfig = {
  url: "https://fmlqsivgffzjryilnjcj.supabase.co",
  publishableKey: "sb_publishable_BRjLzisbkSCzarxEWpZG7w_JI5y9GwM",
};

const orderStatusLabels = {
  quote_requested: "Orçamento solicitado",
  quoted: "Orçamento enviado",
  awaiting_payment: "Aguardando pagamento",
  paid: "Pagamento confirmado",
  in_production: "Em produção",
  ready: "Pronto para retirada/envio",
  shipped: "Enviado",
  completed: "Concluído",
  cancelled: "Cancelado",
};

const paymentStatusLabels = {
  pending: "Aguardando pagamento",
  authorized: "Pagamento autorizado",
  paid: "Pago",
  failed: "Pagamento falhou",
  refunded: "Reembolsado",
  cancelled: "Pagamento cancelado",
};

const fallbackCategories = [
  { slug: "action-figures", name: "Action figures", description: "Personagens e colecionáveis." },
  { slug: "miniaturas-rpg", name: "Miniaturas RPG", description: "Mesa, diorama e pintura." },
  { slug: "decoracao-geek", name: "Decoração geek", description: "Setup, estante e presentes." },
  { slug: "brindes-chaveiros", name: "Brindes e chaveiros", description: "Lembranças personalizadas." },
  { slug: "pecas-tecnicas", name: "Peças técnicas", description: "Suportes e protótipos." },
];

const fallbackProducts = [
  {
    slug: "action-figure-personalizada",
    name: "Action Figure Personalizada",
    categories: { slug: "action-figures", name: "Action figures" },
    price_label: "Sob orçamento",
    starting_price_cents: 14900,
    lead_time_label: "7 a 15 dias",
    scale_label: "12 a 25 cm",
    finish_label: "Primer ou pintura",
    short_description: "Figure feita a partir de referência.",
    is_featured: true,
    product_images: [],
  },
  {
    slug: "miniatura-de-mesa",
    name: "Miniatura de Mesa",
    categories: { slug: "miniaturas-rpg", name: "Miniaturas RPG" },
    price_label: "A partir de R$ 39",
    starting_price_cents: 3900,
    lead_time_label: "3 a 7 dias",
    scale_label: "3 a 8 cm",
    finish_label: "Sem pintura ou primer",
    short_description: "Miniaturas para RPG e dioramas.",
    is_featured: false,
    product_images: [],
  },
  {
    slug: "decoracao-geek",
    name: "Decoração Geek",
    categories: { slug: "decoracao-geek", name: "Decoração geek" },
    price_label: "A partir de R$ 59",
    starting_price_cents: 5900,
    lead_time_label: "5 a 10 dias",
    scale_label: "Variável",
    finish_label: "Cor única ou pintura",
    short_description: "Peças para setup e estante.",
    is_featured: true,
    product_images: [],
  },
  {
    slug: "chaveiros-e-lembrancas",
    name: "Chaveiros e Lembranças",
    categories: { slug: "brindes-chaveiros", name: "Brindes e chaveiros" },
    price_label: "A partir de R$ 15",
    starting_price_cents: 1500,
    lead_time_label: "2 a 5 dias",
    scale_label: "Pequeno",
    finish_label: "Cor única",
    short_description: "Brindes e presentes criativos.",
    is_featured: false,
    product_images: [],
  },
  {
    slug: "pecas-tecnicas",
    name: "Peças Técnicas",
    categories: { slug: "pecas-tecnicas", name: "Peças técnicas" },
    price_label: "Sob análise",
    starting_price_cents: null,
    lead_time_label: "Sob análise",
    scale_label: "Conforme medidas",
    finish_label: "Funcional",
    short_description: "Protótipos e peças funcionais.",
    is_featured: false,
    product_images: [],
  },
  {
    slug: "kit-pintura",
    name: "Kit Pintura",
    categories: { slug: "action-figures", name: "Action figures" },
    price_label: "Sob orçamento",
    starting_price_cents: null,
    lead_time_label: "5 a 12 dias",
    scale_label: "Variável",
    finish_label: "Sem pintura",
    short_description: "Peças para customização.",
    is_featured: false,
    product_images: [],
  },
];

function buildWhatsappUrl(message) {
  return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => {
    const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
    return entities[character];
  });
}

function trackEvent(name, detail = {}) {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event: name, ...detail });
  if (typeof window.plausible === "function") {
    window.plausible(name, { props: detail });
  }
}

function initAnalytics() {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const analytics = window.MiniForgeConfig?.analytics ?? {};
  window.dataLayer = window.dataLayer || [];

  if (analytics.plausibleDomain) {
    const existing = document.querySelector('script[data-domain][src*="plausible.io"]');
    if (!existing) {
      const script = document.createElement("script");
      script.defer = true;
      script.dataset.domain = analytics.plausibleDomain;
      script.src = "https://plausible.io/js/script.js";
      document.head.appendChild(script);
    }
  }

  if (analytics.ga4MeasurementId) {
    const gaId = analytics.ga4MeasurementId;
    if (!document.querySelector(`script[src*="googletagmanager.com/gtag/js?id=${gaId}"]`)) {
      const loader = document.createElement("script");
      loader.async = true;
      loader.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
      document.head.appendChild(loader);
      window.gtag =
        window.gtag ||
        function gtag() {
          window.dataLayer.push(arguments);
        };
      window.gtag("js", new Date());
      window.gtag("config", gaId);
    }
  }
}

function upsertMetaTag(attribute, key, content) {
  if (!content) return;
  let tag = document.querySelector(`meta[${attribute}="${key}"]`);
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute(attribute, key);
    document.head.appendChild(tag);
  }
  tag.content = content;
}

function setSocialMeta({ title, description, imageUrl, path, type = "website" }) {
  if (typeof document === "undefined") return;

  const pagePath = path ?? `${window.location.pathname}${window.location.search}`;
  const url = `${siteOrigin}${pagePath.startsWith("/") ? pagePath : `/${pagePath}`}`;
  if (title) document.title = title;
  upsertMetaTag("name", "description", description);
  upsertMetaTag("property", "og:title", title);
  upsertMetaTag("property", "og:description", description);
  upsertMetaTag("property", "og:url", url);
  upsertMetaTag("property", "og:type", type);
  upsertMetaTag("property", "og:site_name", "MiniForge 3D");
  if (imageUrl) upsertMetaTag("property", "og:image", imageUrl);
  upsertMetaTag("name", "twitter:card", imageUrl ? "summary_large_image" : "summary");
  upsertMetaTag("name", "twitter:title", title);
  upsertMetaTag("name", "twitter:description", description);
  if (imageUrl) upsertMetaTag("name", "twitter:image", imageUrl);

  setPageMeta({ title, description, path: pagePath });
}

function renderSkeletonProductCards(count = 4) {
  return Array.from({ length: count }, () => `
    <article class="product-card product-card-skeleton" aria-hidden="true">
      <div class="product-thumb skeleton-block"></div>
      <div class="product-body">
        <p class="skeleton-line skeleton-line-sm"></p>
        <p class="skeleton-line skeleton-line-lg"></p>
        <p class="skeleton-line skeleton-line-md"></p>
        <span class="skeleton-block skeleton-btn"></span>
      </div>
    </article>
  `).join("");
}

function pickHomeProducts(products, limit = 4) {
  const normalized = normalizeProductList(products);
  const withImage = normalized.filter((p) => p.imageUrl);
  const featured = normalized.filter((p) => p.featured);
  const featuredWithImage = featured.filter((p) => p.imageUrl);

  const pool =
    featuredWithImage.length > 0
      ? featuredWithImage
      : featured.length > 0
        ? featured
        : withImage.length > 0
          ? withImage
          : normalized;

  return pool.slice(0, limit);
}

function getProductIcon(product) {
  const iconMap = {
    "action-figure-personalizada": "AF",
    "miniatura-de-mesa": "RPG",
    "decoracao-geek": "3D",
    "chaveiros-e-lembrancas": "KEY",
    "pecas-tecnicas": "CAD",
    "kit-pintura": "DIY",
  };
  const name = String(product?.name ?? "3D");
  return iconMap[product?.slug] ?? name.slice(0, 3).toUpperCase();
}

function getPrimaryImage(product) {
  const images = product.product_images ?? product.images ?? [];
  if (!Array.isArray(images) || images.length === 0) return null;
  return images.find((image) => image.is_primary) ?? images[0];
}

function getImagePublicUrl(storagePath) {
  if (!storagePath) return null;
  if (storagePath.startsWith("http://") || storagePath.startsWith("https://")) return storagePath;
  return `${supabaseConfig.url}/storage/v1/object/public/${storageBucket}/${storagePath}`;
}

function normalizeProduct(product) {
  if (!product || !product.slug) {
    return null;
  }

  const categoryName = product.category ?? product.categories?.name ?? "Produto 3D";
  const categorySlug = product.categorySlug ?? product.categories?.slug ?? "";
  const primaryImage = getPrimaryImage(product);

  return {
    id: product.id ?? null,
    slug: product.slug,
    name: product.name ?? "Produto",
    category: categoryName,
    categorySlug,
    price: product.price ?? product.price_label,
    startingPrice: product.startingPrice ?? product.starting_price_cents,
    leadTime: product.leadTime ?? product.lead_time_label,
    scale: product.scale ?? product.scale_label,
    finish: product.finish ?? product.finish_label,
    description: product.description ?? product.short_description,
    longDescription: product.longDescription ?? product.description ?? product.short_description,
    icon: product.icon ?? getProductIcon(product),
    featured: product.featured ?? product.is_featured ?? false,
    imageUrl: primaryImage ? getImagePublicUrl(primaryImage.storage_path) : null,
    imageAlt: primaryImage?.alt_text ?? product.name,
  };
}

function getOrderStatusLabel(status) {
  return orderStatusLabels[status] ?? status;
}

function getPaymentStatusLabel(status) {
  return paymentStatusLabels[status] ?? status;
}

const FETCH_TIMEOUT_MS = 15000;
let catalogLoadPromise = null;

async function supabaseFetch(path, params = {}, timeoutMs = FETCH_TIMEOUT_MS) {
  const endpoint = new URL(`${supabaseConfig.url}/rest/v1/${path}`);
  Object.entries(params).forEach(([key, value]) => endpoint.searchParams.set(key, value));

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(endpoint, {
      signal: controller.signal,
      headers: {
        apikey: supabaseConfig.publishableKey,
        Authorization: `Bearer ${supabaseConfig.publishableKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Supabase request failed: ${response.status}`);
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function normalizeProductList(products) {
  return (Array.isArray(products) ? products : [])
    .map((product) => normalizeProduct(product))
    .filter(Boolean);
}

async function loadStoreCatalog({ force = false } = {}) {
  if (!force && catalogLoadPromise) {
    return catalogLoadPromise;
  }

  catalogLoadPromise = (async () => {
    try {
      const [categories, products] = await Promise.all([
        fetchCategoriesFromSupabase(),
        fetchProductsFromSupabase(),
      ]);

      return {
        categories: categories.length > 0 ? categories : fallbackCategories,
        products: normalizeProductList(products.length > 0 ? products : fallbackProducts),
        fromCache: false,
      };
    } catch (error) {
      console.warn("Catalog load failed, using fallback.", error);
      return {
        categories: fallbackCategories,
        products: normalizeProductList(fallbackProducts),
        fromCache: false,
        error: true,
      };
    }
  })();

  return catalogLoadPromise;
}

function invalidateStoreCatalogCache() {
  catalogLoadPromise = null;
}

const productSelect =
  "id,slug,name,short_description,description,price_label,starting_price_cents,lead_time_label,scale_label,finish_label,is_featured,product_images(storage_path,alt_text,is_primary,sort_order),categories(name,slug)";

async function fetchCategoriesFromSupabase() {
  return supabaseFetch("categories", {
    select: "name,slug,description,sort_order",
    is_active: "eq.true",
    order: "sort_order.asc,name.asc",
  });
}

async function fetchProductsFromSupabase() {
  return supabaseFetch("products", {
    select: productSelect,
    is_active: "eq.true",
    order: "is_featured.desc,sort_order.asc,name.asc",
  });
}

async function fetchProductBySlug(slug) {
  const rows = await supabaseFetch("products", {
    select: productSelect,
    slug: `eq.${slug}`,
    is_active: "eq.true",
    limit: "1",
  });
  return rows[0] ?? null;
}

function getCustomerAuthHeaders() {
  const token = window.MiniForgeCustomerAuth?.getAccessToken?.();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

async function uploadQuoteReferences(publicCode, files) {
  const formData = new FormData();
  formData.append("public_code", publicCode);
  for (const file of files) {
    formData.append("references", file);
  }

  const response = await fetch(`${supabaseConfig.url}/functions/v1/upload-quote-references`, {
    method: "POST",
    headers: {
      apikey: supabaseConfig.publishableKey,
      ...getCustomerAuthHeaders(),
    },
    body: formData,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? "Não foi possível enviar as fotos de referência.");
  return data;
}

async function createOrder(payload) {
  const response = await fetch(`${supabaseConfig.url}/functions/v1/create-order`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: supabaseConfig.publishableKey,
      ...getCustomerAuthHeaders(),
    },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? "Não foi possível registrar o pedido.");
  return data;
}

async function trackOrder(code) {
  const endpoint = new URL(`${supabaseConfig.url}/functions/v1/track-order`);
  endpoint.searchParams.set("code", code);
  const response = await fetch(endpoint, { headers: { apikey: supabaseConfig.publishableKey } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? "Pedido não encontrado.");
  return data;
}

function renderTrackingHtml(order) {
  const events = Array.isArray(order.events) ? order.events : [];
  const items = Array.isArray(order.items) ? order.items : [];
  const createdAt = order.created_at
    ? new Date(order.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
    : "";
  const total =
    order.total_cents > 0
      ? ` · Estimativa ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(order.total_cents / 100)}`
      : "";

  const itemsHtml =
    items.length > 0
      ? `<ul class="tracking-items">${items
          .map(
            (item) =>
              `<li>${escapeHtml(item.product_name)} (x${item.quantity})${item.scale_label ? ` — ${escapeHtml(item.scale_label)}` : ""}</li>`,
          )
          .join("")}</ul>`
      : "";

  const eventsHtml =
    events.length > 0
      ? `<ul class="tracking-events">${events
          .map((event) => {
            const when = event.created_at
              ? new Date(event.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
              : "";
            const msg = event.message ? `: ${escapeHtml(event.message)}` : "";
            return `<li><time>${escapeHtml(when)}</time> — ${escapeHtml(getOrderStatusLabel(event.status))}${msg}</li>`;
          })
          .join("")}</ul>`
      : "";

  return `
    <strong>Pedido ${escapeHtml(order.public_code)}</strong>
    ${createdAt ? `<p class="tracking-meta">Registrado em ${escapeHtml(createdAt)}${escapeHtml(total)}</p>` : ""}
    <p>Status: ${escapeHtml(getOrderStatusLabel(order.status))}</p>
    <p>Pagamento: ${escapeHtml(getPaymentStatusLabel(order.payment_status))}</p>
    ${itemsHtml}
    ${eventsHtml}
  `;
}

function rememberCustomerOrder(entry) {
  const Orders = window.MiniForgeCustomerOrders;
  if (!Orders) return null;
  return Orders.rememberOrder(entry);
}

function setupTrackingForm(form, resultEl, options = {}) {
  if (!form || !resultEl) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const code = String(new FormData(form).get("code") ?? "").trim().toUpperCase();
    const submitButton = form.querySelector('button[type="submit"]');

    if (submitButton) submitButton.disabled = true;
    resultEl.textContent = "Consultando...";
    resultEl.classList.remove("is-error");

    try {
      const order = await trackOrder(code);
      resultEl.innerHTML = renderTrackingHtml(order);
      rememberCustomerOrder({
        public_code: order.public_code,
        type: options.type ?? "track",
        label: getOrderStatusLabel(order.status),
      });
      trackEvent("track_order", { code });
      if (options.onSuccess) options.onSuccess(order);
    } catch {
      resultEl.classList.add("is-error");
      resultEl.textContent = "Pedido não encontrado. Confira o código MF3D.";
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });

  const preset = options.presetCode ?? new URLSearchParams(window.location.search).get("pedido");
  if (preset) {
    const input = form.querySelector('input[name="code"]');
    if (input) input.value = preset;
    if (options.autoSubmit) form.requestSubmit();
  }
}

function renderProductThumb(product, linkHref) {
  const productName = escapeHtml(product.name);
  const href = linkHref ?? `produto.html?slug=${encodeURIComponent(product.slug)}`;

  if (product.imageUrl) {
    return `<a class="product-thumb" href="${href}" aria-label="Ver ${productName}">
      <img src="${escapeHtml(product.imageUrl)}" alt="${escapeHtml(product.imageAlt)}" loading="lazy" width="400" height="400" />
    </a>`;
  }

  return `<a class="product-thumb" href="${href}" aria-label="Ver ${productName}">
    <span class="product-thumb-fallback" aria-hidden="true">${escapeHtml(product.icon)}</span>
  </a>`;
}

function renderProductCard(product) {
  const productName = escapeHtml(product.name);
  const category = escapeHtml(product.category);
  const price = escapeHtml(product.price);
  const detailHref = `produto.html?slug=${encodeURIComponent(product.slug)}`;
  const featuredBadge = product.featured ? '<span class="product-badge">Destaque</span>' : "";
  const priceBadge = renderProductPriceBadge(product);

  return `
    <article class="product-card" data-name="${productName.toLowerCase()}" data-category="${escapeHtml(product.categorySlug)}" data-price="${product.startingPrice ?? ""}">
      ${renderProductThumb(product, detailHref)}
      <div class="product-body">
        <div class="product-badges-row">${priceBadge}${featuredBadge}</div>
        <p class="product-category">${category}</p>
        <h3><a href="${detailHref}">${productName}</a></h3>
        <p class="product-price-label">Preço</p>
        <p class="product-price">${price}</p>
        <div class="product-card-actions">
          <a class="btn btn-buy" href="${detailHref}#comprar">Comprar</a>
          <button type="button" class="btn btn-outline js-add-to-cart" data-slug="${escapeHtml(product.slug)}">+ Carrinho</button>
        </div>
      </div>
    </article>
  `;
}

function showCartToast(message) {
  let toast = document.querySelector(".cart-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "cart-toast";
    toast.setAttribute("role", "status");
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.clearTimeout(showCartToast._timer);
  showCartToast._timer = window.setTimeout(() => toast.classList.remove("is-visible"), 2600);
}

async function addToCartBySlug(slug, quantity = 1, notes = "") {
  const Cart = window.MiniForgeCart;
  if (!Cart) return;

  try {
    const product = await fetchProductBySlug(slug);
    if (product) {
      Cart.addItem(normalizeProduct(product), quantity, notes);
      showCartToast("Adicionado ao carrinho");
      trackEvent("add_to_cart", { slug, quantity });
      return;
    }
  } catch (error) {
    console.warn("addToCart fetch failed", error);
  }

  const fallback = fallbackProducts.find((item) => item.slug === slug);
  if (fallback) {
    Cart.addItem(normalizeProduct(fallback), quantity, notes);
    showCartToast("Adicionado ao carrinho");
    return;
  }

  showCartToast("Não foi possível adicionar o item");
}

function setupAddToCartButtons() {
  document.body.addEventListener("click", (event) => {
    const button = event.target.closest(".js-add-to-cart");
    if (!button) return;
    event.preventDefault();
    const slug = button.dataset.slug;
    if (!slug) return;
    addToCartBySlug(slug);
  });
}

function updateCartBadge() {
  const Cart = window.MiniForgeCart;
  if (!Cart) return;
  const count = Cart.getCartCount();
  document.querySelectorAll("[data-cart-count]").forEach((el) => {
    el.textContent = String(count);
    el.hidden = count === 0;
  });
}

function setupCartBadgeListener() {
  updateCartBadge();
  window.addEventListener("miniforge-cart-updated", updateCartBadge);
}

async function createPayment({ public_code }) {
  const response = await fetch(`${supabaseConfig.url}/functions/v1/create-payment`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: supabaseConfig.publishableKey,
    },
    body: JSON.stringify({ public_code }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? "Pagamento indisponível.");
  return data;
}

function renderHomeCategories(categories, container) {
  if (!container) return;

  const pills = categories.map(
    (category) =>
      `<a href="catalogo.html?categoria=${encodeURIComponent(category.slug)}" class="category-pill">${escapeHtml(category.name)}</a>`,
  );

  pills.push('<a href="personalizado.html" class="category-pill category-pill-accent">Sob medida</a>');
  container.innerHTML = pills.join("");
}

function setupWhatsappLinks() {
  document.querySelectorAll(".js-whatsapp").forEach((link) => {
    const message = link.dataset.message;
    if (!message) return;
    link.href = buildWhatsappUrl(message);
    link.target = "_blank";
    link.rel = "noopener noreferrer";
  });
}

function setupMobileNav() {
  const navToggle = document.querySelector(".nav-toggle");
  const navMenu = document.querySelector("#nav-menu");
  if (!navToggle || !navMenu) return;

  navToggle.addEventListener("click", () => {
    const isOpen = navToggle.getAttribute("aria-expanded") === "true";
    navToggle.setAttribute("aria-expanded", String(!isOpen));
    navMenu.classList.toggle("is-open");
  });

  navMenu.addEventListener("click", (event) => {
    if (event.target instanceof HTMLAnchorElement) {
      navToggle.setAttribute("aria-expanded", "false");
      navMenu.classList.remove("is-open");
    }
  });
}

function setupHeaderSearch(formSelector) {
  const form = document.querySelector(formSelector);
  if (!form) return;

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const input = form.querySelector('input[type="search"]');
    const query = input?.value?.trim() ?? "";
    const url = new URL("catalogo.html", window.location.href);
    if (query) url.searchParams.set("q", query);
    trackEvent("search", { query });
    window.location.href = url.toString();
  });
}

function setPageMeta({ title, description, path }) {
  if (title) document.title = title;
  if (description) {
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "description";
      document.head.appendChild(meta);
    }
    meta.content = description;
  }

  const canonicalPath = path ?? window.location.pathname;
  let canonical = document.querySelector('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement("link");
    canonical.rel = "canonical";
    document.head.appendChild(canonical);
  }
  canonical.href = `${siteOrigin}${canonicalPath}${window.location.search}`;
}

try {
  initAnalytics();
} catch (error) {
  console.warn("Analytics init skipped.", error);
}

window.MiniForgeStore = {
  siteOrigin,
  ORDER_TYPE_LABELS,
  getAssetVersion,
  isFeatureEnabled,
  getOrderTypeLabel,
  hasDirectPurchasePrice,
  renderProductPriceBadge,
  stashLastOrder,
  readLastOrder,
  buildOrderSuccessUrl,
  redirectToOrderSuccess,
  supabaseConfig,
  fallbackCategories,
  fallbackProducts,
  orderStatusLabels,
  paymentStatusLabels,
  buildWhatsappUrl,
  escapeHtml,
  normalizeProduct,
  renderProductCard,
  renderProductThumb,
  renderSkeletonProductCards,
  pickHomeProducts,
  getImagePublicUrl,
  fetchCategoriesFromSupabase,
  fetchProductsFromSupabase,
  loadStoreCatalog,
  invalidateStoreCatalogCache,
  normalizeProductList,
  fetchProductBySlug,
  createOrder,
  uploadQuoteReferences,
  getCustomerAuthHeaders,
  trackOrder,
  renderTrackingHtml,
  rememberCustomerOrder,
  setupTrackingForm,
  getOrderStatusLabel,
  getPaymentStatusLabel,
  renderHomeCategories,
  setupWhatsappLinks,
  setupMobileNav,
  setupHeaderSearch,
  setPageMeta,
  setSocialMeta,
  trackEvent,
  initAnalytics,
  addToCartBySlug,
  setupAddToCartButtons,
  setupCartBadgeListener,
  createPayment,
};
