# MiniForge 3D

Site institucional e vitrine de vendas para produtos impressos em 3D, com foco em
action figures, miniaturas, decoração geek e encomendas personalizadas.

## Decisões iniciais

- Nome: MiniForge 3D
- Paleta: grafite escuro, laranja filamento e ciano tecnológico
- Stack: HTML, CSS e JavaScript puro
- Hospedagem: compatível com Hostinger em plano estático
- Pagamento: carrinho multi-itens; WhatsApp/Pix sempre; Mercado Pago opcional (Checkout Pro)
- Proteção: headers básicos de segurança configurados em `.htaccess`
- Banco futuro: Supabase Postgres com RLS para produtos, clientes e pedidos

## Segurança

Esta primeira versão não coleta cartão, não mantém banco de dados e não armazena
dados pessoais no servidor. O formulário apenas monta uma mensagem para o
WhatsApp, reduzindo a exposição de dados sensíveis.

O WhatsApp comercial está configurado em `script.js`. Depois do upload na
Hostinger, confirme se o SSL/HTTPS está ativo no painel.

## Loja online

A estrutura inicial do banco está em `supabase/migrations/0001_store_schema.sql`.
Ela foi aplicada em um projeto Supabase dedicado para a MiniForge 3D:

- Project ref: `fmlqsivgffzjryilnjcj`
- API URL: `https://fmlqsivgffzjryilnjcj.supabase.co`

O catálogo do site já busca os produtos ativos diretamente no Supabase. Se a API
ficar indisponível, o frontend usa uma lista local de fallback para não deixar a
vitrine vazia.

Pedidos online são registrados pela Edge Function `create-order`, que grava
cliente, pedido, item e evento inicial antes de abrir o WhatsApp com o código do
pedido.

Clientes podem consultar o andamento pela seção de acompanhamento, que usa a
Edge Function `track-order` e retorna apenas dados não sensíveis do pedido.

O painel administrativo está em `admin.html`. Ele usa login do Supabase Auth e a
Edge Function `admin-orders`; somente usuários cadastrados em `admin_users`
conseguem listar e atualizar pedidos (filtros por status/código, pagamento,
histórico de eventos e aba de clientes).

A **área do cliente** não exige login: `minha-conta.html` guarda os códigos MF3D
no navegador após cada pedido; `acompanhar.html` consulta status em tempo real.
Plano de produto: `docs/po-admin-client-area.md`.

### Login do cliente (fase 2)

- `minha-conta.html` — **Google, Facebook, Apple** ou magic link por e-mail
- Configure provedores no Supabase Auth — ver `docs/oauth-social-login.md`
- Redirect obrigatório: `https://miniforge.btencacorretora.com/minha-conta.html`
- E-mail de status (opcional): secrets `RESEND_API_KEY` e `NOTIFY_FROM_EMAIL`

O plano de evolução está em `docs/online-store-roadmap.md`.

## Carrinho

O cliente pode montar pedidos com vários itens:

- Adicionar pelo catálogo (botão **+ Carrinho**) ou na página do produto
- Revisar quantidades em `carrinho.html`
- Finalizar com nome, WhatsApp, e-mail e consentimento LGPD

O carrinho fica no navegador (`localStorage`, chave `miniforge_cart_v1`). Pedidos do
carrinho são enviados para `create-order` com `type: "cart"` e geram vários registros em
`order_items`, com subtotal em centavos quando os produtos têm preço base.

## Mercado Pago (pagamento online)

A integração usa **Checkout Pro** (link de pagamento). Edge Functions já publicadas no
projeto Supabase:

| Função | Papel |
|--------|--------|
| `create-payment` | Cria preferência no MP e devolve `checkout_url` |
| `mercadopago-webhook` | Atualiza `payment_status` quando o pagamento é aprovado |

Detalhes e limitações de negócio: `docs/mercadopago-viability.md`.

### O que falta configurar (faça quando for ativar)

1. Crie uma aplicação em [Mercado Pago Developers](https://www.mercadopago.com.br/developers)
   e copie o **Access Token** (recomendado: começar com token de **teste**).
2. No [Supabase Dashboard](https://supabase.com/dashboard/project/fmlqsivgffzjryilnjcj/settings/functions)
   → **Edge Functions** → **Secrets**, adicione:
   - `MERCADOPAGO_ACCESS_TOKEN` — token do Mercado Pago
   - `SITE_URL` — `https://miniforge.btencacorretora.com`
3. No painel do Mercado Pago, cadastre o **webhook** de pagamentos:
   `https://fmlqsivgffzjryilnjcj.supabase.co/functions/v1/mercadopago-webhook`
4. Valide: faça um pedido de teste no carrinho (itens com preço) e use o botão
   **Pagar com Mercado Pago**.

**Via CLI** (alternativa ao dashboard), após `supabase login`:

```bash
supabase secrets set \
  MERCADOPAGO_ACCESS_TOKEN=SEU_TOKEN_AQUI \
  SITE_URL=https://miniforge.btencacorretora.com \
  --project-ref fmlqsivgffzjryilnjcj
```

### Regras do site

- Sem `MERCADOPAGO_ACCESS_TOKEN`, `create-payment` responde `enabled: false` e o fluxo
  WhatsApp continua normal.
- O botão Mercado Pago só aparece quando **todos** os itens do carrinho têm
  `starting_price_cents` > 0 (produtos só “sob orçamento” seguem pelo WhatsApp).

### Deploy do site (Hostinger)

Arquivos do carrinho entram no upload FTP. Rode a partir do repositório
`btencacorretora` (lê `.env.local` com credenciais FTP):

```bash
cd /Library/projetos/btencacorretora
node scripts/ftp-upload-miniforge.mjs
```

## Primeiro administrador

1. Crie um usuário no Supabase Auth com e-mail e senha fortes.
2. Pegue o `id` do usuário criado.
3. Cadastre esse usuário em `public.admin_users`:

```sql
insert into public.admin_users (user_id, email, display_name)
values ('USER_ID_AQUI', 'email@exemplo.com', 'Administrador');
```

## QA

- Roteiro manual: `docs/qa-test-plan.md`
- Relatório da última execução: `docs/qa-execution-report.md`
- Validação de sintaxe: `npm run check`
- Testes automatizados: `npm test`
- Testes de navegação: `npm run test:e2e`

O advisor de segurança do Supabase indicou ativar leaked password protection no
Auth pelo painel do Supabase.