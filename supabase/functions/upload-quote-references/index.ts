const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_FILES = 5;
const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

const CODE_RE = /^MF3D-\d{8}-[A-Z0-9]{8}$/;

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
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...init.headers,
    },
  });
  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Supabase request failed: ${response.status} ${errorBody}`);
  }
  return response.status === 204 ? null : response.json();
}

function safeFileName(name: string) {
  const base = name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
  return base || "referencia.jpg";
}

function extensionForMime(mime: string) {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/heic" || mime === "image/heif") return "heic";
  return "jpg";
}

async function uploadToStorage(
  publicCode: string,
  file: File,
  orderId: string,
) {
  const { supabaseUrl, serviceRoleKey } = getEnv();
  const mime = file.type || "image/jpeg";
  if (!ALLOWED_TYPES.has(mime)) {
    throw new Error(`Formato não permitido: ${file.name}`);
  }
  if (file.size > MAX_BYTES) {
    throw new Error(`Arquivo muito grande (máx. 8 MB): ${file.name}`);
  }

  const ext = extensionForMime(mime);
  const storagePath = `${publicCode}/${crypto.randomUUID()}.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const uploadUrl = `${supabaseUrl}/storage/v1/object/order-references/${storagePath}`;
  const uploadRes = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": mime,
      "x-upsert": "false",
    },
    body: bytes,
  });

  if (!uploadRes.ok) {
    const err = await uploadRes.text();
    throw new Error(`Falha ao enviar ${file.name}: ${uploadRes.status} ${err}`);
  }

  const [attachment] = await supabaseRequest("order_attachments", {
    method: "POST",
    body: JSON.stringify({
      order_id: orderId,
      storage_path: storagePath,
      file_name: safeFileName(file.name),
      mime_type: mime,
      size_bytes: file.size,
    }),
  });

  return {
    id: attachment.id,
    file_name: attachment.file_name,
    storage_path: storagePath,
  };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const form = await request.formData();
    const publicCode = String(form.get("public_code") ?? "").trim().toUpperCase();

    if (!CODE_RE.test(publicCode)) {
      return jsonResponse({ error: "Código de pedido inválido." }, 400);
    }

    const orderQuery = new URLSearchParams({
      select: "id,public_code,notes",
      public_code: `eq.${publicCode}`,
      limit: "1",
    });
    const [order] = await supabaseRequest(`orders?${orderQuery}`, { method: "GET" });
    if (!order) {
      return jsonResponse({ error: "Pedido não encontrado." }, 404);
    }

    const existingQuery = new URLSearchParams({
      select: "id",
      order_id: `eq.${order.id}`,
    });
    const existing = (await supabaseRequest(`order_attachments?${existingQuery}`, {
      method: "GET",
    })) as { id: string }[];
    const existingCount = Array.isArray(existing) ? existing.length : 0;

    const files = form.getAll("references").filter((entry): entry is File => entry instanceof File);
    if (!files.length) {
      return jsonResponse({ error: "Envie ao menos uma imagem de referência." }, 400);
    }
    if (existingCount + files.length > MAX_FILES) {
      return jsonResponse({
        error: `Máximo de ${MAX_FILES} fotos por pedido. Você já enviou ${existingCount}.`,
      },
      400);
    }

    const uploaded = [];
    for (const file of files) {
      uploaded.push(await uploadToStorage(publicCode, file, order.id));
    }

    const prevNotes = String(order.notes ?? "").trim();
    const notesSuffix = `${uploaded.length} foto(s) de referência enviada(s) pelo site.`;
    if (!prevNotes.includes("foto(s) de referência")) {
      const mergedNotes = prevNotes ? `${prevNotes} ${notesSuffix}` : notesSuffix;
      await supabaseRequest(`orders?id=eq.${order.id}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ notes: mergedNotes }),
      });
    }

    return jsonResponse({
      public_code: publicCode,
      uploaded_count: uploaded.length,
      attachments: uploaded,
    });
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "Não foi possível enviar as imagens.";
    return jsonResponse({ error: message }, 500);
  }
});
