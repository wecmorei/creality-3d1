import { writeFile } from "node:fs/promises";
import { readFile } from "node:fs/promises";

const siteOrigin = "https://miniforge.btencacorretora.com";
const supabaseUrl = "https://fmlqsivgffzjryilnjcj.supabase.co";

async function loadPublishableKey() {
  if (process.env.SUPABASE_PUBLISHABLE_KEY) return process.env.SUPABASE_PUBLISHABLE_KEY;

  try {
    const env = await readFile(new URL("../.env.local", import.meta.url), "utf8");
    const match = env.match(/^SUPABASE_PUBLISHABLE_KEY=(.+)$/m);
    if (match) return match[1].trim();
  } catch {
    /* fallback from store */
  }

  const store = await readFile(new URL("../store-common.js", import.meta.url), "utf8");
  const keyMatch = store.match(/publishableKey:\s*"([^"]+)"/);
  if (keyMatch) return keyMatch[1];
  throw new Error("Defina SUPABASE_PUBLISHABLE_KEY ou use store-common.js com publishableKey.");
}

const staticPaths = [
  "/",
  "/catalogo.html",
  "/carrinho.html",
  "/minha-conta.html",
  "/acompanhar.html",
  "/como-funciona.html",
  "/faq.html",
  "/frete.html",
  "/privacidade.html",
];

async function fetchProductSlugs(key) {
  const endpoint = new URL(`${supabaseUrl}/rest/v1/products`);
  endpoint.searchParams.set("select", "slug,updated_at");
  endpoint.searchParams.set("is_active", "eq.true");
  endpoint.searchParams.set("order", "slug.asc");

  const response = await fetch(endpoint, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Supabase products failed: ${response.status}`);
  }

  return response.json();
}

function formatUrl(path, lastmod) {
  const loc = `${siteOrigin}${path.startsWith("/") ? path : `/${path}`}`;
  const lastmodTag = lastmod ? `\n    <lastmod>${lastmod.slice(0, 10)}</lastmod>` : "";
  return `  <url>\n    <loc>${loc}</loc>${lastmodTag}\n  </url>`;
}

async function main() {
  const key = await loadPublishableKey();
  const products = await fetchProductSlugs(key);

  const urls = [
    ...staticPaths.map((path) => formatUrl(path)),
    ...products.map((product) => {
      const path = `/produto.html?slug=${encodeURIComponent(product.slug)}`;
      const lastmod = product.updated_at ?? product.created_at;
      return formatUrl(path, lastmod);
    }),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>
`;

  const out = new URL("../sitemap.xml", import.meta.url);
  await writeFile(out, xml, "utf8");
  console.log(`sitemap.xml gerado com ${staticPaths.length} páginas estáticas e ${products.length} produtos.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
