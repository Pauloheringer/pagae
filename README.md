# Pagaê — Paulinho Veículos

Gestão de vendas parceladas de veículos: contratos, parcelas, conferência de
pagamentos Pix com leitura de comprovantes por IA, portal do cliente, cobrança
de devedores e relatórios.

Este projeto é a versão independente do app que rodava no Base44. Roda em
serviços com plano gratuito:

| Parte | Onde roda | Custo |
| --- | --- | --- |
| Site (React + Vite) | Cloudflare Pages | grátis (sem limite de visitas) |
| Banco, login e arquivos | Supabase | grátis (500 MB de banco, 1 GB de arquivos) |
| Funções do servidor | Supabase Edge Functions | grátis (500 mil chamadas/mês) |
| IA (comprovantes, documentos, chat) | Google Gemini | grátis dentro do limite diário |

> O plano gratuito do Supabase pausa o projeto depois de 7 dias sem nenhum
> acesso. Com a loja usando todo dia, isso não acontece.

## O que mudou em relação ao Base44

- **Mesmas telas e regras.** O arquivo `src/api/base44Client.js` imita o SDK do
  Base44 em cima do Supabase, então as telas continuam praticamente iguais.
- **Tela de Contratos recriada.** O arquivo original era grande demais para
  exportar; foi refeita com o mesmo fluxo (busca, novo contrato em etapas com
  leitura da promissória por IA, edição de vencimentos).
- **Portal do cliente mais seguro.** No Base44 o portal guardava o id do
  cliente em texto puro: quem soubesse o id de outra pessoa via os dados dela.
  Agora o login por CPF + telefone gera uma sessão assinada com validade, e os
  links de "completar cadastro" e "ver portal" também são assinados.
- **Chat do cliente** só responde sobre o próprio cliente logado.
- **Login do cliente aceita o telefone com ou sem o 9/DDD** (compara os
  últimos 8 dígitos).
- **Regras de acesso no banco (RLS):** só administradores leem e alteram os
  dados; o histórico de auditoria não pode ser apagado.

## Situação atual

- **Projeto Supabase:** `pagae` (São Paulo), ref `bczolxydkubozqdcidwi`.
  Banco, regras de acesso, armazenamento e as 11 funções já estão publicados.
- **Endereço e chave pública** já estão em `.env.production`; o Cloudflare
  Pages não precisa de variáveis extras.

## O que falta configurar (uma vez)

1. **Segredos das funções** em
   [Supabase > Edge Functions > Secrets](https://supabase.com/dashboard/project/bczolxydkubozqdcidwi/functions/secrets):
   - `GEMINI_API_KEY`: sua chave do Google AI Studio.
   - `PORTAL_SESSION_SECRET`: um texto longo e aleatório (ex.: gere com
     `openssl rand -hex 32`). Não troque depois, ou os clientes precisarão
     entrar de novo.
2. **E-mail de cadastro com código**: em
   [Authentication > Emails](https://supabase.com/dashboard/project/bczolxydkubozqdcidwi/auth/templates),
   no modelo *Confirm signup*, use o código no lugar do link:
   `Seu código de confirmação do Pagaê é: {{ .Token }}`
3. **Site no ar (Cloudflare Pages)**: em
   [dash.cloudflare.com](https://dash.cloudflare.com) > *Workers & Pages* >
   *Create* > *Pages* > *Connect to Git*, escolha `Pauloheringer/pagae` e use:
   - Framework preset: **React (Vite)**
   - Build command: `npm run build`
   - Build output directory: `dist`

   Cada `git push` na branch `main` publica sozinho. O endereço fica algo como
   `https://pagae.pages.dev`; domínio próprio em *Custom domains*.
4. **Endereço do site no login**: em
   [Authentication > URL Configuration](https://supabase.com/dashboard/project/bczolxydkubozqdcidwi/auth/url-configuration),
   coloque o endereço do Cloudflare Pages (ex.: `https://pagae.pages.dev`) em
   *Site URL* e em *Redirect URLs*.
5. **Primeiro administrador**: crie sua conta pela tela **Cadastro** do site e
   depois rode no
   [SQL Editor](https://supabase.com/dashboard/project/bczolxydkubozqdcidwi/sql/new):

   ```sql
   update public.profiles set role = 'admin' where email = 'seu@email.com';
   ```

   Os próximos administradores você convida pela tela **Usuários & Acessos**.

## IA

As funções usam o Google Gemini (`gemini-flash-latest`, com
`gemini-flash-lite-latest` de reserva quando o primeiro estiver
sobrecarregado). Para trocar de modelo, crie o segredo `GEMINI_MODEL` com uma
lista separada por vírgula. Para usar o Claude: `AI_PROVIDER=anthropic` e
`ANTHROPIC_API_KEY`.

## Atualizar as funções depois de mudar o código

```bash
supabase login
supabase link --project-ref bczolxydkubozqdcidwi
supabase functions deploy
```

## Rodar no computador

```bash
npm install
npm run dev
```

## Estrutura

```
src/api/base44Client.js     camada que imita o SDK do Base44 usando Supabase
src/functions/*             atalhos para chamar as Edge Functions
src/pages/*                 telas
supabase/migrations/        tabelas, regras de acesso e armazenamento
supabase/functions/         funções do servidor (IA, portal do cliente, convites)
```
