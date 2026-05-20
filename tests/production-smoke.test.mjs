/**
 * Smoke test em produção — páginas, APIs e regressões de catálogo.
 */
import test from "node:test";
import assert from "node:assert/strict";

const SITE = "https://miniforge.btencacorretora.com";
const API = "https://fmlqsivgffzjryilnjcj.supabase.co";
const KEY = "sb_publishable_BRjLzisbkSCzarxEWpZG7w_JI5y9GwM";

const PUBLIC_PAGES = [
  "/",
  "/index.html",
  "/catalogo.html",
  "/carrinho.html",
  "/minha-conta.html",
  "/acompanhar.html",
  "/personalizado.html",
  "/como-funciona.html",
  "/faq.html",
  "/frete.html",
  "/privacidade.html",
  "/produto.html?slug=miniatura-de-mesa",
];

async function fetchPage(path) {
  const url = `${SITE}${path}`;
  const response = await fetch(url, { redirect: "follow" });
  const html = await response.text();
  return { url, status: response.status, html };
}

test("production pages return 200 and load store-common.js", async () => {
  for (const path of PUBLIC_PAGES) {
    const { status, html } = await fetchPage(path);
    assert.equal(status, 200, `${path} status`);
    assert.match(html, /store-common\.js/, `${path} missing store-common`);
    assert.doesNotMatch(html, /service_role/i, `${path} leaks service role`);
  }
});

test("production catalog page does not stick on loading placeholder", async () => {
  const { html } = await fetchPage("/catalogo.html");
  assert.match(html, /catalogo\.js/);
  assert.match(html, /id="catalog-product-grid"/);
});

test("production index has category row and bestseller grid", async () => {
  const { html } = await fetchPage("/index.html");
  assert.match(html, /id="home-category-row"/);
  assert.match(html, /id="bestseller-grid"/);
  assert.match(html, /script\.js/);
});

test("production minha-conta has oauth and login", async () => {
  const { html } = await fetchPage("/minha-conta.html");
  assert.match(html, /data-oauth="google"/);
  assert.match(html, /customer-auth\.js/);
  assert.match(html, /loadStoreCatalog|store-common/);
});

test("production security headers on index", async () => {
  const response = await fetch(`${SITE}/index.html`);
  const csp = response.headers.get("content-security-policy") ?? "";
  assert.match(csp, /fmlqsivgffzjryilnjcj\.supabase\.co/);
  assert.match(csp, /frame-ancestors/i);
});

test("production APIs: products and categories", async () => {
  const productsUrl = new URL(`${API}/rest/v1/products`);
  productsUrl.searchParams.set("select", "slug,name,is_active");
  productsUrl.searchParams.set("is_active", "eq.true");
  productsUrl.searchParams.set("limit", "20");

  const res = await fetch(productsUrl, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
  });
  assert.equal(res.status, 200);
  const products = await res.json();
  assert.ok(products.length >= 1, "at least one active product");

  const catsUrl = new URL(`${API}/rest/v1/categories`);
  catsUrl.searchParams.set("select", "slug,name");
  catsUrl.searchParams.set("is_active", "eq.true");
  const catsRes = await fetch(catsUrl, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
  });
  assert.equal(catsRes.status, 200);
  const categories = await catsRes.json();
  assert.ok(categories.length >= 1);
});

test("production edge functions respond", async () => {
  const trackRes = await fetch(`${API}/functions/v1/track-order?code=MF3D-00000000-INVALID1`, {
    headers: { apikey: KEY },
  });
  assert.ok([400, 404].includes(trackRes.status), `track-order status ${trackRes.status}`);

  const myOrdersRes = await fetch(`${API}/functions/v1/my-orders`, {
    headers: { apikey: KEY },
  });
  assert.equal(myOrdersRes.status, 401);

  const adminRes = await fetch(`${API}/functions/v1/admin-orders`, {
    headers: { apikey: KEY },
  });
  assert.equal(adminRes.status, 401);
});
