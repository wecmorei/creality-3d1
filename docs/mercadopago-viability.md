# Mercado Pago — viabilidade MiniForge 3D

## Resumo

A integração é **viável e relativamente simples** usando **Checkout Pro** (link de pagamento). Já está implementada no backend:

| Componente | Função |
|------------|--------|
| `create-payment` | Cria preferência MP e devolve `checkout_url` |
| `mercadopago-webhook` | Atualiza `payment_status` quando o pagamento é aprovado |
| `carrinho.html` | Botão "Pagar com Mercado Pago" (quando aplicável) |

## O que você precisa configurar

1. Conta [Mercado Pago Developers](https://www.mercadopago.com.br/developers)
2. Criar aplicação e obter **Access Token** (produção ou teste)
3. No Supabase → Edge Functions → Secrets:
   - `MERCADOPAGO_ACCESS_TOKEN` = seu token
   - `SITE_URL` = `https://miniforge.btencacorretora.com`
4. Publicar as funções `create-payment` e `mercadopago-webhook`
5. No painel MP, configurar **Webhooks** apontando para:
   `https://fmlqsivgffzjryilnjcj.supabase.co/functions/v1/mercadopago-webhook`

## Limitação importante (negócio 3D)

Muitos produtos são **"Sob orçamento"** sem `starting_price_cents`. O Mercado Pago exige valor numérico por item.

**Regra atual do site:** botão Mercado Pago só aparece quando **todos** os itens do carrinho têm preço base em centavos.

Produtos só com orçamento continuam pelo fluxo WhatsApp + Pix manual.

## Fluxo do cliente

1. Adiciona itens ao carrinho  
2. Preenche nome/WhatsApp e registra pedido  
3. Opção A: WhatsApp (sempre disponível)  
4. Opção B: Mercado Pago (se todos os itens têm preço) → redirect → retorno ao site  

## Complexidade

| Item | Esforço |
|------|---------|
| Checkout Pro (implementado) | Baixo |
| Webhook confirmação | Baixo |
| Pix nativo MP | Médio (já incluso no Checkout) |
| Parcelamento / split | Médio-alto |
| Reembolso automático | Médio |

## Próximos passos recomendados

1. Configurar token de **teste** e validar um pedido sandbox  
2. Ativar token de **produção**  
3. Opcional: e-mail ao cliente quando webhook confirmar pagamento  
4. Opcional: no admin, exibir link "Reenviar pagamento MP"
