const Store = window.MiniForgeStore;
const Cart = window.MiniForgeCart;

const itemsPanel = document.querySelector("#cart-items-panel");
const totalsPanel = document.querySelector("#cart-totals");
const summaryEl = document.querySelector("#cart-summary");
const checkoutForm = document.querySelector("#cart-checkout-form");
const checkoutStatus = document.querySelector("#cart-checkout-status");
const mpBtn = document.querySelector("#cart-mp-btn");
const mpHint = document.querySelector("#cart-mp-hint");

let lastOrderCode = null;

function renderEmptyCart() {
  itemsPanel.innerHTML = `
    <div class="cart-empty-state">
      <p>Seu carrinho está vazio.</p>
      <a class="btn btn-buy" href="catalogo.html">Ver catálogo</a>
    </div>
  `;
  totalsPanel.innerHTML = "";
  summaryEl.textContent = "0 itens";
  mpBtn.hidden = true;
}

function renderCartItems(items) {
  itemsPanel.innerHTML = items
    .map(
      (item) => `
    <article class="cart-line" data-slug="${Store.escapeHtml(item.slug)}">
      <a class="cart-line-thumb" href="produto.html?slug=${encodeURIComponent(item.slug)}">
        ${
          item.imageUrl
            ? `<img src="${Store.escapeHtml(item.imageUrl)}" alt="" width="80" height="80" loading="lazy" />`
            : `<span>${Store.escapeHtml(item.name.slice(0, 2).toUpperCase())}</span>`
        }
      </a>
      <div class="cart-line-body">
        <h2><a href="produto.html?slug=${encodeURIComponent(item.slug)}">${Store.escapeHtml(item.name)}</a></h2>
        <div class="product-badges-row">${Store.renderProductPriceBadge({ startingPriceCents: item.startingPriceCents })}</div>
        <p class="cart-line-meta">${Store.escapeHtml(item.priceLabel)}</p>
        <label class="cart-line-notes">
          Observações
          <input type="text" data-notes-slug="${Store.escapeHtml(item.slug)}" value="${Store.escapeHtml(item.notes)}" placeholder="Cor, tamanho, urgência..." />
        </label>
      </div>
      <div class="cart-line-actions">
        <label class="cart-qty-label">
          Qtd
          <input type="number" min="1" max="99" value="${item.quantity}" data-qty-slug="${Store.escapeHtml(item.slug)}" />
        </label>
        <button type="button" class="btn-text" data-remove-slug="${Store.escapeHtml(item.slug)}">Remover</button>
      </div>
    </article>
  `,
    )
    .join("");

  itemsPanel.querySelectorAll("[data-qty-slug]").forEach((input) => {
    input.addEventListener("change", () => {
      Cart.updateQuantity(input.dataset.qtySlug, input.value);
      render();
    });
  });

  itemsPanel.querySelectorAll("[data-notes-slug]").forEach((input) => {
    input.addEventListener("change", () => {
      Cart.updateNotes(input.dataset.notesSlug, input.value);
    });
  });

  itemsPanel.querySelectorAll("[data-remove-slug]").forEach((button) => {
    button.addEventListener("click", () => {
      Cart.removeItem(button.dataset.removeSlug);
      render();
    });
  });
}

function renderTotals(items) {
  const count = Cart.getCartCount(items);
  const subtotal = Cart.getCartSubtotalCents(items);
  const hasEstimate = subtotal > 0;
  const allPriced = Cart.cartHasFixedPrices(items);

  summaryEl.textContent = `${count} item${count === 1 ? "" : "s"} no carrinho`;

  totalsPanel.innerHTML = `
    <h2>Resumo</h2>
    <p><span>Itens</span><strong>${count}</strong></p>
    ${
      hasEstimate
        ? `<p class="cart-total-estimate"><span>Estimativa</span><strong>${Cart.formatMoney(subtotal)}</strong></p>
           <p class="cart-total-note">Valores finais confirmados no WhatsApp. Pix com 10% após confirmação.</p>`
        : `<p class="cart-total-note">Itens sob orçamento — valor final pelo WhatsApp.</p>`
    }
    ${
      allPriced && Store.isFeatureEnabled("mercadoPagoEnabled")
        ? '<p class="cart-total-note cart-total-note-ok">Elegível para pagamento online (Mercado Pago).</p>'
        : ""
    }
  `;

  const mpEnabled = Store.isFeatureEnabled("mercadoPagoEnabled");
  mpBtn.hidden = !allPriced || !mpEnabled;
  mpHint.hidden = allPriced && mpEnabled;
  if (!mpEnabled && mpHint) {
    mpHint.textContent = "Pagamento online em breve. Finalize pelo WhatsApp.";
    mpHint.hidden = false;
  }
}

