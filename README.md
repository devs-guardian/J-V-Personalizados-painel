# J&V Personalizados — sistema interno

Vite + React + TypeScript + Supabase (Auth, Postgres, Realtime). Sem backend próprio.

- **Gestão (Victor):** resumo com gráficos, pedidos, produtos e preços, custos e taxas, aprovações, usuários.
- **Operacional:** fila de produção, envios, estoque de filamento, solicitações de reposição.

As permissões ficam no banco (RLS, triggers e funções RPC). O operacional não consegue ver preço, lucro nem custos, mesmo usando o console do navegador.

## Configuração

1. Crie um projeto em https://supabase.com.
2. No **SQL Editor**, rode na ordem: `supabase/001_schema.sql`, `supabase/002_seed.sql`. Antes de rodar o seed, troque `TROQUE-ESTA-SENHA` (no bloco de usuários, ao final) pela senha inicial. O seed cria:
   - `victor@jevpersonalizados.com`: **gestão**
   - `joaovitor@jevpersonalizados.com`: **operacional**
3. **Authentication → Providers → Email:** desligue "Allow new users to sign up" (só você cria usuários).
4. Para adicionar outras pessoas: **Authentication → Users → Add user** (com senha, marque "Auto confirm") e depois defina o papel na tela **Usuários** do app. `supabase/003_primeiro_admin.sql` só é necessário para promover outro e-mail a gestão direto pelo SQL.
5. **Authentication → URL Configuration:** coloque a URL do site em Site URL e `https://SEU-SITE/redefinir` em Redirect URLs (para "esqueci a senha").
6. Copie `.env.example` para `.env` e preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (Project Settings → API; use a chave anon/publishable, nunca a service_role).

```bash
npm install
npm run dev      # desenvolvimento
npm run build    # gera dist/
```

## Deploy

Publique a pasta `dist/` na Vercel, Netlify ou Cloudflare Pages, com as duas variáveis de ambiente. Configure o fallback de SPA (todas as rotas para `index.html`); na Vercel/Netlify/Cloudflare Pages isso é automático ou via `_redirects`.

## Observações

- Pedidos guardam o preço da época; mudar taxas depois não altera pedidos antigos.
- A capacidade do gráfico usa `impressoras × horas por dia` (Custos → Custos gerais, ou o seletor no Resumo).
- Taxas e imposto das plataformas são de exemplo: confira nas Centrais do Vendedor.
