# Pagaê — Paulinho Veículos

Gestão de vendas parceladas de veículos: contratos, parcelas, conferência de
pagamentos Pix com leitura de comprovantes por IA, portal do cliente, cobrança
de devedores e relatórios.

Este projeto é a versão independente do app que rodava no Base44. Roda em
serviços com plano gratuito:

| Parte | Onde roda | Custo |
| --- | --- | --- |
| Site (React + Vite) | Vercel | grátis |
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

## Instalação (uma vez)

### 1. Supabase

1. Crie um projeto em [supabase.com](https://supabase.com) (região São Paulo).
2. Em **SQL Editor**, rode o arquivo `supabase/migrations/20261022000000_init.sql`.
3. Em **Authentication > Emails > Confirm signup**, troque o link pelo código
   de 6 dígitos (a tela de cadastro pede o código). Ex.:
   `Seu código de confirmação do Pagaê é: {{ .Token }}`
4. Em **Authentication > URL Configuration**, coloque o endereço do site
   (ex.: `https://pagae.vercel.app`) em *Site URL* e em *Redirect URLs*.
5. Publique as funções (precisa do [Supabase CLI](https://supabase.com/docs/guides/cli)):

   ```bash
   supabase login
   supabase link --project-ref SEU_PROJECT_REF
   supabase functions deploy
   ```

6. Configure os segredos das funções:

   ```bash
   supabase secrets set GEMINI_API_KEY=sua-chave PORTAL_SESSION_SECRET=$(openssl rand -hex 32)
   ```

   A chave do Gemini é gratuita em <https://aistudio.google.com/apikey>.
   Para usar o Claude no lugar do Gemini: `AI_PROVIDER=anthropic` e
   `ANTHROPIC_API_KEY=...`.

### 2. Primeiro administrador

Crie sua conta pela tela **Cadastro** do app (ou em *Authentication > Users*)
e depois, no **SQL Editor**:

```sql
update public.profiles set role = 'admin' where email = 'seu@email.com';
```

Os próximos administradores você convida pela tela **Usuários & Acessos**.

### 3. Vercel

1. Em [vercel.com](https://vercel.com), importe este repositório.
2. Em *Environment Variables*, adicione `VITE_SUPABASE_URL` e
   `VITE_SUPABASE_ANON_KEY` (Supabase > Project Settings > API).
3. Deploy. Para usar seu domínio, adicione-o em *Settings > Domains*.

## Rodar no computador

```bash
cp .env.example .env.local   # preencha com os dados do Supabase
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
