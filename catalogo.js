const redirectSlug = new URLSearchParams(window.location.search).get("produto");
if (redirectSlug) {
  window.location.replace(`produto.html?slug=${encodeURIComponent(redirectSlug)}`);
}

const grid = document.querySelector("#catalog-product-grid");
const categoryFilterList = document.querySelector("#category-filter-list");
const mobileCategoryFilters = document.querySelector("#mobile-category-filters");
const sortSelect = document.querySelector("#sort-select");
const searchInput = document.querySelector("#search-input");
const catalogSummary = document.querySelector("#catalog-summary");
const catalogEmpty = document.querySelector("#catalog-empty");
const activeFilters = document.querySelector("#active-filters");
const clearFiltersBtn = document.querySelector("#clear-filters");
const priceFilterSelect = document.querySelector("#price-filter");

let Store = null;
let allProducts = [];
let allCategories = [];

const state = {
  category: "",
  query: "",
  sort: "destaques",
  priceRange: "",
};

function readUrlState() {
  const params = new URLSearchParams(window.location.search);
  state.category = params.get("categoria") ?? "";
  state.query = params.get("q") ?? "";
  state.sort = params.get("ordenar") ?? "destaques";
  state.priceRange = params.get("preco") ?? "";

  if (searchInput) searchInput.value = state.query;
  if (sortSelect) sortSelect.value = state.sort;
  if (priceFilterSelect) priceFilterSelect.value = state.priceRange;
}

function writeUrlState() {
  const params = new URLSearchParams();
  if (state.category) params.set("categoria", state.category);
  if (state.query) params.set("q", state.query);
  if (state.sort && state.sort !== "destaques") params.set("ordenar", state.sort);
  if (state.priceRange) params.set("preco", state.priceRange);

  const query = params.toString();
  const next = `${window.location.pathname}${query ? `?${query}` : ""}`;
  window.history.replaceState({}, "", next);
}

function countByCategory(slug) {
  if (!slug) return allProducts.length;
  return allProducts.filter((product) => product.categorySlug === slug).length;
}

function renderCategoryFilters() {
  if (!categoryFilterList || !mobileCategoryFilters) return;

  const allCount = allProducts.length;

  const renderItem = (slug, label, count, isActive) => {
    const params = new URLSearchParams(window.location.search);
    if (slug) params.set("categoria", slug);
    else params.delete("categoria");
    if (state.query) params.set("q", state.query);
    if (state.sort !== "destaques") params.set("ordenar", state.sort);
    const href = `catalogo.html${params.toString() ? `?${params.toString()}` : ""}`;

    return `
      <li>
        <a class="filter-link${isActive ? " is-active" : ""}" href="${href}" data-category="${Store.escapeHtml(slug)}">
          <span>${Store.escapeHtml(label)}</span>
          <span class="filter-count">${count}</span>
        </a>
      </li>
    `;
  };

  categoryFilterList.innerHTML = [
    renderItem("", "Todos os produtos", allCount, !state.category),
    ...allCategories.map((category) =>
      renderItem(category.slug, category.name, countByCategory(category.slug), state.category === category.slug),
    ),
  ].join("");

  mobileCategoryFilters.innerHTML = [
    `<a class="category-chip${!state.category ? " is-active" : ""}" href="catalogo.html${state.query ? `?q=${encodeURIComponent(state.query)}` : ""}">Todos</a>`,
    ...allCategories.map((category) => {
      const params = new URLSearchParams();
      params.set("categoria", category.slug);
      if (state.query) params.set("q", state.query);
      return `<a class="category-chip${state.category === category.slug ? " is-active" : ""}" href="catalogo.html?${params.toString()}">${Store.escapeHtml(category.name)}</a>`;
    }),
  ].join("");
}

function sortProducts(products) {
  const list = [...products];

  switch (state.sort) {
    case "nome":
      return list.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    case "preco-asc":
      return list.sort((a, b) => (a.startingPrice ?? Number.MAX_SAFE_INTEGER) - (b.startingPrice ?? Number.MAX_SAFE_INTEGER));
    case "preco-desc":
      return list.sort((a, b) => (b.startingPrice ?? -1) - (a.startingPrice ?? -1));
    case "destaques":
    default:
      return list.sort((a, b) => Number(b.featured) - Number(a.featured) || a.name.localeCompare(b.name, "pt-BR"));
  }
}

function filterProducts() {
  let filtered = [...allProducts];

  if (state.category) {
    filtered = filtered.filter((product) => product.categorySlug === state.category);
  }

  if (state.query) {
    const q = state.query.toLowerCase();
    filtered = filtered.filter(
      (product) =>
        product.name.toLowerCase().includes(q) ||
        product.category.toLowerCase().includes(q) ||
        (product.description ?? "").toLowerCase().includes(q),
    );
  }

  if (state.priceRange) {
    filtered = filtered.filter((product) => {
      const price = product.startingPrice;
      if (price == null) return state.priceRange === "sob-consulta";
      if (state.priceRange === "ate-50") return price <= 5000;
      if (state.priceRange === "50-100") return price > 5000 && price <= 10000;
      if (state.priceRange === "acima-100") return price > 10000;
      return true;
    });
  }

  return sortProducts(filtered);
}

