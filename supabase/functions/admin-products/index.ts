const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function getEnv() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase environment variables");
  }

  return { supabaseUrl, serviceRoleKey };
}

function sanitizeText(value: unknown, maxLength: number) {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function sanitizeSlug(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 120);
}

async function supabaseRequest(path: string, init: RequestInit = {}) {
  const { supabaseUrl, serviceRoleKey } = getEnv();
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      ...init.headers,
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Supabase request failed: ${response.status} ${errorBody}`);
  }

  return response.status === 204 ? null : response.json();
}

async function getAuthenticatedUser(request: Request) {
  const token = request.headers.get("Authorization")?.replace("Bearer ", "");

  if (!token) {
    return null;
  }

  const { supabaseUrl, serviceRoleKey } = getEnv();
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${token}`,
    },
  });

  return response.ok ? response.json() : null;
}

async function requireAdmin(request: Request) {
  const user = await getAuthenticatedUser(request);

  if (!user?.id) {
    return null;
  }

  const query = new URLSearchParams({
    select: "user_id",
    user_id: `eq.${user.id}`,
    is_active: "eq.true",
    limit: "1",
  });
  const [admin] = await supabaseRequest(`admin_users?${query}`);

  return admin ? user : null;
}

async function listCatalog() {
  const categoriesQuery = new URLSearchParams({
    select: "id,name,slug,sort_order,is_active",
    order: "sort_order.asc,name.asc",
  });
  const productsQuery = new URLSearchParams({
    select:
      "id,category_id,name,slug,short_description,description,price_label,starting_price_cents,lead_time_label,scale_label,finish_label,is_featured,is_active,sort_order,categories(name),product_images(storage_path,alt_text,is_primary)",
    order: "sort_order.asc,name.asc",
  });

  const [categories, products] = await Promise.all([
    supabaseRequest(`categories?${categoriesQuery}`),
    supabaseRequest(`products?${productsQuery}`),
  ]);

  return { categories, products };
}

function buildProductPayload(payload: Record<string, unknown>) {
  const name = sanitizeText(payload.name, 160);
  const slug = sanitizeSlug(payload.slug || name);
  const categoryId = sanitizeText(payload.category_id, 80);
  const shortDescription = sanitizeText(payload.short_description, 500);
  const description = sanitizeText(payload.description, 4000);
  const priceLabel = sanitizeText(payload.price_label, 80);
  const leadTimeLabel = sanitizeText(payload.lead_time_label, 80);
  const scaleLabel = sanitizeText(payload.scale_label, 80);
  const finishLabel = sanitizeText(payload.finish_label, 80);
  const startingPriceCents = Number(payload.starting_price_cents || 0);

  if (!name || !slug || !categoryId || !shortDescription || !priceLabel || !leadTimeLabel || !scaleLabel || !finishLabel) {
    return null;
  }

  return {
    category_id: categoryId,
    name,
    slug,
    short_description: shortDescription,
    description: description || shortDescription,
    price_label: priceLabel,
    starting_price_cents: Number.isFinite(startingPriceCents) && startingPriceCents > 0 ? startingPriceCents : null,
    lead_time_label: leadTimeLabel,
    scale_label: scaleLabel,
    finish_label: finishLabel,
    is_featured: Boolean(payload.is_featured),
    is_active: payload.is_active !== false,
    sort_order: Number(payload.sort_order || 0),
  };
}

async function uploadProductImage(productId: string, imageDataUrl: string, altText: string) {
  const match = String(imageDataUrl).match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/i);

  if (!match) {
    throw new Error("Formato de imagem inválido.");
  }

  const contentType = match[1].toLowerCase();
  const binary = Uint8Array.from(atob(match[2]), (char) => char.charCodeAt(0));
  const extension = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
  const storagePath = `${productId}/${crypto.randomUUID()}.${extension}`;
  const { supabaseUrl, serviceRoleKey } = getEnv();

  const uploadResponse = await fetch(`${supabaseUrl}/storage/v1/object/product-images/${storagePath}`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": contentType,
      "x-upsert": "true",
    },
    body: binary,
  });

  if (!uploadResponse.ok) {
    const errorBody = await uploadResponse.text();
    throw new Error(`Upload failed: ${uploadResponse.status} ${errorBody}`);
  }

  await supabaseRequest(`product_images?product_id=eq.${productId}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ is_primary: false }),
  });

  await supabaseRequest("product_images", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      product_id: productId,
      storage_path: storagePath,
      alt_text: altText || "Produto MiniForge 3D",
      is_primary: true,
      sort_order: 0,
    }),
  });

  return storagePath;
}

async function saveProduct(payload: Record<string, unknown>) {
  const product = buildProductPayload(payload);

  if (!product) {
    return jsonResponse({ error: "Dados do produto inválidos." }, 400);
  }

  const id = sanitizeText(payload.id, 80);
  const imageDataUrl = typeof payload.image_data_url === "string" ? payload.image_data_url : "";
  const imageAlt = sanitizeText(payload.image_alt || product.name, 160);

  let savedProduct;

  if (id) {
    const [updated] = await supabaseRequest(`products?id=eq.${id}&select=id,slug`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(product),
    });
    savedProduct = updated;
  } else {
    const [created] = await supabaseRequest("products?select=id,slug", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(product),
    });
    savedProduct = created;
  }

  if (imageDataUrl && savedProduct?.id) {
    await uploadProductImage(savedProduct.id, imageDataUrl, imageAlt);
  }

  return jsonResponse({ product: savedProduct }, id ? 200 : 201);
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const admin = await requireAdmin(request);

    if (!admin) {
      return jsonResponse({ error: "Acesso não autorizado." }, 401);
    }

    if (request.method === "GET") {
      return jsonResponse(await listCatalog());
    }

    if (request.method === "POST") {
      return saveProduct(await request.json());
    }

    return jsonResponse({ error: "Method not allowed" }, 405);
  } catch (error) {
    console.error(error);
    return jsonResponse({ error: "Não foi possível processar produto." }, 500);
  }
});
