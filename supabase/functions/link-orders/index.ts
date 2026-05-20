const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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

async function supabaseRequest(path: string, init: RequestInit = {}) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      apikey: serviceRoleKey!,
      Authorization: `Bearer ${serviceRoleKey}`,
      Prefer: "return=minimal",
      ...init.headers,
    },
  });
  if (!response.ok) throw new Error(`Supabase ${response.status}`);
  return response;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const user = await getAuthenticatedUser(request);
    if (!user?.id || !user.email) {
      return jsonResponse({ error: "Sessão inválida." }, 401);
    }

    const email = String(user.email).trim().toLowerCase();
    const listQuery = new URLSearchParams({
      select: "id",
      email: `ilike.${email}`,
      auth_user_id: "is.null",
    });
    const listRes = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/rest/v1/customers?${listQuery}`,
      {
        headers: {
          apikey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
      },
    );
    const pending = await listRes.json();
    const count = Array.isArray(pending) ? pending.length : 0;

    if (count > 0) {
      await supabaseRequest(`customers?email=ilike.${email}&auth_user_id=is.null`, {
        method: "PATCH",
        body: JSON.stringify({ auth_user_id: user.id }),
      });
    }

    return jsonResponse({ ok: true, linked_count: count });
  } catch (error) {
    console.error(error);
    return jsonResponse({ error: "Não foi possível vincular pedidos." }, 500);
  }
});
