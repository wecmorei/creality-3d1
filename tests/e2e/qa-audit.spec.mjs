/**
 * Auditoria QA — produção MiniForge 3D
 * E2E_BASE_URL=https://miniforge.btencacorretora.com npx playwright test tests/e2e/qa-audit.spec.mjs
 */
import { test, expect } from "@playwright/test";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:4175";
const PUBLIC_PAGES = [
  { path: "/", name: "Home", checks: ["#bestseller-grid", "#home-category-row", 'a[href="acompanhar.html"]'] },
  { path: "/catalogo.html", name: "Catálogo", checks: ["#catalog-product-grid", "#category-filter-list"] },
  { path: "/carrinho.html", name: "Carrinho", checks: ["#cart-items-panel", "#cart-checkout-form"] },
  { path: "/minha-conta.html", name: "Minha conta", checks: ["[data-account-tab='local']", "#account-login-section"] },
  { path: "/acompanhar.html", name: "Acompanhar", checks: ["#tracking-form", "#tracking-result"] },
  { path: "/como-funciona.html", name: "Como funciona", checks: ["main"] },
  { path: "/faq.html", name: "FAQ", checks: ["main"] },
  { path: "/frete.html", name: "Frete", checks: ["main"] },
  { path: "/privacidade.html", name: "Privacidade", checks: ["main"] },
];

const findings = [];

function record(id, severity, area, title, detail) {
  findings.push({ id, severity, area, title, detail });
}

