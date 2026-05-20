# Login social — Google, Facebook e Apple

O site usa **Supabase Auth** na página `minha-conta.html`. O cliente pode entrar com:

- Google
- Facebook
- Apple
- E-mail (magic link, sem senha)

## 1. Supabase Dashboard

Projeto: `fmlqsivgffzjryilnjcj` → **Authentication** → **Providers**

Para cada provedor, **ative** e preencha Client ID / Secret conforme o painel do Google, Meta ou Apple.

**URL de redirect** (Site URL / Redirect URLs):

```
https://miniforge.btencacorretora.com/minha-conta.html
```

Também aceite em desenvolvimento:

```
http://localhost:5500/minha-conta.html
```

## 2. Google

1. [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials
2. Criar **OAuth 2.0 Client ID** (Web application)
3. Authorized redirect URI (copiar do Supabase na tela do provider Google):

   `https://fmlqsivgffzjryilnjcj.supabase.co/auth/v1/callback`

4. Colar Client ID e Client Secret no Supabase → Google

## 3. Facebook

1. [Meta for Developers](https://developers.facebook.com/) → App → Facebook Login
2. Valid OAuth Redirect URIs:

   `https://fmlqsivgffzjryilnjcj.supabase.co/auth/v1/callback`

3. App em modo **Live** para usuários reais (modo Development só para testadores)
4. Colar App ID e App Secret no Supabase → Facebook

## 4. Apple

1. [Apple Developer](https://developer.apple.com/) → Identifiers → Services ID
2. Habilitar **Sign in with Apple**, configurar domínio e redirect URL do Supabase
3. Gerar **Key** (.p8), Team ID, Service ID, Key ID no Supabase → Apple
4. Apple exige HTTPS no domínio de produção

## 5. Comportamento no site

- Após login, pedidos com o **mesmo e-mail** são vinculados (`link-orders`)
- Novos pedidos com sessão ativa gravam `auth_user_id` no cliente
- Sessão persiste no navegador (localStorage)

## 6. Teste rápido

1. Abra `minha-conta.html` em produção
2. Clique em **Continuar com Google** (ou outro)
3. Autorize e volte ao site — deve aparecer **Pedidos na sua conta**

Se o botão falhar com erro de provider, o provedor ainda não está configurado no Supabase.