function renderActiveFilters() {
  if (!activeFilters || !clearFiltersBtn) return;

  const chips = [];

  if (state.category) {
    const category = allCategories.find((item) => item.slug === state.category);
    chips.push(`<span class="filter-chip">Categoria: ${Store.escapeHtml(category?.name ?? state.category)}</span>`);
  }

  if (state.query) {
    chips.push(`<span class="filter-chip">Busca: "${Store.escapeHtml(state.query)}"</span>`);
  }

  activeFilters.innerHTML = chips.join("");
  clearFiltersBtn.hidden = chips.length === 0;
}

function updateSummary(count) {
  if (!catalogSummary) return;

  const category = allCategories.find((item) => item.slug === state.category);
  const parts = [`${count} produto${count === 1 ? "" : "s"}`];

  if (category) parts.push(`em ${category.name}`);
  if (state.query) parts.push(`para "${state.query}"`);

  catalogSummary.textContent = parts.join(" ");
}

function renderCatalogError(message) {
  if (grid) {
    grid.innerHTML = `
      <div class="catalog-empty-state">
        <p>${Store.escapeHtml(message)}</p>
        <button type="button" class="btn btn-buy" id="catalog-retry-btn">Tentar novamente</button>
      </div>
    `;
    grid.querySelector("#catalog-retry-btn")?.addEventListener("click", () => {
      Store.invalidateStoreCatalogCache();
      loadCatalog({ force: true });
    });
  }
  if (catalogEmpty) catalogEmpty.hidden = true;
}

function renderCatalog() {
  try {
    const products = filterProducts();
    renderCategoryFilters();
    renderActiveFilters();
    updateSummary(products.length);

    if (!grid) return;

    if (products.length === 0) {
      grid.innerHTML = "";
      if (catalogEmpty) {
        catalogEmpty.hidden = false;
        catalogEmpty.innerHTML =
          'Nenhum produto encontrado com os filtros selecionados. <a href="personalizado.html">Solicitar peça sob medida</a>.';
      }
      writeUrlState();
      return;
    }

    if (catalogEmpty) catalogEmpty.hidden = true;
    grid.innerHTML = products.map(Store.renderProductCard).join("");
    writeUrlState();
  } catch (error) {
    console.error("Render catalog failed", error);
    renderCatalogError("Não foi possível exibir o catálogo. Tente recarregar a página.");
  }
}

async function loadCatalog({ force = false } = {}) {
  if (!Store || !grid) return;

  grid.innerHTML = Store.renderSkeletonProductCards(8);
  if (catalogEmpty) catalogEmpty.hidden = true;
  if (catalogSummary) catalogSummary.textContent = "Carregando produtos...";

  try {
    const data = await Store.loadStoreCatalog({ force });
    allCategories = data.categories ?? Store.fallbackCategories;
    allProducts = data.products ?? Store.normalizeProductList(Store.fallbackProducts);

    readUrlState();
    renderCatalog();

    if (data.error && catalogSummary) {
      catalogSummary.textContent = `${allProducts.length} produtos (modo offline)`;
    }
  } catch (error) {
    console.error("Load catalog failed", error);
    allCategories = Store.fallbackCategories;
    allProducts = Store.normalizeProductList(Store.fallbackProducts);
    readUrlState();
    renderCatalogError("Não foi possível carregar o catálogo agora.");
  }
}

function bindCatalogEvents() {
  categoryFilterList?.addEventListener("click", (event) => {
    const link = event.target.closest("[data-category]");
    if (!(link instanceof HTMLAnchorElement)) return;
    event.preventDefault();
    state.category = link.dataset.category ?? "";
    renderCatalog();
  });

  sortSelect?.addEventListener("change", () => {
    state.sort = sortSelect.value;
    renderCatalog();
  });

  priceFilterSelect?.addEventListener("change", () => {
    state.priceRange = priceFilterSelect.value;
    renderCatalog();
  });

  searchInput?.addEventListener("input", () => {
    state.query = searchInput.value.trim();
    renderCatalog();
  });

  document.querySelector("#header-search-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    state.query = searchInput?.value.trim() ?? "";
    renderCatalog();
  });

  clearFiltersBtn?.addEventListener("click", () => {
    window.location.href = "catalogo.html";
  });
}

function startCatalogPage() {
  Store = window.MiniForgeStore;
  if (!Store) {
    if (grid) {
      grid.innerHTML =
        '<p class="catalog-empty-state">Erro ao iniciar a loja. <a href="catalogo.html">Recarregar catálogo</a>.</p>';
    }
    return;
  }

  bindCatalogEvents();
  readUrlState();

  Store.setPageMeta({
    title: "Catálogo | MiniForge 3D",
    description: "Catálogo MiniForge 3D com filtros por categoria, preço e busca.",
    path: "/catalogo.html",
  });

  loadCatalog();
}

function initCatalogPage() {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startCatalogPage, { once: true });
  } else {
    startCatalogPage();
  }

  window.addEventListener("pageshow", (event) => {
    if (event.persisted) {
      Store?.invalidateStoreCatalogCache?.();
      loadCatalog({ force: true });
    }
  });
}

initCatalogPage();
