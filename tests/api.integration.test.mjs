import test from "node:test";
import assert from "node:assert/strict";

const API = "https://fmlqsivgffzjryilnjcj.supabase.co";
const KEY = "sb_publishable_BRjLzisbkSCzarxEWpZG7w_JI5y9GwM";

test("catalog order registers with product slug", async () => {
  const response = await fetch(`${API}/functions/v1/create-order`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: KEY },
    body: JSON.stringify({
      type: "catalog",
      consent: true,
      customer: { name: "QA Integration", phone: "11999997777" },
      product: { slug: "miniatura-de-mesa", notes: "Teste integração API" },
    }),
  });

  const data = await response.json();
  assert.equal(response.status, 200);
  assert.match(data.public_code, /^MF3D-\d{8}-[A-Z0-9]{8}$/);
  assert.equal(data.type, "catalog");
});

test("track order returns human-readable flow without PII", async () => {
  const create = await fetch(`${API}/functions/v1/create-order`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: KEY },
    body: JSON.stringify({
      type: "quote",
      consent: true,
      customer: { name: "QA Track", phone: "11999998888" },
      item: {
        category: "Miniatura",
        size: "Pequeno, até 8 cm",
        description: "Pedido para validar rastreamento na integração.",
      },
    }),
  });
  const created = await create.json();
  assert.ok(created.public_code);

  const track = await fetch(`${API}/functions/v1/track-order?code=${created.public_code}`, {
    headers: { apikey: KEY },
  });
  const order = await track.json();
  assert.equal(track.status, 200);
  assert.equal(order.public_code, created.public_code);
  assert.ok(order.status);
  assert.ok(order.payment_status);
  assert.equal(order.full_name, undefined);
});

test("cart order registers multiple items", async () => {
  const response = await fetch(`${API}/functions/v1/create-order`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: KEY },
    body: JSON.stringify({
      type: "cart",
      consent: true,
      customer: { name: "QA Carrinho", phone: "11999996666" },
      items: [
        { slug: "chaveiro-nome-3d", quantity: 2, notes: "Nome: WES" },
        { slug: "suporte-headset-gamer", quantity: 1 },
      ],
    }),
  });

  const data = await response.json();
  assert.equal(response.status, 200);
  assert.match(data.public_code, /^MF3D-/);
  assert.equal(data.type, "cart");
  assert.equal(data.item_count, 2);
  assert.ok(data.subtotal_cents > 0);

  const track = await fetch(`${API}/functions/v1/track-order?code=${data.public_code}`, {
    headers: { apikey: KEY },
  });
  const order = await track.json();
  assert.equal(order.items.length, 2);
});

test("my-orders requires authentication", async () => {
  const response = await fetch(`${API}/functions/v1/my-orders`, {
    headers: { apikey: KEY },
  });
  const data = await response.json();
  assert.equal(response.status, 401);
  assert.match(data.error, /login/i);
});

test("products API returns active catalog with categories", async () => {
  const url = new URL(`${API}/rest/v1/products`);
  url.searchParams.set(
    "select",
    "slug,name,is_active,categories(slug),product_images(storage_path,is_primary)",
  );
  url.searchParams.set("is_active", "eq.true");
  url.searchParams.set("limit", "3");

  const response = await fetch(url, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
  });
  assert.equal(response.status, 200);
  const rows = await response.json();
  assert.ok(rows.length > 0);
  assert.ok(rows[0].slug);
});
