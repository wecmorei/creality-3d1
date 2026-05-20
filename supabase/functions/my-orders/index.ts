const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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

async function supabaseRequest(path: string) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    headers: {
      apikey: serviceRoleKey!,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  });
  if (!response.ok) throw new Error(`Supabase ${response.status}`);
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
    const user = await getAuthenticatedUser(request);
    if (!user?.id) {
      return jsonResponse({ error: "Faça login para ver seus pedidos." }, 401);
    }

    const email = String(user.email ?? "").trim().toLowerCase();
    const orFilter = email
      ? `auth_user_id.eq.${user.id},email.ilike.${email}`
      : `auth_user_id.eq.${user.id}`;
    const customerQuery = new URLSearchParams({
      select: "id",
      or: `(${orFilter})`,
    });
    const customers = await supabaseRequest(`customers?${customerQuery}`);

    if (!customers.length) {
      return jsonResponse({ orders: [], email: user.email ?? null });
    }

    const customerIds = customers.map((c: { id: string }) => c.id).join(",");
    const ordersQuery = new URLSearchParams({
      select:
        "public_code,status,payment_status,total_cents,created_at,order_items(product_name,quantity)",
      customer_id: `in.(${customerIds})`,
      order: "created_at.desc",
      limit: "50",
    });
    const orders = await supabaseRequest(`orders?${ordersQuery}`);

    return jsonResponse({
      orders,
      email: user.email ?? null,
    });
  } catch (error) {
    console.error(error);
    return jsonResponse({ error: "Não foi possível carregar seus pedidos." }, 500);
  }
});
