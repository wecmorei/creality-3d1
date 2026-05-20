import { test, expect } from "@playwright/test";
import { readFileSync, existsSync } from "node:fs";

function loadLocalEnv() {
  if (!existsSync(".env.local")) return;

  const env = readFileSync(".env.local", "utf8");
  for (const line of env.split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
  }
}

loadLocalEnv();

async function loginAdmin(page) {
  const email = process.env.LOGIN_USER_APPLICATION;
  const password = process.env.LOGIN_PASSWORD_APPLICATION;

  test.skip(!email || !password, "Set LOGIN_USER_APPLICATION and LOGIN_PASSWORD_APPLICATION in .env.local");

  await page.goto("/admin.html");
  await page.locator("#admin-login-form input[name='email']").fill(email);
  await page.locator("#admin-login-form input[name='password']").fill(password);
  await page.locator("#admin-login-form button[type='submit']").click();
  await expect(page.locator("#admin-panel")).toBeVisible();
}

test("home, catalog, product purchase and tracking flow", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /action figures, miniaturas/i })).toBeVisible();
  await expect(page.locator("#bestseller-grid .product-card").first()).toBeVisible({ timeout: 15000 });

  await page.getByRole("link", { name: "Ver catálogo" }).first().click();
  await expect(page).toHaveURL(/catalogo/);
  await expect.poll(async () => page.locator(".product-card").count()).toBeGreaterThanOrEqual(1);

  await page.locator(".product-card").first().locator("h3 a").click();
  await expect(page.locator("#product-buy-form")).toBeVisible({ timeout: 15000 });

  await page.locator("#product-buy-form input[name='name']").fill("QA Compra Catálogo");
  await page.locator("#product-buy-form input[name='phone']").fill("11999993333");
  await page.locator("#product-buy-form input[name='consent']").check();

  await page.locator("#product-buy-form button[type='submit']").click();
  await expect(page).toHaveURL(/pedido-registrado\.html/, { timeout: 15000 });
  const code = new URL(page.url()).searchParams.get("pedido");
  expect(code).toMatch(/^MF3D-\d{8}-[A-Z0-9]{8}$/);
  await expect(page.locator("#order-success-code")).toContainText(code);

  await page.goto("/acompanhar.html");
  await page.locator("#tracking-form input[name='code']").fill(code);
  await page.locator("#tracking-form button[type='submit']").click();
  await expect(page.locator("#tracking-result")).toContainText(code);
  await expect(page.locator("#tracking-result")).toContainText(/Orçamento solicitado|Aguardando pagamento/);
});

test("quote form with privacy consent", async ({ page }) => {
  await page.goto("/personalizado.html");
  await page.locator("#quote-form input[name='name']").fill("QA Orçamento");
  await page.locator("#quote-form input[name='phone']").fill("11999994444");
  await page.locator("#quote-form select[name='category']").selectOption({ label: "Miniatura" });
  await page.locator("#quote-form select[name='size']").selectOption({ label: "Pequeno, até 8 cm" });
  await page.locator("#quote-form textarea[name='description']").fill("Pedido de teste automatizado com consentimento LGPD.");
  await page.locator("#quote-form input[name='consent']").check();

  await page.locator("#quote-form button[type='submit']").click();
  await expect(page).toHaveURL(/pedido-registrado\.html/, { timeout: 20000 });
  await expect(page.locator("#order-success-code")).toContainText(/MF3D-\d{8}-[A-Z0-9]{8}/);
});

test("catalog filters and institutional pages", async ({ page }) => {
  await page.goto("/catalogo.html?categoria=miniaturas-rpg");
  await expect.poll(async () => page.locator(".product-card").count()).toBeGreaterThanOrEqual(1);

  await page.goto("/como-funciona.html");
  await expect(page.getByRole("heading", { name: /como funciona/i })).toBeVisible();

  await page.goto("/privacidade.html");
  await expect(page.getByRole("heading", { name: /privacidade/i })).toBeVisible();
});

test("admin rejects invalid credentials", async ({ page }) => {
  await page.goto("/admin.html");
  await page.locator("#admin-login-form input[name='email']").fill("invalid@example.com");
  await page.locator("#admin-login-form input[name='password']").fill("invalid-password");
  await page.locator("#admin-login-form button[type='submit']").click();
  await expect(page.locator("#admin-login-status")).not.toBeEmpty();
});

test("admin authenticated navigation when credentials exist", async ({ page }) => {
  await loginAdmin(page);
  await expect(page.locator(".admin-stat-card").first()).toBeVisible();
  await page.getByRole("button", { name: "Pedidos" }).click();
  await expect(page.locator(".admin-order-card").first()).toBeVisible();
  await page.getByRole("button", { name: "Produtos" }).click();
  await expect(page.locator("#admin-product-form")).toBeVisible();
});

test("invalid tracking code shows safe error", async ({ page }) => {
  await page.goto("/acompanhar.html");
  await page.locator("#tracking-form input[name='code']").fill("MF3D-00000000-INVALID1");
  await page.locator("#tracking-form button[type='submit']").click();
  await expect(page.locator("#tracking-result")).toContainText("Pedido não encontrado");
});
