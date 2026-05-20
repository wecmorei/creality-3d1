/**
 * Histórico local de pedidos do cliente (sem login).
 */
(function initCustomerOrders() {
  const STORAGE_KEY = "miniforge_my_orders_v1";
  const CODE_PATTERN = /^MF3D-\d{8}-[A-Z0-9]{8}$/;

  function normalizeCode(value) {
    return String(value ?? "")
      .trim()
      .toUpperCase()
      .slice(0, 32);
  }

  function readOrders() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  }

  function writeOrders(orders) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(orders.slice(0, 30)));
    window.dispatchEvent(new CustomEvent("miniforge-orders-updated"));
  }

  function rememberOrder(entry) {
    const code = normalizeCode(entry?.public_code);
    if (!CODE_PATTERN.test(code)) return null;

    const orders = readOrders().filter((item) => item.public_code !== code);
    orders.unshift({
      public_code: code,
      type: entry?.type ?? "order",
      label: String(entry?.label ?? "").slice(0, 120),
      saved_at: entry?.saved_at ?? new Date().toISOString(),
    });

    writeOrders(orders);
    return code;
  }

  function removeOrder(code) {
    const normalized = normalizeCode(code);
    writeOrders(readOrders().filter((item) => item.public_code !== normalized));
  }

  function clearOrders() {
    window.localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent("miniforge-orders-updated"));
  }

  window.MiniForgeCustomerOrders = {
    STORAGE_KEY,
    CODE_PATTERN,
    normalizeCode,
    readOrders,
    rememberOrder,
    removeOrder,
    clearOrders,
  };
})();
