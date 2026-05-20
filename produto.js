const Store = window.MiniForgeStore;
const Cart = window.MiniForgeCart;

const root = document.querySelector("#product-root");
const params = new URLSearchParams(window.location.search);
const slug = params.get("slug") || params.get("produto");

let currentProduct = null;

function renderProductDetail(rawProduct) {
  const p = Store.normalizeProduct(rawProduct);
  currentProduct = p;
  const categoryHref = `catalogo.html?categoria=${encodeURIComponent(p.categorySlug)}`;

  Store.setSocialMeta({
    title: `${p.name} | MiniForge 3D`,
    description: p.description,
    imageUrl: p.imageUrl,
    path: `/produto.html?slug=${encodeURIComponent(p.slug)}`,
    type: "product",
  });

  if (p.startingPrice) {
    const ld = {
      "@context": "https://schema.org",
      "@type": "Product",
      name: p.name,
      description: p.description,
      image: p.imageUrl ? [p.imageUrl] : undefined,
      offers: {
        "@type": "Offer",
        priceCurrency: "BRL",
        price: (p.startingPrice / 100).toFixed(2),
        availability: "https://schema.org/PreOrder",
        url: `${Store.siteOrigin}/produto.html?slug=${encodeURIComponent(p.slug)}`,
      },
    };
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.textContent = JSON.stringify(ld);
    document.head.appendChild(script);
  }

  const galleryHtml = p.imageUrl
    ? `<img class="product-detail-image" src="${Store.escapeHtml(p.imageUrl)}" alt="${Store.escapeHtml(p.imageAlt)}" width="640" height="640" />`
    : `<div class="product-detail-fallback" aria-hidden="true">${Store.escapeHtml(p.icon)}</div>`;

  root.innerHTML = `
    <nav class="breadcrumb" aria-label="Navegação">
      <a href="index.html">Início</a>
      <span aria-hidden="true">/</span>
      <a href="catalogo.html">Catálogo</a>
      <span aria-hidden="true">/</span>
      <a href="${categoryHref}">${Store.escapeHtml(p.category)}</a>
      <span aria-hidden="true">/</span>
      <span>${Store.escapeHtml(p.name)}</span>
    </nav>

    <article class="product-detail">
      <div class="product-detail-gallery">${galleryHtml}</div>
      <div class="product-detail-info">
        <p class="product-category">${Store.escapeHtml(p.category)}</p>
        <div class="product-badges-row">${Store.renderProductPriceBadge(p)}</div>
        <h1>${Store.escapeHtml(p.name)}</h1>
        <p class="product-detail-price">${Store.escapeHtml(p.price)}</p>
        <p class="product-detail-price-hint">${
          Store.hasDirectPurchasePrice(p)
            ? "Preço base para compra no carrinho. Valor final pode variar conforme personalização."
            : "Valor confirmado no WhatsApp antes da produção. Este item não entra no pagamento automático."
        }</p>
        <p class="product-detail-lead">Prazo: ${Store.escapeHtml(p.leadTime)} · Escala: ${Store.escapeHtml(p.scale)} · Acabamento: ${Store.escapeHtml(p.finish)}</p>
        <p class="product-detail-desc">${Store.escapeHtml(p.longDescription)}</p>
        <div class="product-detail-actions">
          <button type="button" class="btn btn-buy js-add-to-cart" data-slug="${Store.escapeHtml(p.slug)}">Adicionar ao carrinho</button>
          <a class="btn btn-outline" href="carrinho.html">Ver carrinho</a>
        </div>
        <aside class="pix-callout pix-callout-product" role="note">
          <strong>10% de desconto no Pix</strong>
          <p>Aplicado após confirmação do valor no WhatsApp. Pagamento online quando o preço base estiver definido — <a href="como-funciona.html#pagamento">detalhes</a>.</p>
        </aside>
        <ul class="product-detail-trust">
          <li>Produção própria com acompanhamento por código MF3D</li>
          <li>Frete combinado após confirmação — <a href="como-funciona.html#frete">saiba mais</a></li>
        </ul>
        <section class="panel-card product-buy-panel" id="comprar">
          <h2>Comprar agora (1 item)</h2>
          <p class="section-subtitle">Registramos este item e abrimos o WhatsApp. Para vários itens, use o carrinho.</p>
          <form id="product-buy-form">
            <label>Nome<input type="text" name="name" autocomplete="name" required /></label>
            <label>WhatsApp<input type="tel" name="phone" autocomplete="tel" required /></label>
            <label>E-mail <span class="optional">(opcional)</span><input type="email" name="email" autocomplete="email" /></label>
            <label>Observações<textarea name="notes" rows="2" placeholder="Cor, referência, urgência..."></textarea></label>
            <label class="consent-label">
              <input type="checkbox" name="consent" required />
              Li e aceito a <a href="privacidade.html" target="_blank" rel="noopener">política de privacidade</a>.
            </label>
            <button class="btn btn-outline" type="submit">Comprar e falar no WhatsApp</button>
            <p class="form-status" id="product-buy-status" role="status"></p>
          </form>
        </section>
      </div>
    </article>
  `;

  const form = document.querySelector("#product-buy-form");
  const status = document.querySelector("#product-buy-status");

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = "Registrando...";
    status.textContent = "Registrando pedido...";
    status.classList.remove("is-error");

    let orderCode = null;

    try {
      const order = await Store.createOrder({
        type: "catalog",
        consent: formData.get("consent") === "on",
        customer: {
          name: formData.get("name"),
          phone: formData.get("phone"),
          email: formData.get("email"),
        },
        product: { slug: p.slug, notes: formData.get("notes") },
      });
      orderCode = order.public_code;
      Store.rememberCustomerOrder({
        public_code: orderCode,
        type: "catalog",
        label: p.name,
      });
      Store.trackEvent("purchase_catalog", { product_slug: p.slug, order_code: orderCode });
      const message = [
        `Olá! Quero comprar: ${p.name}.`,
        `Pedido: ${orderCode}`,
        `Nome: ${formData.get("name")}`,
        `WhatsApp: ${formData.get("phone")}`,
        formData.get("notes") ? `Obs: ${formData.get("notes")}` : null,
      ]
        .filter(Boolean)
        .join("\n");
      Store.redirectToOrderSuccess({
        code: orderCode,
        type: "catalog",
        customerName: formData.get("name"),
        whatsappMessage: message,
      });
      return;
    } catch (error) {
      status.textContent = error.message || "Não foi possível registrar. Continue pelo WhatsApp.";
      status.classList.add("is-error");
      submitButton.disabled = false;
      submitButton.textContent = "Comprar e falar no WhatsApp";
    }
  });
}

async function loadProduct() {
  if (!slug) {
    root.innerHTML = '<p class="catalog-empty">Produto não informado. <a href="catalogo.html">Voltar ao catálogo</a></p>';
    return;
  }

  try {
    const product = await Store.fetchProductBySlug(slug);
    if (product) {
      renderProductDetail(product);
      return;
    }
  } catch (error) {
    console.warn("Product fetch failed", error);
  }

  const fallback = Store.fallbackProducts.find((item) => item.slug === slug);
  if (fallback) {
    renderProductDetail(fallback);
    return;
  }

  root.innerHTML =
    '<p class="catalog-empty">Produto não encontrado. <a href="catalogo.html">Ver catálogo</a> ou <a href="personalizado.html">pedir sob medida</a>.</p>';
}

function initProductPage() {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadProduct, { once: true });
  } else {
    loadProduct();
  }

  window.addEventListener("pageshow", (event) => {
    if (event.persisted) loadProduct();
  });
}

initProductPage();
