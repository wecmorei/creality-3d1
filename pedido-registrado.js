const Store = window.MiniForgeStore;
const Orders = window.MiniForgeCustomerOrders;

const params = new URLSearchParams(window.location.search);
const codeFromUrl = params.get("pedido")?.trim().toUpperCase() ?? "";
const typeFromUrl = params.get("tipo") ?? "";
const photosFromUrl = Number(params.get("fotos") ?? 0);

const stash = Store.readLastOrder?.() ?? null;
const code = codeFromUrl || stash?.public_code || "";
const type = typeFromUrl || stash?.type || "order";
const photos = photosFromUrl || Number(stash?.photos ?? 0);

const titleEl = document.querySelector("#order-success-title");
const codeEl = document.querySelector("#order-success-code");
const subtitleEl = document.querySelector("#order-success-subtitle");
const photosEl = document.querySelector("#order-success-photos");
const whatsappBtn = document.querySelector("#order-success-whatsapp");
const trackBtn = document.querySelector("#order-success-track");

const typeLabels = {
  quote: "Orçamento personalizado",
  catalog: "Compra do catálogo",
  cart: "Pedido do carrinho",
};

if (!code) {
  titleEl.textContent = "Pedido não encontrado";
  codeEl.textContent = "Volte ao catálogo ou entre em contato pelo WhatsApp.";
  whatsappBtn.href = Store.buildWhatsappUrl("Olá! Preciso de ajuda com um pedido na MiniForge 3D.");
} else {
  titleEl.textContent = "Recebemos seu pedido!";
  codeEl.innerHTML = `Código: <strong>${Store.escapeHtml(code)}</strong>`;
  subtitleEl.textContent =
    typeLabels[type] ??
    `Tipo: ${Store.getOrderTypeLabel?.(type) ?? type}. Nossa equipe retorna pelo WhatsApp em breve.`;

  if (photos > 0) {
    photosEl.hidden = false;
    photosEl.textContent = `${photos} foto(s) de referência recebida(s) com sucesso.`;
  }

  const trackUrl = new URL("acompanhar.html", window.location.href);
  trackUrl.searchParams.set("pedido", code);
  trackBtn.href = trackUrl.toString();

  const defaultMessage = [
    "Olá! Acabei de registrar um pedido na MiniForge 3D.",
    `Pedido: ${code}`,
    photos > 0 ? `Enviei ${photos} foto(s) de referência pelo site.` : null,
  ]
    .filter(Boolean)
    .join("\n");

  whatsappBtn.href = Store.buildWhatsappUrl(stash?.whatsappMessage || defaultMessage);

  Orders?.rememberOrder?.({
    public_code: code,
    type,
    label: Store.getOrderTypeLabel?.(type) ?? "Pedido registrado",
  });
  Store.rememberCustomerOrder?.({
    public_code: code,
    type,
    label: Store.getOrderTypeLabel?.(type) ?? "Pedido registrado",
  });
  Store.trackEvent?.("order_success_view", { order_code: code, type, photos });
}

Store.setPageMeta({
  title: "Pedido registrado | MiniForge 3D",
  description: "Confirmação do pedido MiniForge 3D com código de acompanhamento.",
  path: "/pedido-registrado.html",
});
