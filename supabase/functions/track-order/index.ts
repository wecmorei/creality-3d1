const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
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

function normalizeCode(value: string | null) {
  return String(value ?? "").trim().toUpperCase().slice(0, 32);
}

async function supabaseRequest(path: string) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase environment variables");
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Supabase request failed: ${response.status} ${errorBody}`);
  }

  return response.json();
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== "GET") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const url = new URL(request.url);
    const code = normalizeCode(url.searchParams.get("code"));

    if (!/^MF3D-\d{8}-[A-Z0-9]{8}$/.test(code)) {
      return jsonResponse({ error: "Código inválido." }, 400);
    }

    const orderQuery = new URLSearchParams({
      select: "id,public_code,status,payment_status,total_cents,created_at",
      public_code: `eq.${code}`,
      limit: "1",
    });
    const [order] = await supabaseRequest(`orders?${orderQuery}`);

    if (!order) {
      return jsonResponse({ error: "Pedido não encontrado." }, 404);
    }

    const itemsQuery = new URLSearchParams({
      select: "product_name,quantity,scale_label,finish_label,customization_notes",
      order_id: `eq.${order.id}`,
      order: "created_at.asc",
    });
    const eventsQuery = new URLSearchParams({
      select: "status,message,created_at",
      order_id: `eq.${order.id}`,
      order: "created_at.desc",
      limit: "5",
    });

    const [items, events] = await Promise.all([
      supabaseRequest(`order_items?${itemsQuery}`),
      supabaseRequest(`order_events?${eventsQuery}`),
    ]);

    return jsonResponse({
      public_code: order.public_code,
      status: order.status,
      payment_status: order.payment_status,
      total_cents: order.total_cents ?? 0,
      created_at: order.created_at,
      items,
      events,
    });
  } catch (error) {
    console.error(error);
    return jsonResponse({ error: "Não foi possível consultar o pedido." }, 500);
  }
});
