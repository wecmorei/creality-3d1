const bestsellerGrid = document.querySelector("#bestseller-grid");
const homeCategoryRow = document.querySelector("#home-category-row");
let Store = null;

function renderBestsellerEmpty() {
  if (!bestsellerGrid) return;
  bestsellerGrid.innerHTML = `
    <div class="catalog-empty-state">
      <p>Destaques em atualização. Enquanto isso, explore o catálogo completo.</p>
      <a class="btn btn-buy" href="catalogo.html">Ver catálogo</a>
    </div>
  `;
}

function renderHomeCategoriesError() {
  if (!homeCategoryRow) return;
  homeCategoryRow.innerHTML = `
    <span class="loading-message">Não foi possível carregar categorias.</span>
    <button type="button" class="btn btn-outline btn-sm" id="home-retry-categories">Tentar de novo</button>
  `;
  homeCategoryRow.querySelector("#home-retry-categories")?.addEventListener("click", () => {
    Store?.invalidateStoreCatalogCache?.();
    loadHomeCategories({ force: true });
  });
}

async function loadHomeProducts() {
  if (!bestsellerGrid || !Store) return;

  bestsellerGrid.innerHTML = Store.renderSkeletonProductCards(4);

  try {
    const data = await Store.loadStoreCatalog();
    const bestsellers = Store.pickHomeProducts(data.products, 4);

    if (!bestsellers.length) {
      renderBestsellerEmpty();
      return;
    }

    bestsellerGrid.innerHTML = bestsellers.map(Store.renderProductCard).join("");
    Store.trackEvent("view_home_bestsellers", { count: bestsellers.length });
  } catch (error) {
    console.warn("Home products failed.", error);
    const bestsellers = Store.pickHomeProducts(Store.fallbackProducts, 4);
    if (!bestsellers.length) {
      renderBestsellerEmpty();
      return;
    }
    bestsellerGrid.innerHTML = bestsellers.map(Store.renderProductCard).join("");
  }
}

async function loadHomeCategories({ force = false } = {}) {
  if (!homeCategoryRow || !Store) return;

  try {
    const data = await Store.loadStoreCatalog({ force });
    Store.renderHomeCategories(
      data.categories?.length > 0 ? data.categories : Store.fallbackCategories,
      homeCategoryRow,
    );
  } catch (error) {
    console.warn("Home categories failed.", error);
    try {
      Store.renderHomeCategories(Store.fallbackCategories, homeCategoryRow);
    } catch {
      renderHomeCategoriesError();
    }
  }
}

function startHomePage() {
  Store = window.MiniForgeStore;
  if (!Store) return;

  Store.setSocialMeta({
    title: "MiniForge 3D | Loja de impressão 3D",
    description:
      "Action figures, miniaturas e peças personalizadas em impressão 3D. Catálogo online, Pix com desconto e acompanhamento de pedido.",
    path: "/index.html",
  });

  loadHomeProducts();
  loadHomeCategories();
}

function initHomePage() {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startHomePage, { once: true });
  } else {
    startHomePage();
  }

  window.addEventListener("pageshow", (event) => {
    if (event.persisted) {
      Store?.invalidateStoreCatalogCache?.();
      loadHomeProducts();
      loadHomeCategories({ force: true });
    }
  });
}

initHomePage();
