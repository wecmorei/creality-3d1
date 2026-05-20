# Roadmap da loja online MiniForge 3D

## Fase 1 - MVP comercial

- Vitrine com catálogo inicial.
- Pedido assistido por WhatsApp.
- Pagamento via Pix ou link externo.
- Hospedagem estática na Hostinger.
- Sem armazenamento de cartão no site.

## Fase 2 - Base Supabase

- Projeto Supabase dedicado criado: `miniforge-3d`.
- Migrations aplicadas:
  - `supabase/migrations/0001_store_schema.sql`
  - `supabase/migrations/0002_harden_store_schema.sql`
- Catálogo público conectado ao Supabase via REST.
- Usar Storage para fotos de produtos e referências de clientes.
- Manter RLS ativo em todas as tabelas públicas.
- Expor publicamente apenas categorias, produtos ativos e imagens de produtos ativos.

## Fase 3 - Pedidos online

- Edge Function `create-order` criada para registrar pedido.
- Edge Function `track-order` criada para consulta pública por código.
- Validação server-side de nome, telefone, categoria, tamanho e descrição.
- Geração de código público de pedido.
- Consulta de status de acompanhamento sem expor dados pessoais do cliente.
- Continuação do atendimento via WhatsApp com código do pedido.

## Fase 4 - Admin

- Login administrativo via Supabase Auth.
- Tabela `admin_users` criada para autorizar usuários administrativos.
- Edge Function `admin-orders` criada para listar pedidos e atualizar status.
- Edge Function `admin-products` criada para listar e salvar produtos.
- Painel `admin.html` criado para gestão operacional.
- Cadastro e edição de produtos iniciado no painel.
- Upload de fotos.
- Gestão de pedidos e status de produção iniciada.
- Registro de eventos do pedido pelo painel.

## Fase 5 - Checkout

- Integração com Mercado Pago, PagSeguro ou Stripe.
- Webhook para confirmar pagamento.
- Atualização automática de `payment_status`.
- Nenhum dado de cartão salvo no Supabase.

## Fase 6 - Ajustes PO (2026-05-21)

- Badges **Compra direta** / **Sob orçamento** no catálogo, produto e carrinho.
- Página **termos.html** e FAQ atualizado (prazo, sinal, troca).
- Galeria **Trabalhos entregues** na home (placeholders para fotos reais).
- Feature flags MP e OAuth ativos em `site-config.js` (assumindo secrets configurados).
- Admin: atalho no resumo **Ver orçamentos com foto**.
- Versão de assets unificada (`20260521c`).

## QA contínuo

- Roteiro manual em `docs/qa-test-plan.md`.
- Testes automatizados em `tests/static.test.mjs`.
- Scripts:
  - `npm run check`
  - `npm test`
- Pendência operacional: ativar leaked password protection no Supabase Auth.
