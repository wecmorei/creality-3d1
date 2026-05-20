import { readFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("public pages load required scripts and sections", async () => {
  const index = await read("index.html");
  const catalogo = await read("catalogo.html");
  const produto = await read("produto.html");
  const admin = await read("admin.html");

  assert.match(index, /id="bestseller-grid"/);
  assert.match(index, /href="acompanhar\.html"/);
  assert.doesNotMatch(index, /id="tracking-form"/);
  assert.match(index, /href="personalizado\.html"/);

  const personalizado = await read("personalizado.html");
  assert.match(personalizado, /id="quote-form"/);
  assert.match(personalizado, /id="quote-references"/);
  assert.match(personalizado, /Busto 3D a partir de foto/);
  assert.match(personalizado, /personalizado\.js/);
  assert.match(index, /site-config\.js/);
  assert.match(index, /store-common\.js(\?v=[^"]+)?/);
  assert.match(index, /styles\.css(\?v=[^"]+)?/);
  assert.match(index, /site-layout\.js/);
  assert.match(index, /id="site-chrome-header"/);
  assert.match(index, /portfolio-grid/);
  assert.match(index, /testimonial-grid/);

  const termos = await read("termos.html");
  assert.match(termos, /Termos de venda/);
  assert.match(termos, /acompanhar\.html/);
  assert.match(index, /script src="\.\/script\.js(\?v=[^"]+)?"/);
  assert.match(catalogo, /id="catalog-product-grid"/);
  assert.match(catalogo, /cart\.js/);

  const carrinho = await read("carrinho.html");
  assert.match(carrinho, /id="cart-checkout-form"/);
  assert.match(carrinho, /cart\.js/);
  assert.match(carrinho, /customer-orders\.js/);

  const minhaConta = await read("minha-conta.html");
  const acompanhar = await read("acompanhar.html");
  assert.match(minhaConta, /id="my-orders-list"/);
  assert.match(minhaConta, /customer-orders\.js/);
  assert.match(minhaConta, /customer-auth\.js/);
  assert.match(minhaConta, /customer-login-form/);
  assert.match(minhaConta, /data-account-tab="local"/);
  assert.match(minhaConta, /data-oauth="google"/);

  const pedidoOk = await read("pedido-registrado.html");
  assert.match(pedidoOk, /id="order-success-card"/);
  assert.match(pedidoOk, /pedido-registrado\.js/);
  assert.match(minhaConta, /data-oauth="facebook"/);
  assert.match(minhaConta, /data-oauth="apple"/);
  assert.match(acompanhar, /id="tracking-form"/);

  assert.match(produto, /id="product-root"/);
  assert.match(produto, /produto\.js/);
  assert.match(admin, /id="admin-login-form"/);
  assert.match(admin, /name="image_file"/);
});

test("institutional pages exist", async () => {
  for (const page of ["privacidade.html", "faq.html", "como-funciona.html", "frete.html"]) {
    const html = await read(page);
    assert.match(html, /<main/);
    assert.match(html, /privacidade|FAQ|funciona|Frete/i);
  }
});

test("footer keeps FAQ and frete links outside header menu", async () => {
  const layout = await read("site-layout.js");
  assert.match(layout, /href="faq\.html">FAQ<\/a>/);
  assert.match(layout, /href="frete\.html">Frete e prazos<\/a>/);
  const navBlock = layout.slice(layout.indexOf("NAV_ITEMS"), layout.indexOf("PAGE_IDS"));
  assert.doesNotMatch(navBlock, /faq\.html/);
  assert.doesNotMatch(navBlock, /frete\.html/);
});

test("security headers allow expected external services", async () => {
  const htaccess = await read(".htaccess");

  assert.match(htaccess, /X-Content-Type-Options "nosniff"/);
  assert.match(htaccess, /frame-ancestors 'none'/);
  assert.match(htaccess, /connect-src 'self' https:\/\/fmlqsivgffzjryilnjcj\.supabase\.co/);
  assert.match(htaccess, /script-src 'self' https:\/\/cdn\.jsdelivr\.net https:\/\/plausible\.io/);
  assert.match(htaccess, /connect-src[^;]*https:\/\/plausible\.io/);
  assert.match(htaccess, /fmlqsivgffzjryilnjcj\.supabase\.co/);
});

test("public frontend does not expose service role keys", async () => {
  const files = await Promise.all([
    read("index.html"),
    read("store-common.js"),
    read("script.js"),
    read("produto.js"),
    read("admin.js"),
  ]);

  for (const content of files) {
    assert.doesNotMatch(content, /service_role/i);
    assert.doesNotMatch(content, /SUPABASE_SERVICE_ROLE_KEY/);
  }
});

test("site layout uses flat nav without help dropdown", async () => {
  const layout = await read("site-layout.js");
  assert.match(layout, /NAV_ITEMS/);
  assert.match(layout, /header-nav/);
  assert.match(layout, /minha-conta\.html/);
  assert.match(layout, /acompanhar\.html/);
  assert.doesNotMatch(layout, /NAV_HELP/);
  assert.doesNotMatch(layout, /nav-help/);
});

test("store-common exposes customer order helpers", async () => {
  const store = await read("store-common.js");
  assert.match(store, /renderTrackingHtml/);
  assert.match(store, /rememberCustomerOrder/);
  assert.match(store, /setupTrackingForm/);
  assert.match(store, /uploadQuoteReferences/);
  assert.match(store, /redirectToOrderSuccess/);
  assert.match(store, /renderProductPriceBadge/);
  assert.match(store, /hasDirectPurchasePrice/);
  assert.match(store, /isFeatureEnabled/);
  assert.match(store, /loadStoreCatalog/);
  assert.match(store, /FETCH_TIMEOUT_MS/);
});

test("site-config exposes feature flags", async () => {
  const config = await read("site-config.js");
  assert.match(config, /socialLoginEnabled/);
  assert.match(config, /mercadoPagoEnabled/);
  assert.match(config, /assets/);
});

test("customer auth supports social providers", async () => {
  const auth = await read("customer-auth.js");
  assert.match(auth, /signInWithOAuth/);
  assert.match(auth, /google/);
  assert.match(auth, /facebook/);
  assert.match(auth, /apple/);
});

test("admin supports order filters and payment status", async () => {
  const adminHtml = await read("admin.html");
  const adminJs = await read("admin.js");
  const adminApi = await read("supabase/functions/admin-orders/index.ts");
  assert.match(adminHtml, /admin-order-filters/);
  assert.match(adminHtml, /com_fotos/);
  assert.match(adminHtml, /admin-tab-customers/);
  assert.match(adminJs, /payment_status/);
  assert.match(adminApi, /payment_status/);
  assert.match(adminApi, /order_events/);
  assert.match(adminApi, /has_more/);
  assert.match(adminHtml, /export-orders-csv/);
  assert.match(adminJs, /notify_email/);
});

test("phase 2 edge functions exist", async () => {
  assert.ok(await read("supabase/functions/my-orders/index.ts"));
  assert.ok(await read("supabase/functions/link-orders/index.ts"));
  assert.ok(await read("supabase/functions/upload-quote-references/index.ts"));
  const migration = await read("supabase/migrations/0006_customer_auth.sql");
  assert.match(migration, /auth_user_id/);
});

test("store-common exposes analytics and social meta helpers", async () => {
  const store = await read("store-common.js");
  assert.match(store, /setSocialMeta/);
  assert.match(store, /initAnalytics/);
  assert.match(store, /pickHomeProducts/);
});

test("create-order supports catalog and consent", async () => {
  const createOrder = await read("supabase/functions/create-order/index.ts");

  assert.match(createOrder, /consent/);
  assert.match(createOrder, /catalog/);
  assert.match(createOrder, /"cart"/);
  assert.match(createOrder, /product_id/);
});