function render() {
  const items = Cart.readCart();
  if (!items.length) {
    renderEmptyCart();
    return;
  }
  renderCartItems(items);
  renderTotals(items);
}

async function submitCart(paymentMode = "whatsapp") {
  const items = Cart.readCart();
  if (!items.length) {
    checkoutStatus.textContent = "Adicione itens ao carrinho.";
    checkoutStatus.classList.add("is-error");
    return;
  }

  const formData = new FormData(checkoutForm);
  if (formData.get("consent") !== "on") {
    checkoutStatus.textContent = "Aceite a política de privacidade.";
    checkoutStatus.classList.add("is-error");
    return;
  }

  const submitBtn = document.querySelector("#cart-submit-btn");
  submitBtn.disabled = true;
  mpBtn.disabled = true;
  checkoutStatus.textContent = "Registrando pedido...";
  checkoutStatus.classList.remove("is-error");

  try {
    const order = await Store.createOrder({
      type: "cart",
      consent: true,
      customer: {
        name: formData.get("name"),
        phone: formData.get("phone"),
        email: formData.get("email"),
      },
      items: items.map((item) => ({
        slug: item.slug,
        quantity: item.quantity,
        notes: item.notes,
      })),
    });

    lastOrderCode = order.public_code;
    Store.rememberCustomerOrder({
      public_code: lastOrderCode,
      type: "cart",
      label: `${items.length} item(ns) no carrinho`,
    });
    Store.trackEvent("cart_checkout", { order_code: lastOrderCode, items: items.length });

    if (paymentMode === "mercadopago") {
      const payment = await Store.createPayment({ public_code: lastOrderCode });
      if (payment.checkout_url) {
        checkoutStatus.textContent = `Pedido ${lastOrderCode}. Redirecionando ao Mercado Pago...`;
        Cart.clearCart();
        render();
        window.location.href = payment.checkout_url;
        return;
      }
      checkoutStatus.textContent = payment.message || "Pagamento online indisponível. Use o WhatsApp.";
      checkoutStatus.classList.add("is-error");
    } else {
      const message = Cart.buildWhatsappCartMessage(lastOrderCode, formData.get("name"), items);
      Cart.clearCart();
      render();
      Store.redirectToOrderSuccess({
        code: lastOrderCode,
        type: "cart",
        customerName: formData.get("name"),
        whatsappMessage: message,
      });
      return;
    }
  } catch (error) {
    checkoutStatus.textContent = error.message || "Não foi possível registrar o pedido.";
    checkoutStatus.classList.add("is-error");
  } finally {
    submitBtn.disabled = false;
    mpBtn.disabled = false;
  }
}

checkoutForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  submitCart("whatsapp");
});

mpBtn?.addEventListener("click", () => {
  submitCart("mercadopago");
});

Store.setPageMeta({
  title: "Carrinho | MiniForge 3D",
  description: "Finalize seu pedido com vários itens do catálogo MiniForge 3D.",
  path: "/carrinho.html",
});

const paymentReturn = new URLSearchParams(window.location.search).get("pagamento");
const returnedOrder = new URLSearchParams(window.location.search).get("pedido");
if (paymentReturn && returnedOrder && checkoutStatus) {
  const messages = {
    sucesso: `Pagamento aprovado para o pedido ${returnedOrder}. Obrigado!`,
    pendente: `Pagamento pendente para ${returnedOrder}. Acompanhe pelo código do pedido.`,
    falha: `Pagamento não concluído para ${returnedOrder}. Tente novamente ou fale no WhatsApp.`,
  };
  checkoutStatus.textContent = messages[paymentReturn] ?? `Retorno de pagamento: ${returnedOrder}`;
  checkoutStatus.classList.toggle("is-error", paymentReturn === "falha");
  Store.rememberCustomerOrder({
    public_code: returnedOrder,
    type: "cart",
    label: messages[paymentReturn]?.slice(0, 80) ?? "Retorno de pagamento",
  });
}

render();
