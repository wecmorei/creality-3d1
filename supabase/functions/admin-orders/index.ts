const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, PATCH, OPTIONS",
};

const allowedStatuses = new Set([
  "quote_requested",
  "quoted",
  "awaiting_payment",
  "paid",
  "in_production",
  "ready",
  "shipped",
  "completed",
  "cancelled",
]);

const allowedPaymentStatuses = new Set([
  "pending",
  "authorized",
  "paid",
  "failed",
  "refunded",
  "cancelled",
]);

const statusLabels: Record<string, string> = {
  quote_requested: "Orçamento solicitado",
  quoted: "Orçamento enviado",
  awaiting_payment: "Aguardando pagamento",
  paid: "Pagamento confirmado",
  in_production: "Em produção",
  ready: "Pronto",
  shipped: "Enviado",
  completed: "Concluído",
  cancelled: "Cancelado",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getEnv() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) throw new Error("Missing Supabase environment variables");
  return { supabaseUrl, serviceRoleKey };
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
  const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { supabaseUrl, serviceRoleKey } = getEnv();
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${token}` },
  });
  if (!response.ok) return null;
  return response.json();
}

async function requireAdmin(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user?.id) return null;
  const query = new URLSearchParams({
    select: "user_id,email,is_active",
    user_id: `eq.${user.id}`,
    is_active: "eq.true",
    limit: "1",
  });
  const [admin] = await supabaseRequest(`admin_users?${query}`);
  return admin ? user : null;
}

function buildOrdersQuery(url: URL, forCount = false) {
  const status = String(url.searchParams.get("status") ?? "").trim();
  const search = String(url.searchParams.get("q") ?? "").trim().toUpperCase();
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 25), 1), 100);
  const offset = Math.max(Number(url.searchParams.get("offset") || 0), 0);

  const query = new URLSearchParams({
    select: forCount
      ? "id"
      : "id,public_code,status,payment_status,subtotal_cents,total_cents,notes,created_at,customers(full_name,phone,email),order_items(product_name,quantity,scale_label,customization_notes),order_events(status,message,created_at),order_attachments(id,storage_path,file_name,mime_type)",
    order: "created_at.desc",
  });

  if (!forCount) {
    query.set("limit", String(limit));
    query.set("offset", String(offset));
  }

  if (status && allowedStatuses.has(status)) query.set("status", `eq.${status}`);
  if (search) {
    query.set("public_code", /^MF3D-\d{8}-[A-Z0-9]{8}$/.test(search) ? `eq.${search}` : `ilike.*${search}*`);
  }

  return query;
}

async function countOrders(request: Request) {
  const { supabaseUrl, serviceRoleKey } = getEnv();
  const query = buildOrdersQuery(new URL(request.url), true);
  const response = await fetch(`${supabaseUrl}/rest/v1/orders?${query}`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      Prefer: "count=exact",
      Range: "0-0",
    },
  });
  if (!response.ok) return 0;
  const range = response.headers.get("content-range") ?? "0-0/0";
  return Number(range.split("/")[1] ?? 0);
}

async function signStoragePath(storagePath: string, expiresIn = 3600) {
  const { supabaseUrl, serviceRoleKey } = getEnv();
  const response = await fetch(
    `${supabaseUrl}/storage/v1/object/sign/order-references/${storagePath}`,
    {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ expiresIn }),
    },
  );
  if (!response.ok) return null;
  const data = await response.json();
  return data.signedURL ? `${supabaseUrl}/storage/v1${data.signedURL}` : null;
}

async function listOrders(request: Request) {
  const query = buildOrdersQuery(new URL(request.url));
  const orders = await supabaseRequest(`orders?${query}`);

  for (const order of orders) {
    if (Array.isArray(order.order_events)) {
      order.order_events.sort(
        (a: { created_at: string }, b: { created_at: string }) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
    }
    if (Array.isArray(order.order_attachments)) {
      for (const attachment of order.order_attachments) {
        attachment.signed_url = await signStoragePath(attachment.storage_path);
      }
    }
  }

  return orders;
}

async function sendStatusEmail(order: Record<string, unknown>, newStatus: string, message: string) {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("NOTIFY_FROM_EMAIL");
  const siteUrl = (Deno.env.get("SITE_URL") ?? "https://miniforge.btencacorretora.com").replace(/\/$/, "");
  const customer = order.customers as { email?: string; full_name?: string } | null;
  const to = customer?.email?.trim();

  if (!apiKey || !from || !to) return;

  const label = statusLabels[newStatus] ?? newStatus;
  const code = order.public_code;
  const name = customer?.full_name ?? "Cliente";

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: `MiniForge 3D — atualização do pedido ${code}`,
      html: `<p>Olá, ${name}!</p><p>Seu pedido <strong>${code}</strong> foi atualizado para: <strong>${label}</strong>.</p>${message ? `<p>${message}</p>` : ""}<p><a href="${siteUrl}/acompanhar.html?pedido=${encodeURIComponent(String(code))}">Acompanhar pedido</a></p>`,
    }),
  });
}

async function updateOrder(payload: Record<string, unknown>) {
  const id = String(payload.id ?? "");
  const status = String(payload.status ?? "");
  const paymentStatus = String(payload.payment_status ?? "");
  const message = String(payload.message ?? "").trim().slice(0, 500);
  const notify = payload.notify_email === true;

  if (!id) return jsonResponse({ error: "Dados inválidos." }, 400);

  const [before] = await supabaseRequest(
    `orders?id=eq.${id}&select=id,public_code,status,customers(full_name,email)`,
  );

  if (!before) return jsonResponse({ error: "Pedido não encontrado." }, 404);

  const patch: Record<string, unknown> = {};
  if (status) {
    if (!allowedStatuses.has(status)) return jsonResponse({ error: "Status inválido." }, 400);
    patch.status = status;
  }
  if (paymentStatus) {
    if (!allowedPaymentStatuses.has(paymentStatus)) {
      return jsonResponse({ error: "Status de pagamento inválido." }, 400);
    }
    patch.payment_status = paymentStatus;
  }

  if (!Object.keys(patch).length) return jsonResponse({ error: "Nada para atualizar." }, 400);

  const [order] = await supabaseRequest(`orders?id=eq.${id}&select=id,status`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(patch),
  });

  const eventStatus = (patch.status as string) ?? order.status;
  const eventMessage =
    message || (patch.payment_status ? `Pagamento atualizado para: ${patch.payment_status}` : "");

  if (eventMessage || patch.status) {
    await supabaseRequest("order_events", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        order_id: id,
        status: eventStatus,
        message: eventMessage || `Status atualizado para ${eventStatus}.`,
      }),
    });
  }

  if (notify && patch.status && patch.status !== before.status) {
    try {
      await sendStatusEmail(before, patch.status as string, message);
    } catch (error) {
      console.warn("Email notification failed", error);
    }
  }

  return jsonResponse({ ok: true });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const admin = await requireAdmin(request);
    if (!admin) return jsonResponse({ error: "Acesso não autorizado." }, 401);

    if (request.method === "GET") {
      const [orders, total] = await Promise.all([listOrders(request), countOrders(request)]);
      const url = new URL(request.url);
      const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 25), 1), 100);
      const offset = Math.max(Number(url.searchParams.get("offset") || 0), 0);
      return jsonResponse({
        orders,
        total,
        limit,
        offset,
        has_more: offset + orders.length < total,
      });
    }

    if (request.method === "PATCH") {
      return updateOrder(await request.json());
    }

    return jsonResponse({ error: "Method not allowed" }, 405);
  } catch (error) {
    console.error(error);
    return jsonResponse({ error: "Não foi possível processar a solicitação." }, 500);
  }
});
