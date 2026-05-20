type QuoteItem = {
  category?: string;
  size?: string;
  description?: string;
};

type CatalogProduct = {
  slug?: string;
  notes?: string;
};

type CartLine = {
  slug?: string;
  quantity?: number;
  notes?: string;
};

type OrderPayload = {
  type?: "quote" | "catalog" | "cart";
  consent?: boolean;
  customer?: {
    name?: string;
    phone?: string;
    email?: string;
  };
  item?: QuoteItem;
  product?: CatalogProduct;
  items?: CartLine[];
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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

function sanitizeText(value: unknown, maxLength: number) {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function createPublicCode() {
  const stamp = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const suffix = crypto.randomUUID().slice(0, 8).toUpperCase();
  return `MF3D-${stamp}-${suffix}`;
}

async function supabaseRequest(path: string, init: RequestInit) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase environment variables");
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      Prefer: "return=representation",
      ...init.headers,
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Supabase request failed: ${response.status} ${errorBody}`);
  }

  return response.json();
}

async function findProductBySlug(slug: string) {
  const query = new URLSearchParams({
    select:
      "id,name,slug,short_description,price_label,starting_price_cents,lead_time_label,scale_label,finish_label,categories(name)",
    slug: `eq.${slug}`,
    is_active: "eq.true",
    limit: "1",
  });
  const [product] = await supabaseRequest(`products?${query}`, { method: "GET" });
  return product ?? null;
}

function clampQuantity(value: unknown) {
  const qty = Number(value);
  if (!Number.isFinite(qty) || qty < 1) return 1;
  return Math.min(Math.round(qty), 99);
}

async function getAuthenticatedUser(request: Request) {
  const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: serviceRoleKey!, Authorization: `Bearer ${token}` },
  });
  if (!response.ok) return null;
  return response.json();
}

async function resolveCustomer(
  name: string,
  phone: string,
  email: string,
  authUser: { id: string; email?: string } | null,
) {
  if (authUser?.id) {
    const linkedQuery = new URLSearchParams({
      select: "id",
      auth_user_id: `eq.${authUser.id}`,
      limit: "1",
    });
    const [existing] = await supabaseRequest(`customers?${linkedQuery}`, { method: "GET" });

    if (existing) {
      await supabaseRequest(`customers?id=eq.${existing.id}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          full_name: name,
          phone,
          email: email || authUser.email || null,
        }),
      });
      return existing;
    }
  }

  const [customer] = await supabaseRequest("customers", {
    method: "POST",
    body: JSON.stringify({
      full_name: name,
      phone,
      email: email || authUser?.email || null,
      auth_user_id: authUser?.id ?? null,
    }),
  });

  return customer;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const payload = (await request.json()) as OrderPayload;

    if (!payload.consent) {
      return jsonResponse({ error: "É necessário aceitar a política de privacidade." }, 400);
    }

    const name = sanitizeText(payload.customer?.name, 120);
    const phone = sanitizeText(payload.customer?.phone, 40);
    const email = sanitizeText(payload.customer?.email, 160);
    const orderType = payload.type === "cart" ? "cart" : payload.type === "catalog" ? "catalog" : "quote";

    if (!name || !phone) {
      return jsonResponse({ error: "Nome e WhatsApp são obrigatórios." }, 400);
    }

    const authUser = await getAuthenticatedUser(request);
    const customer = await resolveCustomer(name, phone, email, authUser);

    const publicCode = createPublicCode();
    let orderNotes = "Pedido solicitado pelo site.";
    const orderItems: Record<string, unknown>[] = [];

    if (orderType === "cart") {
      const lines = Array.isArray(payload.items) ? payload.items : [];

      if (!lines.length) {
        return jsonResponse({ error: "Carrinho vazio." }, 400);
      }

      let subtotalCents = 0;

      for (const line of lines) {
        const slug = sanitizeText(line.slug, 120).toLowerCase();
        if (!slug) continue;

        const product = await findProductBySlug(slug);
        if (!product) {
          return jsonResponse({ error: `Produto não encontrado: ${slug}` }, 404);
        }

        const quantity = clampQuantity(line.quantity);
        const notes = sanitizeText(line.notes, 500);
        const unitPrice = product.starting_price_cents ?? null;

        if (unitPrice && unitPrice > 0) {
          subtotalCents += unitPrice * quantity;
        }

        orderItems.push({
          order_id: null,
          product_id: product.id,
          product_name: product.name,
          quantity,
          unit_price_cents: unitPrice,
          scale_label: product.scale_label,
          finish_label: product.finish_label,
          customization_notes: notes || product.short_description,
        });
      }

      if (!orderItems.length) {
        return jsonResponse({ error: "Nenhum item válido no carrinho." }, 400);
      }

      orderNotes = `Pedido do carrinho com ${orderItems.length} item(ns). Valor estimado no site; confirmação final pelo WhatsApp.`;
    } else if (orderType === "catalog") {
      const slug = sanitizeText(payload.product?.slug, 120).toLowerCase();
      const notes = sanitizeText(payload.product?.notes, 500);

      if (!slug) {
        return jsonResponse({ error: "Produto inválido." }, 400);
      }

      const product = await findProductBySlug(slug);

      if (!product) {
        return jsonResponse({ error: "Produto não encontrado." }, 404);
      }

      orderNotes = `Compra do catálogo: ${product.name}. ${notes ? `Observações: ${notes}` : ""}`.trim();
      orderItems.push({
        order_id: null,
        product_id: product.id,
        product_name: product.name,
        quantity: 1,
        unit_price_cents: product.starting_price_cents ?? null,
        scale_label: product.scale_label,
        finish_label: product.finish_label,
        customization_notes: notes || product.short_description,
      });
    } else {
      const category = sanitizeText(payload.item?.category, 80);
      const size = sanitizeText(payload.item?.size, 80);
      const description = sanitizeText(payload.item?.description, 1200);

      if (!category || !size || description.length < 10) {
        return jsonResponse({ error: "Dados obrigatórios inválidos." }, 400);
      }

      orderNotes = `Orçamento personalizado. Categoria: ${category}. Tamanho: ${size}.`;
      orderItems.push({
        order_id: null,
        product_name: category,
        quantity: 1,
        scale_label: size,
        customization_notes: description,
      });
    }

    const subtotalCents =
      orderType === "cart"
        ? orderItems.reduce((sum, item) => {
            const unit = item.unit_price_cents as number | null;
            const qty = item.quantity as number;
            return unit && unit > 0 ? sum + unit * qty : sum;
          }, 0)
        : orderType === "catalog"
          ? (orderItems[0]?.unit_price_cents as number) ?? 0
          : 0;

    const [order] = await supabaseRequest("orders", {
      method: "POST",
      body: JSON.stringify({
        customer_id: customer.id,
        public_code: publicCode,
        status: "quote_requested",
        payment_status: "pending",
        subtotal_cents: subtotalCents,
        shipping_cents: 0,
        total_cents: subtotalCents,
        notes: orderNotes,
      }),
    });

    for (const item of orderItems) {
      item.order_id = order.id;
      await supabaseRequest("order_items", {
        method: "POST",
        body: JSON.stringify(item),
      });
    }

    const eventMessage =
      orderType === "cart"
        ? `Carrinho com ${orderItems.length} item(ns) registrado. Aguardando confirmação de valores e pagamento.`
        : orderType === "catalog"
          ? "Pedido do catálogo registrado. Aguardando confirmação de valores e pagamento."
          : "Pedido registrado pelo site e aguardando orçamento.";

    await supabaseRequest("order_events", {
      method: "POST",
      body: JSON.stringify({
        order_id: order.id,
        status: "quote_requested",
        message: eventMessage,
      }),
    });

    return jsonResponse({
      id: order.id,
      public_code: publicCode,
      status: order.status,
      type: orderType,
      subtotal_cents: subtotalCents,
      item_count: orderItems.length,
    });
  } catch (error) {
    console.error(error);
    return jsonResponse({ error: "Não foi possível registrar o pedido." }, 500);
  }
});
