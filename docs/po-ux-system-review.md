# Revisão PO + UX — MiniForge 3D

**Data:** 2026-05-20  
**Escopo:** Loja pública, personalizado, área do cliente, admin, integrações  
**Produção:** https://miniforge.btencacorretora.com/

---

## Veredito executivo

A base comercial está **madura o suficiente para operar**: catálogo, carrinho, compra assistida, personalizado com fotos, rastreio e admin com referências visuais. Os principais riscos atuais são de **confiança e clareza**, não de ausência de funcionalidade:

1. **Cache/CDN** — `index.html` e `catalogo.html` ainda sem `?v=` em CSS/JS (risco de regressão já vivida).
2. **Promessas não configuradas** — OAuth social e Mercado Pago expostos na UI sem backend pronto.
3. **Pós-pedido frágil** — sucesso depende de popup WhatsApp + mensagem temporária, sem tela de confirmação.

---

## Personas e jornadas

| Persona | Jornada principal | Estado |
|---------|-------------------|--------|
| Comprador | Catálogo → Produto → Carrinho → WhatsApp/MP | OK (MP off) |
| Encomenda personalizada | Personalizado → fotos → MF3D → WhatsApp | OK |
| Cliente retorno | Código MF3D → Acompanhar / Minha conta | OK |
| Operador | Admin → filtrar → status → ver fotos ref. | OK |

---

## Matriz de maturidade

| Módulo | Status | Gap |
|--------|--------|-----|
| Catálogo + compra | Pronto | MP não configurado |
| Personalizado + fotos | Pronto | Cliente não vê fotos após envio |
| Minha conta | Parcial | OAuth; dois históricos confusos |
| Acompanhar | Pronto | Duplicado na home |
| Admin | Pronto | Desktop-first |
| Confiabilidade deploy | Atenção | Versões de asset inconsistentes |

---

## Achados UX/UI (priorizados)

### P0 — Bloqueiam confiança

| # | Problema | Onde | Recomendação |
|---|----------|------|--------------|
| 1 | CSS/JS sem cache-bust em home e catálogo | `index.html`, `catalogo.html` | Unificar `?v=20260521a` (ou build automático) |
| 2 | Login social visível sem providers | `minha-conta.html` | Configurar Supabase Auth ou ocultar botões |
| 3 | Botão Mercado Pago sem integração | `carrinho.html` | Secrets MP ou esconder até `enabled: true` |

### P1 — Fricção na conversão

| # | Problema | Recomendação |
|---|----------|--------------|
| 4 | Minha conta: “neste navegador” vs “na sua conta” | Tabs + texto educativo |
| 5 | Sem página de confirmação pós-pedido | `/pedido-registrado.html?pedido=MF3D-…` |
| 6 | Upload de fotos: feedback fraco no envio | Barra de progresso + resumo “X fotos recebidas” |
| 7 | Home longa (rastreio + 2 CTAs catálogo + personalizado) | Rastreio só via menu; um CTA principal |

### P2 — Polish

| # | Problema | Recomendação |
|---|----------|--------------|
| 8 | Busca do header em páginas não-catálogo | Redirecionar para `catalogo.html?q=` |
| 9 | WhatsApp flutuante cobre CTA no mobile | Ajustar posição em formulários |
| 10 | Badges de tipo de pedido ausentes | Orçamento / Compra / Carrinho na conta |

---

## Backlog PO recomendado (próximo sprint)

1. **Unificar versionamento** de todos os assets (script de deploy ou template).
2. **Feature flags** para OAuth e MP até configuração no Supabase.
3. **Página de sucesso** após pedido (código, link acompanhar, WhatsApp).
4. **Redesign Minha conta** — tabs, empty states, status visual.
5. **Fila admin** “Orçamentos com foto” (filtro `quote_requested` + anexo).

---

## Pontos fortes (manter)

- Página **personalizado.html** dedicada com categoria busto e upload até 5 fotos.
- **Admin** exibe fotos de referência (storage privado + URL assinada).
- **Segurança**: track-order sem PII; consentimento LGPD; honeypot.
- **Navegação** coerente: Personalizados no menu aponta para página correta.
- **Testes**: 18/18 unitários + E2E produção nos fluxos críticos.

---

## Métricas PO (do doc original)

| Métrica | Meta | Situação atual |
|---------|------|----------------|
| Cliente acha pedido em &lt; 2 cliques | Sim | OK se salvou localmente |
| Operador acha código em &lt; 10 s | Sim | OK com filtro admin |
| Zero PII em track-order | Sim | Validado |

---

## Canvas interativo

Abra o canvas **po-ux-system-review** ao lado do chat para ver tabelas e priorização visual.
