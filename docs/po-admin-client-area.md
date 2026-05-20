# PO — Área administrativa e área do cliente

## Contexto

O site já tinha painel admin (pedidos + produtos), carrinho e rastreio por código MF3D na home. Faltava experiência dedicada para o **cliente** rever pedidos e para a **operação** filtrar e gerir pagamento com mais clareza.

## Personas

| Persona | Necessidade |
|---------|-------------|
| Cliente | Ver pedidos feitos, status, carrinho, código MF3D |
| Operador (admin) | Filtrar pedidos, atualizar status e pagamento, ver histórico |

## Lacunas identificadas

### Cliente

- Sem “Minha conta” — só código MF3D manual na home
- Pedidos não salvos após checkout (perdia o código)
- Acompanhar pedido só em âncora na home

### Admin

- Lista fixa (50 pedidos), sem busca/filtro
- `payment_status` só leitura (MP ou nada)
- Sem linha do tempo de eventos no card
- Sem visão agrupada de clientes

## MVP implementado

### Área do cliente (sem login)

| Entrega | Descrição |
|---------|-----------|
| `minha-conta.html` | Histórico local de pedidos + atalhos carrinho/catálogo |
| `acompanhar.html` | Consulta por código MF3D |
| `customer-orders.js` | `localStorage` (`miniforge_my_orders_v1`) |
| Salvamento automático | Após carrinho, produto, orçamento e retorno MP |
| Menu | **Minha conta** + **Acompanhar** no header/rodapé |

**Decisão:** não exigir conta Supabase Auth no MVP — reduz fricção e LGPD; histórico é do dispositivo. Login com “meus pedidos” por e-mail fica para fase 2.

### Área administrativa

| Entrega | Descrição |
|---------|-----------|
| Filtros | Status + busca por código MF3D |
| Pagamento | PATCH de `payment_status` no painel |
| Detalhe | Notas do pedido + timeline de `order_events` |
| Clientes | Aba com agrupamento por telefone (dados já nos pedidos) |
| API | `admin-orders` até 100 pedidos + query params |

## Fase 2 (implementada)

- Login cliente por **magic link** (`customer-auth.js` + Supabase OTP)
- Migration `0006_customer_auth.sql` — `customers.auth_user_id`
- Edge Functions `my-orders`, `link-orders`; `create-order` vincula conta logada
- Admin: **paginação** (25/página), **export CSV**, checkbox **e-mail** (Resend opcional)

### Login social (Google, Facebook, Apple)

- Botões em `minha-conta.html` via `@supabase/supabase-js` (CDN)
- Guia de configuração: `docs/oauth-social-login.md`

### Configuração necessária (Supabase Dashboard)

1. **Auth → Providers** — Email (magic link) + Google + Facebook + Apple
2. **Auth → URL Configuration** — redirect: `https://miniforge.btencacorretora.com/minha-conta.html`
3. **Secrets** (opcional e-mail): `RESEND_API_KEY`, `NOTIFY_FROM_EMAIL` (ex. `MiniForge <pedidos@seudominio.com>`)

## Métricas de sucesso

- Cliente encontra pedido em &lt; 2 cliques após compra
- Operador localiza pedido por código em &lt; 10 s
- Zero exposição de PII na API pública `track-order`
