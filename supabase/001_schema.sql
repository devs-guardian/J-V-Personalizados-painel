-- =====================================================================
-- J&V Personalizados — schema do Supabase
-- Rode este arquivo inteiro no SQL Editor do Supabase (uma vez).
-- Segurança: toda separação de acesso é feita aqui, com RLS.
-- =====================================================================

create type app_role as enum ('gestao', 'operacional');
create type pedido_status as enum ('novo', 'producao', 'pronto', 'enviado', 'cancelado');
create type rep_tipo as enum ('filamento', 'insumo', 'expansao');
create type rep_status as enum ('pendente', 'aprovado', 'negado');

-- ---------- usuários e papéis ----------
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  nome text,
  email text,
  role app_role,            -- null = aguardando liberação
  criado_em timestamptz not null default now()
);

create function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, nome)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)));
  return new;
end $$;

create trigger on_auth_user_created
after insert on auth.users for each row execute function handle_new_user();

create function auth_role() returns app_role
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid()
$$;

create function is_gestao() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(auth_role() = 'gestao', false)
$$;

create function is_equipe() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(auth_role() in ('gestao', 'operacional'), false)
$$;

-- ---------- custos, taxas e capacidade ----------
create table config (
  id int primary key default 1 check (id = 1),
  filamento_kg numeric not null default 74,
  maquina_h numeric not null default 2,
  hora_sua numeric not null default 20
);

create table capacidade (
  id int primary key default 1 check (id = 1),
  impressoras int not null default 1 check (impressoras >= 1),
  horas_dia numeric not null default 20
);

create table plataformas (
  id text primary key,
  nome text not null,
  ordem int not null default 0,
  lim numeric not null default 0,
  c_low numeric not null default 0,
  f_low numeric not null default 0,
  c_high numeric not null default 0,
  f_high numeric not null default 0,
  outras numeric not null default 0,
  imposto numeric not null default 0,
  pag numeric not null default 0,
  anuncio numeric not null default 0,
  frete numeric not null default 0,
  margem numeric not null default 0.25
);

-- ---------- produtos ----------
create table produtos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  gramas numeric not null default 0,
  purga numeric not null default 0,
  tempo_min numeric not null default 0,
  pecas_mesa numeric not null default 1,
  falhas numeric not null default 0.1,
  seu_tempo_peca numeric not null default 0,
  embalagem numeric not null default 1.8,
  tempo_pedido numeric not null default 10,
  pecas_pedido numeric not null default 1,
  ativo boolean not null default true,
  precos jsonb not null default '{}'::jsonb   -- preço fixo por plataforma (id -> valor)
);

-- ---------- pedidos ----------
create table pedidos (
  id uuid primary key default gen_random_uuid(),
  num bigint generated always as identity,
  cliente text not null default '',
  plataforma text not null,
  status pedido_status not null default 'novo',
  obs text not null default '',
  rastreio text not null default '',
  criado_em timestamptz not null default now(),
  pronto_em timestamptz,
  enviado_em timestamptz,
  criado_por uuid default auth.uid()
);

-- itens: o que a operação precisa ver (sem preço)
create table pedido_itens (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references pedidos on delete cascade,
  produto_id uuid references produtos on delete set null,
  nome text not null,
  qtd int not null check (qtd > 0),
  gramas numeric not null default 0,      -- consumo por unidade (com falhas)
  tempo_min numeric not null default 0    -- tempo de impressão por unidade
);

-- financeiro: só a gestão enxerga
create table pedido_financeiro (
  pedido_id uuid primary key references pedidos on delete cascade,
  total numeric not null default 0,
  lucro numeric not null default 0,
  itens jsonb not null default '[]'::jsonb  -- [{item_id, preco, lucro}]
);

-- ---------- estoque e compras ----------
create table filamentos (
  id uuid primary key default gen_random_uuid(),
  cor text not null,
  material text not null default 'PLA',
  estoque_g numeric not null default 0,
  min_g numeric not null default 300,
  ativo boolean not null default true
);

create table reposicoes (
  id uuid primary key default gen_random_uuid(),
  tipo rep_tipo not null,
  item text not null,
  qtd numeric not null default 1,
  unidade text not null default '',
  valor numeric not null default 0,
  motivo text not null default '',
  fil_id uuid references filamentos on delete set null,
  por uuid default auth.uid() references profiles,
  criado_em timestamptz not null default now(),
  status rep_status not null default 'pendente',
  nota text not null default '',
  decidido_por uuid references profiles,
  decidido_em timestamptz,
  recebido boolean not null default false,
  recebido_em timestamptz
);

-- ---------- travas de coluna (a operação só mexe no que pode) ----------
create function guard_pedidos() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if is_gestao() then return new; end if;
  if (new.num, new.cliente, new.plataforma, new.obs, new.criado_em, new.criado_por)
     is distinct from (old.num, old.cliente, old.plataforma, old.obs, old.criado_em, old.criado_por) then
    raise exception 'Sem permissão para alterar este campo do pedido';
  end if;
  if new.status not in ('producao', 'pronto', 'enviado') then
    raise exception 'Status não permitido para a operação';
  end if;
  return new;
end $$;
create trigger guard_pedidos before update on pedidos for each row execute function guard_pedidos();

create function guard_reposicoes() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if is_gestao() then return new; end if;
  if (new.status, new.nota, new.decidido_por, new.decidido_em, new.tipo, new.item, new.qtd, new.unidade, new.valor, new.por)
     is distinct from (old.status, old.nota, old.decidido_por, old.decidido_em, old.tipo, old.item, old.qtd, old.unidade, old.valor, old.por) then
    raise exception 'Somente a gestão decide ou altera solicitações';
  end if;
  if new.recebido and not old.recebido and old.status <> 'aprovado' then
    raise exception 'Só é possível receber o que foi aprovado';
  end if;
  return new;
