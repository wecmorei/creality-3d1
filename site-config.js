/**
 * Configuração da loja — edite aqui dados da empresa e analytics.
 * Plausible: ativo por padrão no domínio de produção. Para GA4, defina ga4MeasurementId.
 */
window.MiniForgeConfig = {
  assets: {
    version: "20260521c",
  },
  features: {
    /** Supabase Auth: Google, Facebook, Apple + magic link */
    socialLoginEnabled: true,
    /** Edge Functions: MERCADOPAGO_ACCESS_TOKEN + SITE_URL */
    mercadoPagoEnabled: true,
  },
  business: {
    legalName: "MiniForge 3D",
    city: "São Paulo, SP — Brasil",
    cnpj: "",
    whatsappHours: "Segunda a sexta, 9h às 18h",
    responseTime: "Resposta média em até 2 horas úteis",
    email: "contato@miniforge3d.com.br",
    instagramUrl: "",
  },
  analytics: {
    plausibleDomain: "miniforge.btencacorretora.com",
    ga4MeasurementId: "",
  },
};
