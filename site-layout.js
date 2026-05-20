/**
 * Menu, promo, rodapé e WhatsApp — fonte única para o site público.
 */
(function initSiteLayout() {
  const Store = window.MiniForgeStore;
  if (!Store) return;

  const NAV_ITEMS = [
    { id: "home", label: "Início", href: "index.html" },
    { id: "catalog", label: "Catálogo", href: "catalogo.html" },
    { id: "cart", label: "Carrinho", href: "carrinho.html" },
    { id: "account", label: "Minha conta", href: "minha-conta.html" },
    { id: "track", label: "Acompanhar", href: "acompanhar.html" },
    { id: "how", label: "Como funciona", href: "como-funciona.html" },
    { id: "custom", label: "Personalizados", href: "personalizado.html" },
  ];

  const PAGE_IDS = {
    "index.html": "home",
    "catalogo.html": "catalog",
    "carrinho.html": "cart",
    "minha-conta.html": "account",
    "acompanhar.html": "track",
    "produto.html": "product",
    "como-funciona.html": "how",
    "faq.html": "faq",
    "frete.html": "shipping",
    "privacidade.html": "privacy",
    "termos.html": "terms",
    "personalizado.html": "custom",
    "pedido-registrado.html": "order-success",
  };

  function getBusinessConfig() {
    return window.MiniForgeConfig?.business ?? {};
  }

  function getCurrentPageId() {
    if (document.body.dataset.page) return document.body.dataset.page;
    const file = window.location.pathname.split("/").pop() || "index.html";
    return PAGE_IDS[file] ?? "home";
  }

  function renderPromoBar() {
    return `
      <div class="promo-bar" aria-label="Promoções">
        <div class="container promo-bar-inner">
          <span>10% no Pix no fechamento do pedido</span>
          <span>Produção própria</span>
          <a href="minha-conta.html">Minha conta</a>
          <a href="acompanhar.html">Acompanhar pedido</a>
          <a class="js-whatsapp" href="#" data-message="Olá! Vim pelo site da MiniForge 3D.">WhatsApp</a>
        </div>
      </div>
    `;
  }

  function renderHeader(currentPageId) {
    const navLinks = NAV_ITEMS.map((item) => {
      const isCurrent =
        item.id === currentPageId ||
        (currentPageId === "product" && item.id === "catalog");
      const currentAttr = isCurrent ? ' aria-current="page"' : "";
      const cartBadge =
        item.id === "cart"
          ? ` <span class="nav-cart-count" data-cart-count hidden aria-label="Itens no carrinho">0</span>`
          : "";
      return `<a href="${item.href}"${currentAttr}>${Store.escapeHtml(item.label)}${cartBadge}</a>`;
    }).join("");

    return `
      <header class="site-header">
        <div class="container header-main">
          <a class="brand" href="index.html" aria-label="MiniForge 3D">
            <span class="brand-logo">MF</span>
            <span class="brand-text">
              <strong>MiniForge 3D</strong>
              <small>A loja do universo 3D</small>
            </span>
          </a>
          <form class="search-box" id="header-search-form" role="search">
            <input type="search" id="search-input" placeholder="Buscar produtos..." aria-label="Buscar produtos" />
            <button type="submit" aria-label="Buscar">Buscar</button>
          </form>
          <div class="header-nav">
            <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="nav-menu">Menu</button>
            <nav class="nav-menu" id="nav-menu" aria-label="Navegação principal">
              ${navLinks}
            </nav>
          </div>
        </div>
      </header>
    `;
  }

  function renderFooter() {
    const biz = getBusinessConfig();
    const cnpjLine = biz.cnpj ? `<p>CNPJ ${Store.escapeHtml(biz.cnpj)}</p>` : "";
    const instagram = biz.instagramUrl
      ? `<a href="${Store.escapeHtml(biz.instagramUrl)}" target="_blank" rel="noopener noreferrer">Instagram</a>`
      : "";

    return `
      <footer class="site-footer">
        <div class="container footer-grid">
          <div>
            <a class="brand" href="index.html">
              <span class="brand-logo">MF</span>
              <span class="brand-text"><strong>MiniForge 3D</strong></span>
            </a>
            <p>Action figures, miniaturas e impressão 3D personalizada.</p>
            ${biz.city ? `<p class="footer-meta">${Store.escapeHtml(biz.city)}</p>` : ""}
            ${cnpjLine}
            ${biz.whatsappHours ? `<p class="footer-meta">${Store.escapeHtml(biz.whatsappHours)} · ${Store.escapeHtml(biz.responseTime ?? "")}</p>` : ""}
          </div>
          <div>
            <h3>Loja</h3>
            <a href="catalogo.html">Catálogo</a>
            <a href="carrinho.html">Carrinho</a>
            <a href="minha-conta.html">Minha conta</a>
            <a href="index.html#mais-vendidos">Mais vendidos</a>
            <a href="personalizado.html">Personalizados</a>
          </div>
          <div>
            <h3>Institucional</h3>
            <a href="como-funciona.html">Como funciona</a>
            <a href="acompanhar.html">Acompanhar pedido</a>
            <a href="privacidade.html">Privacidade</a>
            <a href="termos.html">Termos de venda</a>
          </div>
          <div>
            <h3>Ajuda</h3>
            <a href="faq.html">FAQ</a>
            <a href="frete.html">Frete e prazos</a>
          </div>
          <div>
            <h3>Atendimento</h3>
            <a class="js-whatsapp" href="#" data-message="Olá! Vim pelo site da MiniForge 3D.">WhatsApp</a>
            ${biz.email ? `<a href="mailto:${Store.escapeHtml(biz.email)}">${Store.escapeHtml(biz.email)}</a>` : ""}
            ${instagram}
          </div>
        </div>
        <div class="container footer-bottom">
          <p>© ${Store.escapeHtml(biz.legalName ?? "MiniForge 3D")} · <a href="privacidade.html">Privacidade</a> · <a href="termos.html">Termos de venda</a>. Pagamentos via Pix ou link seguro — sem cartão no site.</p>
        </div>
      </footer>
    `;
  }

  function renderFloatingWhatsapp() {
    return `
      <a
        class="floating-whatsapp js-whatsapp"
        href="#"
        data-message="Olá! Quero fazer um pedido na MiniForge 3D."
        aria-label="WhatsApp"
      >WhatsApp</a>
    `;
  }

  function mountSiteChrome() {
    const headerSlot = document.getElementById("site-chrome-header");
    const footerSlot = document.getElementById("site-chrome-footer");
    if (!headerSlot && !footerSlot) return;

    const currentPageId = getCurrentPageId();

    if (headerSlot) {
      headerSlot.innerHTML = renderPromoBar() + renderHeader(currentPageId);
    }

    if (footerSlot) {
      footerSlot.innerHTML = renderFooter() + renderFloatingWhatsapp();
    }

    Store.setupWhatsappLinks();
    Store.setupMobileNav();
    Store.setupHeaderSearch("#header-search-form");
    Store.setupAddToCartButtons();
    Store.setupCartBadgeListener();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountSiteChrome);
  } else {
    mountSiteChrome();
  }
})();
