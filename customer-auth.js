/**
 * Login do cliente: magic link + Google, Facebook e Apple (Supabase Auth).
 */
(function initCustomerAuth() {
  const SESSION_KEY = "miniforge_customer_session";
  const SUPABASE_JS =
    "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js";
  const siteOrigin = "https://miniforge.btencacorretora.com";
  const redirectTo = `${siteOrigin}/minha-conta.html`;

  const config = window.MiniForgeStore?.supabaseConfig ?? {
    url: "https://fmlqsivgffzjryilnjcj.supabase.co",
    publishableKey: "sb_publishable_BRjLzisbkSCzarxEWpZG7w_JI5y9GwM",
  };

  let supabaseClient = null;
  let initPromise = null;

  function getSession() {
    try {
      const raw = window.localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function syncFromSupabaseSession(session) {
    if (!session?.access_token) {
      clearSession();
      return null;
    }

    const payload = {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      token_type: session.token_type ?? "bearer",
      expires_at: session.expires_at ?? Math.floor(Date.now() / 1000) + 3600,
      email: session.user?.email ?? null,
      provider: session.user?.app_metadata?.provider ?? "email",
    };

    window.localStorage.setItem(SESSION_KEY, JSON.stringify(payload));
    window.dispatchEvent(new CustomEvent("miniforge-customer-auth-changed"));
    return payload;
  }

  function setSession(session) {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    window.dispatchEvent(new CustomEvent("miniforge-customer-auth-changed"));
  }

  function clearSession() {
    window.localStorage.removeItem(SESSION_KEY);
    window.dispatchEvent(new CustomEvent("miniforge-customer-auth-changed"));
  }

  function getAccessToken() {
    return getSession()?.access_token ?? null;
  }

  function loadSupabaseScript() {
    if (window.supabase) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-supabase-js="true"]');
      if (existing) {
        existing.addEventListener("load", () => resolve());
        existing.addEventListener("error", reject);
        return;
      }

      const script = document.createElement("script");
      script.src = SUPABASE_JS;
      script.dataset.supabaseJs = "true";
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Não foi possível carregar o login social."));
      document.head.appendChild(script);
    });
  }

  async function ensureClient() {
    if (supabaseClient) return supabaseClient;
    if (!initPromise) {
      initPromise = (async () => {
        await loadSupabaseScript();
        supabaseClient = window.supabase.createClient(config.url, config.publishableKey, {
          auth: {
            persistSession: true,
            detectSessionInUrl: true,
            flowType: "pkce",
            storage: window.localStorage,
          },
        });
        return supabaseClient;
      })();
    }
    return initPromise;
  }

  async function initSession() {
    parseHashSession();

    try {
      const client = await ensureClient();
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      if (data.session) syncFromSupabaseSession(data.session);

      client.auth.onAuthStateChange((_event, session) => {
        if (session) syncFromSupabaseSession(session);
        else clearSession();
      });
    } catch (error) {
      console.warn("Customer auth init", error);
    }

    return getSession();
  }

  function parseHashSession() {
    const hash = window.location.hash.replace(/^#/, "");
    if (!hash) return null;

    const params = new URLSearchParams(hash);
    const accessToken = params.get("access_token");
    if (!accessToken) return null;

    const session = {
      access_token: accessToken,
      refresh_token: params.get("refresh_token"),
      token_type: params.get("token_type") ?? "bearer",
      expires_at: Math.floor(Date.now() / 1000) + Number(params.get("expires_in") ?? 3600),
    };

    setSession(session);
    window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
    return session;
  }

  async function requestMagicLink(email) {
    const client = await ensureClient();
    const { error } = await client.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: redirectTo, shouldCreateUser: true },
    });

    if (error) throw new Error(error.message ?? "Não foi possível enviar o link.");
  }

  const oauthProviders = {
    google: "Google",
    facebook: "Facebook",
    apple: "Apple",
  };

  function isSocialLoginEnabled() {
    return window.MiniForgeConfig?.features?.socialLoginEnabled === true;
  }

  async function signInWithProvider(provider) {
    if (!isSocialLoginEnabled()) {
      throw new Error("Login social em breve. Use o link por e-mail abaixo.");
    }
    if (!oauthProviders[provider]) {
      throw new Error("Provedor de login inválido.");
    }

    const client = await ensureClient();
    const { data, error } = await client.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
        scopes: provider === "apple" ? "email name" : undefined,
      },
    });

    if (error) throw new Error(error.message ?? "Não foi possível iniciar o login.");
    if (data?.url) window.location.href = data.url;
  }

  async function signOut() {
    clearSession();
    try {
      const client = await ensureClient();
      await client.auth.signOut();
    } catch {
      /* ignore */
    }
  }

  async function fetchMyOrders() {
    const token = getAccessToken();
    if (!token) throw new Error("Faça login para ver seus pedidos.");

    const response = await fetch(`${config.url}/functions/v1/my-orders`, {
      headers: {
        apikey: config.publishableKey,
        Authorization: `Bearer ${token}`,
      },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error ?? "Não foi possível carregar pedidos.");
    return data;
  }

  async function linkPastOrders() {
    const token = getAccessToken();
    if (!token) return { linked_count: 0 };

    const response = await fetch(`${config.url}/functions/v1/link-orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: config.publishableKey,
        Authorization: `Bearer ${token}`,
      },
      body: "{}",
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return { linked_count: 0 };
    return data;
  }

  function getProviderLabel() {
    const provider = getSession()?.provider ?? "email";
    return oauthProviders[provider] ?? "E-mail";
  }

  window.MiniForgeCustomerAuth = {
    SESSION_KEY,
    oauthProviders,
    isSocialLoginEnabled,
    getSession,
    setSession,
    clearSession,
    getAccessToken,
    getProviderLabel,
    initSession,
    parseHashSession,
    requestMagicLink,
    signInWithProvider,
    signOut,
    fetchMyOrders,
    linkPastOrders,
  };
})();
