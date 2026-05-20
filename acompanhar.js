const Store = window.MiniForgeStore;

Store.setupTrackingForm(
  document.querySelector("#tracking-form"),
  document.querySelector("#tracking-result"),
  { autoSubmit: true },
);

Store.setPageMeta({
  title: "Acompanhar pedido | MiniForge 3D",
  description: "Consulte o status do seu pedido MiniForge 3D pelo código MF3D.",
  path: "/acompanhar.html",
});
