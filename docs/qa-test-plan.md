# Plano de testes QA — MiniForge 3D

**Site:** https://miniforge.btencacorretora.com/  
**Projeto Supabase:** `fmlqsivgffzjryilnjcj`  
**Última revisão:** 2026-05-20

---

## 1. Objetivo e escopo

Validar a loja pública (catálogo, carrinho, pedidos, acompanhamento, área do cliente), o painel admin e as integrações (Supabase, WhatsApp, Mercado Pago, login social), com foco em regressões de cache, segurança e fluxos de conversão.

| Área | Incluído | Fora do escopo |
|------|----------|----------------|
| Páginas públicas | Sim | Conteúdo editorial (textos de marketing) |
| Admin | Sim | Infra Hostinger/FTP |
| APIs Edge | Sim | Código interno Deno em detalhe |
| App mobile nativo | Não | — |
| Carga / stress | Não | — |

---

## 2. Ambientes

| Ambiente | URL | Uso |
|----------|-----|-----|
| Produção | https://miniforge.btencacorretora.com/ | Smoke, regressão, aceite |
| Local | `python3 -m http.server 4175` + `E2E_BASE_URL` | Desenvolvimento e E2E |

**Pré-requisitos:** `.env.local` com `LOGIN_USER_APPLICATION` / `LOGIN_PASSWORD_APPLICATION` para testes admin.

---

## 3. Matriz de casos de teste

### 3.1 Smoke — disponibilidade (P0)

| ID | Caso | Passos | Resultado esperado |
|----|------|--------|-------------------|
| SM-01 | Home HTTP 200 | GET `/` e `/index.html` | 200, scripts com `?v=` |
| SM-02 | Páginas institucionais | Abrir como-funciona, faq, frete, privacidade | 200, menu e rodapé |
| SM-03 | Catálogo | Abrir `/catalogo.html` | Grid com ≥1 produto |
| SM-04 | APIs Supabase | GET `products` e `categories` ativos | 200, JSON válido |
| SM-05 | Edge functions | `track-order` inválido, `admin-orders` sem token | 400/404 e 401 |
| SM-06 | Sem vazamento de secrets | Inspecionar HTML/JS público | Sem `service_role` |

### 3.2 Home e catálogo (P0)

| ID | Caso | Passos | Resultado esperado |
|----|------|--------|-------------------|
| HM-01 | Categorias na home | Aguardar 20s após load | Pills de categoria visíveis, sem “Carregando…” fixo |
| HM-02 | Mais vendidos | Aguardar grid | ≥1 `.product-card` real (não só skeleton) |
| HM-03 | Navegação bfcache | Home → Catálogo → Voltar | Categorias e destaques recarregam |
| HM-04 | Filtro categoria | `/catalogo.html?categoria=miniaturas-rpg` | Produtos filtrados |
| HM-05 | Busca | Digitar nome de produto no catálogo | Lista filtra |
| HM-06 | Ordenação / preço | Alterar sort e faixa de preço | Grid atualiza, URL reflete estado |
| HM-07 | Falha de API | Simular offline (DevTools) | Fallback ou mensagem + retry |
| HM-08 | Produto válido | `/produto.html?slug=miniatura-dragao-de-mesa` | Detalhe, formulário compra |
| HM-09 | Produto inválido | `slug=nao-existe` | Mensagem “não encontrado” + links |

### 3.3 Carrinho e checkout (P0)

| ID | Caso | Passos | Resultado esperado |
|----|------|--------|-------------------|
| CT-01 | Adicionar ao carrinho | Catálogo → “+ Carrinho” → Carrinho | Linha em `#cart-items-panel` |
| CT-02 | Alterar quantidade | Mudar qtd no carrinho | Total atualiza |
| CT-03 | Remover item | Clicar Remover | Carrinho vazio ou sem linha |
| CT-04 | Checkout sem consentimento | Submeter sem checkbox | Bloqueio (nativo ou msg LGPD) |
| CT-05 | Checkout WhatsApp | Nome, tel, consent → Registrar | Código MF3D + popup WhatsApp |
| CT-06 | Mercado Pago | Carrinho só com preço fixo → MP | Redirect ou msg se MP desligado |
| CT-07 | Retorno MP | `?pagamento=sucesso&pedido=MF3D-...` | Mensagem de status no carrinho |

### 3.4 Orçamento e acompanhamento (P0)

