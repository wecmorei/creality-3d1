import { readFileSync, existsSync } from "node:fs";
import { writeFileSync } from "node:fs";

const SUPABASE_URL = "https://fmlqsivgffzjryilnjcj.supabase.co";
const PUBLISHABLE_KEY = "sb_publishable_BRjLzisbkSCzarxEWpZG7w_JI5y9GwM";

function loadEnv() {
  const path = new URL("../.env.local", import.meta.url);
  if (!existsSync(path)) throw new Error("Missing .env.local with LOGIN_USER_APPLICATION and LOGIN_PASSWORD_APPLICATION");
  const env = Object.fromEntries(
    readFileSync(path, "utf8")
      .split("\n")
      .filter((line) => line.includes("=") && !line.startsWith("#"))
      .map((line) => {
        const i = line.indexOf("=");
        return [line.slice(0, i), line.slice(i + 1)];
      }),
  );
  return env;
}

async function login(email, password) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: PUBLISHABLE_KEY },
    body: JSON.stringify({ email, password }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error_description ?? data.msg ?? "Login failed");
  return data.access_token;
}

async function fetchImageAsDataUrl(url) {
  const response = await fetch(url, {
    headers: { "User-Agent": "MiniForgeSeed/1.0" },
    redirect: "follow",
  });
  if (!response.ok) throw new Error(`Image download failed: ${url} (${response.status})`);
  const buffer = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get("content-type")?.includes("png") ? "image/png" : "image/jpeg";
  return `data:${contentType};base64,${buffer.toString("base64")}`;
}

async function saveProduct(token, payload) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/admin-products`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: PUBLISHABLE_KEY,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? `Save failed for ${payload.slug}`);
  return data.product;
}

const products = [
  {
    category_id: "59b0761a-c891-4e72-84c6-e88e0ce1cdcc",
    name: "Miniatura Dragão de Mesa",
    slug: "miniatura-dragao-de-mesa",
    short_description: "Dragão em escala 28mm para RPG, pronto para pintura com bom nível de detalhe.",
    description:
      "Miniatura impressa em resina de alta definição, ideal para campanhas de RPG e dioramas. Escala 28mm compatível com sistemas populares. Entrega sem pintura, com suporte de impressão removido e leve lixamento.",
    price_label: "A partir de R$ 89",
    starting_price_cents: 8900,
    lead_time_label: "5 a 8 dias",
    scale_label: "28mm (base 25mm)",
    finish_label: "Sem pintura, pronto para primer",
    is_featured: true,
    is_active: true,
    sort_order: 5,
    image_url: "https://picsum.photos/seed/miniforge-dragon/800/800",
  },
  {
    category_id: "73d7dba0-e91c-44c4-901a-853057efe62d",
    name: "Action Figure Herói Custom",
    slug: "action-figure-heroi-custom",
    short_description: "Figure personalizada a partir da sua referência, com pose e escala sob medida.",
    description:
      "Produzimos action figures exclusivas para colecionadores e fãs. Você envia referências (foto, arte ou descrição) e definimos escala, pose e acabamento. Opções: cor única, primer ou pintura básica.",
    price_label: "Sob orçamento",
    starting_price_cents: 18900,
    lead_time_label: "10 a 18 dias",
    scale_label: "15 a 30 cm",
    finish_label: "Primer ou pintura opcional",
    is_featured: true,
    is_active: true,
    sort_order: 6,
    image_url: "https://picsum.photos/seed/miniforge-hero/800/800",
  },
  {
    category_id: "eb8ff3cf-6a3f-4d59-8be0-a255e6f9473a",
    name: "Suporte Headset Gamer",
    slug: "suporte-headset-gamer",
    short_description: "Suporte ergonômico para fone, perfeito para setup gamer e home office.",
    description:
      "Peça decorativa funcional para organizar seu headset com estilo. Impressão em PLA premium com boa estabilidade. Disponível em várias cores — consulte disponibilidade no pedido.",
    price_label: "A partir de R$ 79",
    starting_price_cents: 7900,
    lead_time_label: "3 a 6 dias",
    scale_label: "18 x 10 x 22 cm",
    finish_label: "Cor sólida PLA",
    is_featured: true,
    is_active: true,
    sort_order: 7,
    image_url: "https://picsum.photos/seed/miniforge-headset/800/800",
  },
  {
    category_id: "e8db2a0f-0e0b-490f-9539-c7f8454b9c70",
    name: "Chaveiro Nome 3D",
    slug: "chaveiro-nome-3d",
    short_description: "Chaveiro personalizado com nome ou frase curta — ótimo para presente.",
    description:
      "Chaveiros impressos em 3D com o texto que você escolher (até 12 caracteres recomendados). Letra em relevo, acabamento liso e cores vibrantes. Ideal para brindes, lembrancinhas e presentes criativos.",
    price_label: "A partir de R$ 22",
    starting_price_cents: 2200,
    lead_time_label: "2 a 4 dias",
    scale_label: "4 a 6 cm",
    finish_label: "Cor única",
    is_featured: false,
    is_active: true,
    sort_order: 8,
    image_url: "https://picsum.photos/seed/miniforge-keychain/800/800",
  },
];

const env = loadEnv();
const token = await login(env.LOGIN_USER_APPLICATION, env.LOGIN_PASSWORD_APPLICATION);

const results = [];

for (const product of products) {
  const { image_url, ...fields } = product;
  console.log(`Cadastrando: ${fields.name}...`);
  const image_data_url = await fetchImageAsDataUrl(image_url);
  const saved = await saveProduct(token, { ...fields, image_data_url, image_alt: fields.name });
  results.push({ slug: saved.slug, id: saved.id });
  console.log(`  OK: ${saved.slug}`);
}

writeFileSync(new URL("../docs/seed-showcase-products.json", import.meta.url), JSON.stringify(results, null, 2));
console.log("\nConcluído:", results.length, "produtos cadastrados com foto.");