end $$;
create trigger guard_reposicoes before update on reposicoes for each row execute function guard_reposicoes();

-- ---------- funções atômicas (RPC) ----------
create function criar_pedido(p_cliente text, p_plataforma text, p_obs text, p_itens jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_item jsonb; v_item_id uuid; v_fin jsonb := '[]'::jsonb; v_total numeric := 0; v_lucro numeric := 0;
begin
  if not is_gestao() then raise exception 'Somente a gestão cria pedidos'; end if;
  insert into pedidos (cliente, plataforma, obs) values (coalesce(p_cliente, ''), p_plataforma, coalesce(p_obs, ''))
  returning id into v_id;
  for v_item in select * from jsonb_array_elements(p_itens) loop
    insert into pedido_itens (pedido_id, produto_id, nome, qtd, gramas, tempo_min)
    values (v_id, nullif(v_item->>'produto_id', '')::uuid, v_item->>'nome', (v_item->>'qtd')::int,
            coalesce((v_item->>'gramas')::numeric, 0), coalesce((v_item->>'tempo_min')::numeric, 0))
    returning id into v_item_id;
    v_total := v_total + (v_item->>'qtd')::numeric * (v_item->>'preco')::numeric;
    v_lucro := v_lucro + (v_item->>'qtd')::numeric * (v_item->>'lucro')::numeric;
    v_fin := v_fin || jsonb_build_object('item_id', v_item_id, 'preco', (v_item->>'preco')::numeric, 'lucro', (v_item->>'lucro')::numeric);
  end loop;
  insert into pedido_financeiro (pedido_id, total, lucro, itens) values (v_id, v_total, v_lucro, v_fin);
  return v_id;
end $$;

create function concluir_pedido(p_id uuid, p_fil uuid, p_gramas numeric)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_equipe() then raise exception 'Sem permissão'; end if;
  update pedidos set status = 'pronto', pronto_em = now() where id = p_id and status in ('novo', 'producao');
  if p_fil is not null and coalesce(p_gramas, 0) > 0 then
    update filamentos set estoque_g = greatest(0, estoque_g - p_gramas) where id = p_fil;
  end if;
end $$;

create function receber_reposicao(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r reposicoes;
begin
  if not is_equipe() then raise exception 'Sem permissão'; end if;
  select * into r from reposicoes where id = p_id for update;
  if r.status <> 'aprovado' or r.recebido then raise exception 'Solicitação não está aprovada ou já foi recebida'; end if;
  update reposicoes set recebido = true, recebido_em = now() where id = p_id;
  if r.fil_id is not null and lower(r.unidade) like 'kg%' then
    update filamentos set estoque_g = estoque_g + r.qtd * 1000 where id = r.fil_id;
  end if;
end $$;

-- ---------- RLS ----------
alter table profiles enable row level security;
alter table config enable row level security;
alter table capacidade enable row level security;
alter table plataformas enable row level security;
alter table produtos enable row level security;
alter table pedidos enable row level security;
alter table pedido_itens enable row level security;
alter table pedido_financeiro enable row level security;
alter table filamentos enable row level security;
alter table reposicoes enable row level security;

create policy "perfil: ver o próprio ou todos (gestão)" on profiles for select using (id = auth.uid() or is_gestao());
create policy "perfil: gestão altera papéis" on profiles for update using (is_gestao()) with check (is_gestao());

create policy "config: gestão" on config for all using (is_gestao()) with check (is_gestao());
create policy "plataformas: gestão" on plataformas for all using (is_gestao()) with check (is_gestao());
create policy "produtos: gestão" on produtos for all using (is_gestao()) with check (is_gestao());
create policy "financeiro: gestão" on pedido_financeiro for all using (is_gestao()) with check (is_gestao());

create policy "capacidade: equipe lê" on capacidade for select using (is_equipe());
create policy "capacidade: gestão grava" on capacidade for all using (is_gestao()) with check (is_gestao());

create policy "pedidos: equipe lê" on pedidos for select using (is_equipe());
create policy "pedidos: equipe atualiza (trava por coluna)" on pedidos for update using (is_equipe()) with check (is_equipe());
create policy "pedidos: gestão apaga" on pedidos for delete using (is_gestao());

create policy "itens: equipe lê" on pedido_itens for select using (is_equipe());
create policy "itens: gestão altera" on pedido_itens for all using (is_gestao()) with check (is_gestao());

create policy "filamentos: equipe lê" on filamentos for select using (is_equipe());
create policy "filamentos: equipe cria" on filamentos for insert with check (is_equipe());
create policy "filamentos: equipe atualiza" on filamentos for update using (is_equipe()) with check (is_equipe());
create policy "filamentos: gestão apaga" on filamentos for delete using (is_gestao());

create policy "reposições: equipe lê" on reposicoes for select using (is_equipe());
create policy "reposições: equipe solicita" on reposicoes for insert
  with check (is_equipe() and status = 'pendente' and por = auth.uid());
create policy "reposições: equipe atualiza (trava por coluna)" on reposicoes for update using (is_equipe()) with check (is_equipe());
create policy "reposições: apagar a própria pendente ou gestão" on reposicoes for delete
  using (is_gestao() or (por = auth.uid() and status = 'pendente'));

-- ---------- tempo real ----------
alter publication supabase_realtime add table pedidos, pedido_itens, filamentos, reposicoes, capacidade;