test.describe("QA Audit — MiniForge 3D", () => {
  test.beforeEach(async ({ page }) => {
    page.on("pageerror", (err) => {
      record("JS-ERR", "Alta", "Console", `Erro JS: ${err.message}`, page.url());
    });
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        record("CONSOLE", "Média", "Console", msg.text(), page.url());
      }
    });
  });

  for (const pg of PUBLIC_PAGES) {
    test(`${pg.name} carrega sem erro crítico`, async ({ page }) => {
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));

      const response = await page.goto(pg.path, { waitUntil: "networkidle", timeout: 45000 });
      expect(response?.status()).toBe(200);

      for (const sel of pg.checks) {
        await expect(page.locator(sel).first()).toBeAttached({ timeout: 10000 });
      }

      const storeOk = await page.evaluate(() => {
        const s = window.MiniForgeStore;
        return {
          exists: !!s,
          loadCatalog: typeof s?.loadStoreCatalog === "function",
          tracking: typeof s?.setupTrackingForm === "function",
        };
      });

      if (pg.path === "/" || pg.path.includes("catalogo") || pg.path.includes("carrinho") || pg.path.includes("minha-conta")) {
        expect(storeOk.exists, "MiniForgeStore ausente").toBe(true);
        expect(storeOk.loadCatalog, "loadStoreCatalog ausente — cache CDN?").toBe(true);
      }

      expect(errors, `Erros JS em ${pg.name}`).toEqual([]);
    });
  }

  test("Home: categorias e destaques carregam do Supabase", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle", timeout: 45000 });

    await expect
      .poll(async () => page.locator("#home-category-row .category-pill").count(), { timeout: 20000 })
      .toBeGreaterThan(0);

    await expect
      .poll(async () => page.locator("#bestseller-grid .product-card:not(.product-card-skeleton)").count(), {
        timeout: 20000,
      })
      .toBeGreaterThan(0);
  });

  test("Catálogo: filtros, busca e cards", async ({ page }) => {
    await page.goto("/catalogo.html", { waitUntil: "networkidle", timeout: 45000 });

    await expect.poll(async () => page.locator("#catalog-product-grid .product-card").count()).toBeGreaterThan(5);

    const search = page.locator("#catalog-search");
    if (await search.isVisible()) {
      await search.fill("dragão");
      await expect.poll(async () => page.locator("#catalog-product-grid .product-card").count()).toBeGreaterThan(0);
    }

    const categoryFilter = page.locator("#catalog-category");
    if (await categoryFilter.isVisible()) {
      const options = await categoryFilter.locator("option").allTextContents();
      expect(options.length).toBeGreaterThan(1);
    }
  });

  test("Produto: página por slug válido e inválido", async ({ page }) => {
    await page.goto("/produto.html?slug=miniatura-dragao-de-mesa", { waitUntil: "networkidle", timeout: 45000 });
    await expect(page.locator("#product-buy-form")).toBeVisible({ timeout: 15000 });
    await expect(page.locator("h1")).not.toBeEmpty();

    await page.goto("/produto.html?slug=slug-inexistente-qa", { waitUntil: "networkidle" });
    const body = await page.locator("main").innerText();
    const hasError = /não encontrad|indisponível|erro/i.test(body);
    if (!hasError) {
      record("PROD-404", "Média", "Produto", "Slug inválido não exibe mensagem clara", body.slice(0, 200));
    }
  });

  test("Carrinho: adicionar via catálogo e exibir itens", async ({ page }) => {
    await page.goto("/catalogo.html", { waitUntil: "networkidle", timeout: 45000 });
    await expect.poll(async () => page.locator(".js-add-to-cart").count()).toBeGreaterThan(0);

    const addBtn = page.locator(".js-add-to-cart").first();
    await addBtn.click();
    await page.waitForTimeout(500);

    await page.goto("/carrinho.html", { waitUntil: "networkidle" });
    const cartLines = page.locator("#cart-items-panel .cart-line");
    const emptyMsg = page.locator(".cart-empty-state");
    const hasItems = (await cartLines.count()) > 0;
    const isEmpty = await emptyMsg.isVisible().catch(() => false);

    if (!hasItems && !isEmpty) {
      record("CART-UI", "Alta", "Carrinho", "Estado do carrinho ambíguo após adicionar item", await page.locator("#cart-items-panel").innerHTML());
    }
    expect(hasItems || isEmpty).toBe(true);
  });

  test("Carrinho: checkout exige consentimento", async ({ page }) => {
    await page.goto("/catalogo.html", { waitUntil: "networkidle" });
    await page.locator(".js-add-to-cart").first().click();
    await page.goto("/carrinho.html", { waitUntil: "networkidle" });
    const form = page.locator("#cart-checkout-form");
    await expect(form).toBeVisible();
    await form.locator('input[name="name"]').fill("QA Carrinho");
    await form.locator('input[name="phone"]').fill("11999990001");
    const consent = form.locator('input[name="consent"]');
    await expect(consent).toHaveAttribute("required", "");
    await consent.setChecked(false);
    await form.locator('button[type="submit"]').click();
    const validationMsg = await consent.evaluate((el) => el.validationMessage);
    expect(validationMsg.length).toBeGreaterThan(0);
  });

  test("Minha conta: abas e login por e-mail", async ({ page }) => {
    await page.goto("/minha-conta.html", { waitUntil: "networkidle", timeout: 45000 });
    await expect(page.locator("[data-account-tab='local']")).toBeVisible();
    await page.locator("[data-account-tab='cloud']").click();
    await expect(page.locator("#account-login-section")).toBeVisible();
    await expect(page.locator("#customer-login-form input[name='email']")).toBeVisible();
    await expect(page.locator("#oauth-unavailable")).toBeVisible();
  });

  test("Navegação repetida home→catálogo→home (bfcache)", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    await expect.poll(async () => page.locator("#bestseller-grid .product-card:not(.product-card-skeleton)").count()).toBeGreaterThan(0);

    await page.goto("/catalogo.html", { waitUntil: "networkidle" });
    await expect.poll(async () => page.locator("#catalog-product-grid .product-card").count()).toBeGreaterThan(0);

    await page.goBack({ waitUntil: "networkidle" });
    await expect.poll(async () => page.locator("#home-category-row .category-pill, #home-category-row a").count()).toBeGreaterThan(0);

    const stuckLoading = await page.locator("#home-category-row .loading-message").isVisible();
    if (stuckLoading) {
      record("BFCACHE", "Alta", "Home", "Categorias presas em Carregando após voltar do catálogo", "");
    }
    expect(stuckLoading).toBe(false);
  });

  test("Links do menu principal respondem 200", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const links = ["catalogo.html", "carrinho.html", "minha-conta.html", "acompanhar.html", "como-funciona.html"];
    for (const href of links) {
      const response = await page.goto(`/${href}`, { waitUntil: "domcontentloaded" });
      expect(response?.status(), href).toBe(200);
    }
  });

  test("Mobile 375px: menu e conteúdo utilizáveis", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/", { waitUntil: "networkidle" });

    const menuBtn = page.locator("[data-mobile-nav-toggle], .mobile-nav-toggle, #mobile-menu-toggle").first();
    if (await menuBtn.isVisible()) {
      await menuBtn.click();
      await expect(page.locator("nav a[href*='catalogo']").first()).toBeVisible();
    }

    const wa = page.locator(".floating-whatsapp, .whatsapp-float, a.js-whatsapp").last();
    if (await wa.isVisible()) {
      const box = await wa.boundingBox();
      if (box && box.y > 700) {
        record("MOBILE-WA", "Baixa", "UX Mobile", "Botão WhatsApp pode cobrir CTA inferior", `y=${box.y}`);
      }
    }
  });

  test("Acessibilidade básica: landmarks e labels", async ({ page }) => {
    await page.goto("/catalogo.html", { waitUntil: "networkidle" });
    await expect(page.locator("main")).toBeVisible();
    const unlabeled = await page.locator("form input:not([type=hidden]):not([aria-label]):not([id])").evaluateAll((els) =>
      els.filter((el) => !el.labels?.length && !el.getAttribute("placeholder")).length,
    );
    if (unlabeled > 3) {
      record("A11Y", "Média", "Acessibilidade", `${unlabeled} inputs sem label associado no catálogo`, "");
    }
  });

  test.afterAll(async () => {
    if (findings.length > 0) {
      console.log("\n=== ACHADOS QA AUTOMATIZADOS ===");
      for (const f of findings) {
        console.log(`[${f.severity}] ${f.id} ${f.area}: ${f.title}`);
        if (f.detail) console.log(`  → ${String(f.detail).slice(0, 120)}`);
      }
    }
  });
});
