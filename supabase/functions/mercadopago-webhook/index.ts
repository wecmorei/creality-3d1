/**
 * Webhook Mercado Pago — atualiza payment_status do pedido
 * Configure a URL no painel MP: {SUPABASE_URL}/functions/v1/mercadopago-webhook
 */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

async function supabaseRequest(path: string, init: RequestInit = {}) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      apikey: serviceRoleKey!,
      Authorization: `Bearer ${serviceRoleKey}`,
      Prefer: "return=representation",
      ...init.headers,
    },
  });
  if (!response.ok) throw new Error(`Supabase ${response.status}`);
  return response.status === 204 ? null : response.json();
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const url = new URL(request.url);
    let topic = url.searchParams.get("topic") ?? url.searchParams.get("type");
    let paymentId = url.searchParams.get("id") ?? url.searchParams.get("data.id");

    if (request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      topic = body.type ?? topic;
      paymentId = body?.data?.id ?? paymentId;
    }

    if (topic !== "payment" || !paymentId) {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const mpToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!mpToken) {
      return new Response(JSON.stringify({ ok: false }), { status: 503 });
    }

    const paymentRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${mpToken}` },
    });
    const payment = await paymentRes.json();

    if (!paymentRes.ok || !payment.external_reference) {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const publicCode = payment.external_reference;
    const isPaid = payment.status === "approved";
    const paymentStatus = isPaid ? "paid" : payment.status === "pending" ? "pending" : "failed";

    const orderQuery = new URLSearchParams({
      select: "id,status",
      public_code: `eq.${publicCode}`,
      limit: "1",
    });
    const [order] = await supabaseRequest(`orders?${orderQuery}`);

    if (order) {
      await supabaseRequest(`orders?id=eq.${order.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          payment_status: paymentStatus,
          status: isPaid && order.status === "quote_requested" ? "awaiting_payment" : order.status,
        }),
      });

      if (isPaid) {
        await supabaseRequest("order_events", {
          method: "POST",
          body: JSON.stringify({
            order_id: order.id,
            status: "awaiting_payment",
            message: "Pagamento confirmado via Mercado Pago.",
          }),
        });
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ ok: false }), { status: 500 });
  }
});
