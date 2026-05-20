import test from "node:test";
import assert from "node:assert/strict";

const SUPABASE_URL = "https://fmlqsivgffzjryilnjcj.supabase.co";
const PUBLISHABLE_KEY = "sb_publishable_BRjLzisbkSCzarxEWpZG7w_JI5y9GwM";

test("catalog has 10 active products and all have photos", async () => {
  const endpoint = new URL(`${SUPABASE_URL}/rest/v1/products`);
  endpoint.searchParams.set("select", "slug,is_active,product_images(storage_path)");
  endpoint.searchParams.set("is_active", "eq.true");

  const response = await fetch(endpoint, {
    headers: {
      apikey: PUBLISHABLE_KEY,
      Authorization: `Bearer ${PUBLISHABLE_KEY}`,
    },
  });

  assert.equal(response.status, 200);
  const products = await response.json();
  assert.equal(products.length, 10, `expected 10 active products, got ${products.length}`);

  const withoutPhoto = products.filter((p) => !p.product_images?.length);
  assert.equal(
    withoutPhoto.length,
    0,
    `products without photo: ${withoutPhoto.map((p) => p.slug).join(", ")}`,
  );
});
