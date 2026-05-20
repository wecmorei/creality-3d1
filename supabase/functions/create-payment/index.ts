/**
 * Mercado Pago — Checkout Pro (Preference API)
 * Requer secrets: MERCADOPAGO_ACCESS_TOKEN
 * Opcional: SITE_URL (ex. https://miniforge.btencacorretora.com)
 */
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

async function supabaseRequest(path: string) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    headers: { apikey: serviceRoleKey!, Authorization: `Bearer ${serviceRoleKey}` },
  });
  if (!response.ok) throw new Error(`Supabase ${response.status}`);
  return response.json();
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const mpToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
  const siteUrl = (Deno.env.get("SITE_URL") ?? "https://miniforge.btencacorretora.com").replace(/\/$/, "");

  if (!mpToken) {
    return jsonResponse({
      enabled: false,
      message: "Mercado Pago não configurado. Configure MERCADOPAGO_ACCESS_TOKEN no Supabase.",
    });
  }

  try {
    const { public_code: publicCode } = await request.json();

    if (!publicCode || !/^MF3D-\d{8}-[A-Z0-9]{8}$/.test(publicCode)) {
      return jsonResponse({ error: "Código de pedido inválido." }, 400);
    }

    const orderQuery = new URLSearchParams({
      select: "id,public_code,subtotal_cents,total_cents,payment_status",
      public_code: `eq.${publicCode}`,
      limit: "1",
    });
    const [order] = await supabaseRequest(`orders?${orderQuery}`);

    if (!order) {
      return jsonResponse({ error: "Pedido não encontrado." }, 404);
    }

    if (order.payment_status === "paid") {
      return jsonResponse({ error: "Pedido já está pago." }, 400);
    }

    const itemsQuery = new URLSearchParams({
      select: "product_name,quantity,unit_price_cents",
      order_id: `eq.${order.id}`,
    });
    const items = await supabaseRequest(`order_items?${itemsQuery}`);

    const mpItems = items
      .filter((item: { unit_price_cents: number | null }) => item.unit_price_cents && item.unit_price_cents > 0)
      .map((item: { product_name: string; quantity: number; unit_price_cents: number }) => ({
        title: item.product_name.slice(0, 256),
        quantity: item.quantity,
        currency_id: "BRL",
        unit_price: item.unit_price_cents / 100,
      }));

    if (!mpItems.length) {
      return jsonResponse({
        enabled: false,
        message: "Pagamento online só está disponível quando todos os itens têm preço base definido.",
      });
    }

    const preferenceBody = {
      items: mpItems,
      external_reference: order.public_code,
      statement_descriptor: "MINIFORGE3D",
      back_urls: {
        success: `${siteUrl}/carrinho.html?pagamento=sucesso&pedido=${encodeURIComponent(order.public_code)}`,
        failure: `${siteUrl}/carrinho.html?pagamento=falha&pedido=${encodeURIComponent(order.public_code)}`,
        pending: `${siteUrl}/carrinho.html?pagamento=pendente&pedido=${encodeURIComponent(order.public_code)}`,
      },
      auto_return: "approved",
      notification_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/mercadopago-webhook`,
    };

    const mpResponse = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${mpToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(preferenceBody),
    });

    const preference = await mpResponse.json();

    if (!mpResponse.ok) {
      console.error("Mercado Pago error", preference);
      return jsonResponse({ error: "Não foi possível iniciar o pagamento." }, 502);
    }

    const checkoutUrl = preference.init_point ?? preference.sandbox_init_point;

    return jsonResponse({
      enabled: true,
      checkout_url: checkoutUrl,
      preference_id: preference.id,
    });
  } catch (error) {
    console.error(error);
    return jsonResponse({ error: "Erro ao processar pagamento." }, 500);
  }
});