| ID | Caso | Passos | Resultado esperado |
|----|------|--------|-------------------|
| OR-01 | Orçamento home | Form `#quote-form` completo + consent | MF3D + WhatsApp |
| OR-02 | Acompanhar home | Código válido MF3D | Status, itens, eventos |
| OR-03 | Código inválido | `MF3D-00000000-INVALID1` | “Pedido não encontrado” |
| OR-04 | Página acompanhar | `/acompanhar.html?pedido=...` | Auto-consulta se configurado |
| OR-05 | Sem PII | Resposta track-order | Sem nome/telefone/e-mail |

### 3.5 Minha conta (P1)

| ID | Caso | Passos | Resultado esperado |
|----|------|--------|-------------------|
| AC-01 | UI login | Abrir minha-conta | OAuth Google/FB/Apple + magic link |
| AC-02 | Magic link | E-mail válido → submit | Mensagem de envio (depende Auth) |
| AC-03 | OAuth Google | Continuar com Google | Redirect Supabase (config painel) |
| AC-04 | Histórico local | Após pedido, listar em “Neste navegador” | Card com código MF3D |
| AC-05 | Adicionar código | Form adicionar pedido | Salva e consulta |
| AC-06 | Pedidos nuvem | Login → my-orders | Lista vinculada ao e-mail |

### 3.6 Admin (P1)

| ID | Caso | Passos | Resultado esperado |
|----|------|--------|-------------------|
| AD-01 | Bloqueio anônimo | GET admin-orders sem JWT | 401 |
| AD-02 | Login inválido | Credenciais erradas | Erro, painel oculto |
| AD-03 | Login válido | Credenciais `.env.local` | Dashboard e pedidos |
| AD-04 | Alterar status | Mudar status + evento | Reflete em track-order público |
| AD-05 | CRUD produto | Criar/editar/desativar | Catálogo público atualiza |
| AD-06 | Filtros e paginação | Filtrar pedidos, trocar página | Lista coerente |
| AD-07 | Export CSV | Exportar pedidos | Download CSV |
| AD-08 | E-mail status | Checkbox notificar (se Resend OK) | E-mail enviado |

### 3.7 Segurança e compliance (P0)

| ID | Caso | Resultado esperado |
|----|------|-------------------|
| SE-01 | CSP | Apenas origens esperadas; scripts externos declarados |
| SE-02 | Headers | `X-Frame-Options`, `nosniff`, `frame-ancestors` |
| SE-03 | LGPD | Checkbox consent em formulários de pedido |
| SE-04 | Honeypot | Campo `company` no orçamento |
| SE-05 | Auth admin | Apenas `admin_users` ativos |

### 3.8 UX, responsivo e acessibilidade (P2)

| ID | Caso | Resultado esperado |
|----|------|-------------------|
| UX-01 | Mobile 375px | Menu, catálogo e formulários usáveis |
| UX-02 | WhatsApp flutuante | Não cobre botões principais |
| UX-03 | Landmarks | `main`, breadcrumbs onde aplicável |
| UX-04 | Imagens produto | Todas com foto no catálogo ativo |

### 3.9 Regressão automatizada

| Comando | Cobertura |
|---------|-----------|
| `npm run check` | Sintaxe JS |
| `npm test` | Estático, API, qualidade catálogo |
| `node --test tests/production-smoke.test.mjs` | Smoke HTTP produção |
| `E2E_BASE_URL=https://miniforge.btencacorretora.com npm run test:e2e` | Fluxos Playwright |
| `npx playwright test tests/e2e/qa-audit.spec.mjs` | Auditoria ampliada |

---

## 4. Critérios de aceite

- **P0:** 100% passando em produção (manual ou E2E).
- **P1:** Sem bloqueadores; pendências operacionais documentadas.
- **P2:** Máximo 3 itens médios abertos com workaround.

---

## 5. Severidade dos defeitos

| Nível | Definição |
|-------|-----------|
| Crítica | Loja inutilizável (catálogo não carrega, pedido não registra) |
| Alta | Fluxo principal quebrado ou perda de dados |
| Média | Funciona com workaround; UX degradada |
| Baixa | Cosmético, analytics, melhoria |

---

## 6. Riscos conhecidos

1. **Cache CDN (7 dias)** — HTML/JS antigos no navegador; mitigação: query `?v=` nos scripts.
2. **Configuração Supabase** — MP, OAuth, Resend dependem do painel.
3. **CSP vs analytics** — Plausible bloqueado até ajuste no `.htaccess`.
