/**
 * Carrinho local (localStorage) — MiniForge 3D
 */
const CART_STORAGE_KEY = "miniforge_cart_v1";

function readCart() {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeCart(items) {
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent("miniforge-cart-updated", { detail: { count: getCartCount(items) } }));
}

function productToCartLine(product, quantity = 1, notes = "") {
  const normalized =
    typeof product.slug === "string" && product.name
      ? {
          slug: product.slug,
          name: product.name,
          priceLabel: product.price ?? product.price_label,
          startingPriceCents: product.startingPrice ?? product.starting_price_cents ?? null,
          imageUrl: product.imageUrl ?? null,
          category: product.category ?? product.categories?.name ?? "",
        }
      : product;

  return {
    slug: normalized.slug,
    name: normalized.name,
    priceLabel: normalized.priceLabel,
    startingPriceCents: normalized.startingPriceCents,
    imageUrl: normalized.imageUrl,
    category: normalized.category,
    quantity: Math.min(Math.max(Number(quantity) || 1, 1), 99),
    notes: String(notes ?? "").trim().slice(0, 500),
  };
}

function getCartCount(items = readCart()) {
  return items.reduce((sum, item) => sum + (item.quantity || 0), 0);
}

function getCartSubtotalCents(items = readCart()) {
  return items.reduce((sum, item) => {
    const unit = item.startingPriceCents;
    if (!unit || unit <= 0) return sum;
    return sum + unit * item.quantity;
  }, 0);
}

function formatMoney(cents) {
  if (!cents || cents <= 0) return null;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function addItem(product, quantity = 1, notes = "") {
  const line = productToCartLine(product, quantity, notes);
  const items = readCart();
  const existing = items.find((item) => item.slug === line.slug);

  if (existing) {
    existing.quantity = Math.min(existing.quantity + line.quantity, 99);
    if (notes) existing.notes = line.notes;
  } else {
    items.push(line);
  }

  writeCart(items);
  return items;
}

function updateQuantity(slug, quantity) {
  const items = readCart();
  const item = items.find((entry) => entry.slug === slug);
  if (!item) return items;

  const qty = Number(quantity);
  if (!Number.isFinite(qty) || qty < 1) {
    return removeItem(slug);
  }

  item.quantity = Math.min(Math.round(qty), 99);
  writeCart(items);
  return items;
}

function updateNotes(slug, notes) {
  const items = readCart();
  const item = items.find((entry) => entry.slug === slug);
  if (item) item.notes = String(notes ?? "").trim().slice(0, 500);
  writeCart(items);
  return items;
}

function removeItem(slug) {
  const items = readCart().filter((entry) => entry.slug !== slug);
  writeCart(items);
  return items;
}

function clearCart() {
  writeCart([]);
}

function cartHasFixedPrices(items = readCart()) {
  return items.length > 0 && items.every((item) => item.startingPriceCents > 0);
}

function buildWhatsappCartMessage(orderCode, customerName, items = readCart()) {
  const lines = [
    "Olá! Quero finalizar meu pedido na MiniForge 3D.",
    orderCode ? `Pedido: ${orderCode}` : null,
    customerName ? `Nome: ${customerName}` : null,
    "",
    "Itens:",
    ...items.map(
      (item, index) =>
        `${index + 1}. ${item.name} (x${item.quantity}) — ${item.priceLabel}${item.notes ? ` | Obs: ${item.notes}` : ""}`,
    ),
  ];

  const subtotal = getCartSubtotalCents(items);
  if (subtotal > 0) {
    lines.push("", `Estimativa no site: ${formatMoney(subtotal)} (valor final confirmado no WhatsApp).`);
  }

  return lines.filter(Boolean).join("\n");
}

window.MiniForgeCart = {
  readCart,
  addItem,
  updateQuantity,
  updateNotes,
  removeItem,
  clearCart,
  getCartCount,
  getCartSubtotalCents,
  formatMoney,
  cartHasFixedPrices,
  buildWhatsappCartMessage,
};
