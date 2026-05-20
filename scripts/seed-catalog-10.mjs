/**
 * Atualiza os 10 produtos ativos do catálogo: fotos, descrições, destaques e ordem.
 * Uso: node scripts/seed-catalog-10.mjs
 */
import { readFileSync, existsSync, writeFileSync } from "node:fs";

const SUPABASE_URL = "https://fmlqsivgffzjryilnjcj.supabase.co";
const PUBLISHABLE_KEY = "sb_publishable_BRjLzisbkSCzarxEWpZG7w_JI5y9GwM";

const CATEGORIES = {
  "action-figures": "73d7dba0-e91c-44c4-901a-853057efe62d",
  "miniaturas-rpg": "59b0761a-c891-4e72-84c6-e88e0ce1cdcc",
  "decoracao-geek": "eb8ff3cf-6a3f-4d59-8be0-a255e6f9473a",
  "brindes-chaveiros": "e8db2a0f-0e0b-490f-9539-c7f8454b9c70",
  "pecas-tecnicas": "4641cc41-52fd-4643-88ad-0f3028675237",
};

function loadEnv() {
  const path = new URL("../.env.local", import.meta.url);
  if (!existsSync(path)) throw new Error("Missing .env.local");
  return Object.fromEntries(
    readFileSync(path, "utf8")
      .split("\n")
      .filter((line) => line.includes("=") && !line.startsWith("#"))
      .map((line) => {
        const i = line.indexOf("=");
        return [line.slice(0, i), line.slice(i + 1)];
      }),
  );
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

async function listProducts(token) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/admin-products`, {
    headers: { apikey: PUBLISHABLE_KEY, Authorization: `Bearer ${token}` },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "List failed");
  return data.products ?? [];
}

async function fetchImageAsDataUrl(url) {
  const response = await fetch(url, { headers: { "User-Agent": "MiniForgeSeed/1.0" }, redirect: "follow" });
  if (!response.ok) throw new Error(`Image failed ${url}: ${response.status}`);
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
  if (!response.ok) throw new Error(data.error ?? `Save failed: ${payload.slug}`);
  return data.product;
}

/** Catálogo vitrine — 10 produtos ativos com foto */
const CATALOG = [
  {
    slug: "miniatura-dragao-de-mesa",
    category_id: CATEGORIES["miniaturas-rpg"],
    name: "Miniatura Dragão de Mesa",
    short_description: "Dragão em escala 28mm para RPG, pronto para pintura com bom nível de detalhe.",
    description:
      "Miniatura impressa em resina de alta definição para campanhas de RPG e dioramas. Escala 28mm, base 25mm. Entrega sem pintura, suporte removido.",
    price_label: "A partir de R$ 89",
    starting_price_cents: 8900,
    lead_time_label: "5 a 8 dias",
    scale_label: "28mm (base 25mm)",
    finish_label: "Sem pintura, pronto para primer",
    is_featured: true,
    sort_order: 1,
    image_seed: "mf-dragon",
  },
  {
    slug: "miniatura-de-mesa",
    category_id: CATEGORIES["miniaturas-rpg"],
    name: "Miniatura Guerreiro RPG",
    short_description: "Guerreiro em resina para mesa, ideal para campanhas e dioramas.",
    description:
      "Miniatura de herói em escala de mesa, detalhes nítidos para pintura. Compatível com bases padrão. Acabamento sem pintura ou com primer sob consulta.",
    price_label: "A partir de R$ 39",
    starting_price_cents: 3900,
    lead_time_label: "3 a 7 dias",
    scale_label: "3 a 8 cm",
    finish_label: "Sem pintura ou primer",
    is_featured: true,
    sort_order: 2,
    image_seed: "mf-warrior",
  },
  {
    slug: "action-figure-heroi-custom",
    category_id: CATEGORIES["action-figures"],
    name: "Action Figure Herói Custom",
    short_description: "Figure personalizada a partir da sua referência, com pose e escala sob medida.",
    description:
      "Action figure exclusiva para colecionadores. Envie referências e definimos escala, pose e acabamento: cor única, primer ou pintura básica.",
    price_label: "Sob orçamento",
    starting_price_cents: 18900,
    lead_time_label: "10 a 18 dias",
    scale_label: "15 a 30 cm",
    finish_label: "Primer ou pintura opcional",
    is_featured: true,
    sort_order: 3,
    image_seed: "mf-hero",
  },
  {
    slug: "action-figure-personalizada",
    category_id: CATEGORIES["action-figures"],
    name: "Action Figure Personalizada",
    short_description: "Figure feita a partir de referência, com escala e acabamento definidos no orçamento.",
    description:
      "Produção sob medida para colecionadores e fãs. Trabalhamos com foto, arte ou descrição. Prazo e valor confirmados no WhatsApp com código MF3D.",
    price_label: "Sob orçamento",
    starting_price_cents: 14900,
    lead_time_label: "7 a 15 dias",
    scale_label: "12 a 25 cm",
    finish_label: "Primer ou pintura",
    is_featured: true,
    sort_order: 4,
    image_seed: "mf-figure",
  },
  {
    slug: "suporte-headset-gamer",
    category_id: CATEGORIES["decoracao-geek"],
    name: "Suporte Headset Gamer",
    short_description: "Suporte ergonômico para fone — ideal para setup gamer e home office.",
    description:
      "Peça funcional e decorativa em PLA premium. Estabilidade para headsets grandes. Cores disponíveis sob consulta no pedido.",
    price_label: "A partir de R$ 79",
    starting_price_cents: 7900,
    lead_time_label: "3 a 6 dias",
    scale_label: "18 x 10 x 22 cm",
    finish_label: "Cor sólida PLA",
    is_featured: true,
    sort_order: 5,
    image_seed: "mf-headset",
  },
  {
    slug: "decoracao-geek",
    category_id: CATEGORIES["decoracao-geek"],
    name: "Luminária Geek Moon",
    short_description: "Luminária decorativa para setup e estante — visual impactante.",
    description:
      "Peça decorativa impressa em 3D para quarto, escritório ou estante colecionável. Acabamento em cor única ou pintura conforme orçamento.",
    price_label: "A partir de R$ 59",
    starting_price_cents: 5900,
    lead_time_label: "5 a 10 dias",
    scale_label: "12 a 18 cm",
    finish_label: "Cor única ou pintura",
    is_featured: true,
    sort_order: 6,
    image_seed: "mf-lamp",
  },
  {
    slug: "chaveiro-nome-3d",
    category_id: CATEGORIES["brindes-chaveiros"],
    name: "Chaveiro Nome 3D",
    short_description: "Chaveiro personalizado com nome ou frase curta — ótimo para presente.",
    description:
      "Texto em relevo até 12 caracteres recomendados. Cores vibrantes, acabamento liso. Ideal para brindes e lembrancinhas.",
    price_label: "A partir de R$ 22",
    starting_price_cents: 2200,
    lead_time_label: "2 a 4 dias",
    scale_label: "4 a 6 cm",
    finish_label: "Cor única",
    is_featured: false,
    sort_order: 7,
    image_seed: "mf-keychain",
  },
  {
    slug: "chaveiros-e-lembrancas",
    category_id: CATEGORIES["brindes-chaveiros"],
    name: "Kit Chaveiros Evento (5 un.)",
    short_description: "Kit com 5 chaveiros personalizados para festas, empresas e lembrancinhas.",
    description:
      "Pacote promocional para eventos. Mesmo modelo com variação de nome ou cor. Consulte prazo para quantidades maiores.",
    price_label: "A partir de R$ 65",
    starting_price_cents: 6500,
    lead_time_label: "4 a 7 dias",
    scale_label: "4 a 6 cm cada",
    finish_label: "Cor única",
    is_featured: false,
    sort_order: 8,
    image_seed: "mf-gift",
  },
  {
    slug: "pecas-tecnicas",
    category_id: CATEGORIES["pecas-tecnicas"],
    name: "Suporte de Bobina Filamento",
    short_description: "Suporte funcional para bobina de filamento — impressão 3D utilitária.",
    description:
      "Peça técnica avaliada conforme medidas e uso. Prototipagem e peças de reposição sob encomenda. Material e resistência definidos no orçamento.",
    price_label: "A partir de R$ 45",
    starting_price_cents: 4500,
    lead_time_label: "3 a 8 dias",
    scale_label: "Conforme medidas",
    finish_label: "Funcional PLA/PETG",
    is_featured: false,
    sort_order: 9,
    image_seed: "mf-spool",
  },
  {
    slug: "kit-pintura",
    category_id: CATEGORIES["action-figures"],
    name: "Busto para Pintura",
    short_description: "Busto sem pintura para treino e customização de colecionáveis.",
    description:
      "Peça lisa ou com primer para hobby de pintura. Escala média para prática de técnicas. Ótimo para quem quer customizar a própria coleção.",
    price_label: "A partir de R$ 55",
    starting_price_cents: 5500,
    lead_time_label: "5 a 12 dias",
    scale_label: "10 a 15 cm",
    finish_label: "Sem pintura",
    is_featured: false,
    sort_order: 10,
    image_seed: "mf-bust",
  },
];

const env = loadEnv();
const token = await login(env.LOGIN_USER_APPLICATION, env.LOGIN_PASSWORD_APPLICATION);
const existing = await listProducts(token);
const bySlug = Object.fromEntries(existing.map((p) => [p.slug, p]));

const results = [];

for (const item of CATALOG) {
  const current = bySlug[item.slug];
  if (!current) {
    console.warn(`Ignorado (não encontrado): ${item.slug}`);
    continue;
  }

  const { image_seed, ...fields } = item;
  console.log(`Atualizando: ${fields.name}...`);

  const image_data_url = await fetchImageAsDataUrl(`https://picsum.photos/seed/${image_seed}/800/800`);

  const saved = await saveProduct(token, {
    id: current.id,
    ...fields,
    is_active: true,
    image_data_url,
    image_alt: fields.name,
  });

  results.push({ slug: saved.slug, id: saved.id, featured: fields.is_featured });
  console.log(`  OK (${image_seed})`);
}

writeFileSync(new URL("../docs/catalog-10-seed.json", import.meta.url), JSON.stringify(results, null, 2));
console.log(`\nConcluído: ${results.length}/10 produtos atualizados com foto.`);
