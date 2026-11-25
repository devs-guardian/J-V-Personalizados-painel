-- Filamento por cor em cada produto: consumo por pedido e baixa de estoque por cor.
-- Rode no SQL Editor do Supabase, depois do 004. Pode ser rodado mais de uma vez.

-- produtos.cores: { "<id do filamento>": gramas }, na mesma base do campo "gramas"
alter table produtos add column if not exists cores jsonb not null default '{}'::jsonb;
-- pedido_itens.cores: { "<id do filamento>": gramas por unidade, já com purga e falhas }
-- (cópia no item porque a operação não pode ler a tabela de produtos)
alter table pedido_itens add column if not exists cores jsonb not null default '{}'::jsonb;

create or replace function soma_cores(p_cores jsonb) returns numeric
language sql immutable set search_path = public as $$
  select coalesce(sum(value::numeric), 0) from jsonb_each_text(p_cores)
$$;

/** Divide o consumo de uma unidade entre as cores, na proporção da receita. */
create or replace function repartir_cores(p_cores jsonb, p_gramas numeric) returns jsonb
language sql immutable set search_path = public as $$
  select case when soma_cores(p_cores) > 0 then
    (select jsonb_object_agg(key, round(p_gramas * value::numeric / soma_cores(p_cores), 3)) from jsonb_each_text(p_cores))
  else '{}'::jsonb end
$$;

-- receita aceita: { "<uuid do filamento>": número maior que zero }
create or replace function cores_validas(p_cores jsonb) returns boolean
language sql immutable set search_path = public as $$
  select case when jsonb_typeof(p_cores) <> 'object' then false else not exists (
    select 1 from jsonb_each(p_cores)
    where key !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       or case when jsonb_typeof(value) = 'number' then value::text::numeric <= 0 else true end
  ) end
$$;
alter table produtos drop constraint if exists produtos_cores_validas;
alter table produtos add constraint produtos_cores_validas check (cores_validas(cores));

-- o peso do produto passa a ser a soma das cores
create or replace function soma_gramas_produto() returns trigger
language plpgsql set search_path = public as $$
begin
  if soma_cores(new.cores) > 0 then new.gramas := soma_cores(new.cores); end if;
  return new;
end $$;
drop trigger if exists soma_gramas_produto on produtos;
create trigger soma_gramas_produto before insert or update on produtos
for each row execute function soma_gramas_produto();

-- item novo copia as cores do produto
create or replace function copia_cores_item() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_cores jsonb;
begin
  select cores into v_cores from produtos where id = new.produto_id;
  new.cores := repartir_cores(coalesce(v_cores, '{}'::jsonb), new.gramas);
  return new;
end $$;
drop trigger if exists copia_cores_item on pedido_itens;
create trigger copia_cores_item before insert on pedido_itens
for each row execute function copia_cores_item();

-- mudou a receita: atualiza os pedidos ainda não produzidos
create or replace function atualiza_cores_abertos() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_gramas numeric;
begin
  if (new.cores, new.purga, new.falhas) is not distinct from (old.cores, old.purga, old.falhas) then return new; end if;
  if soma_cores(new.cores) > 0 then
    v_gramas := (new.gramas + new.purga) * (1 + new.falhas);
    update pedido_itens i set gramas = v_gramas, cores = repartir_cores(new.cores, v_gramas)
      from pedidos p where p.id = i.pedido_id and p.status in ('novo', 'producao') and i.produto_id = new.id;
  elsif soma_cores(old.cores) > 0 then
    update pedido_itens i set cores = '{}'::jsonb
      from pedidos p where p.id = i.pedido_id and p.status in ('novo', 'producao') and i.produto_id = new.id;
  end if;
  return new;
end $$;
drop trigger if exists atualiza_cores_abertos on produtos;
create trigger atualiza_cores_abertos after update on produtos
for each row execute function atualiza_cores_abertos();

-- conclui o pedido e baixa várias cores de uma vez: [{ "fil_id": ..., "gramas": ... }]
-- devolve false quando o pedido já tinha sido concluído
drop function if exists concluir_pedido_cores(uuid, jsonb);  -- o tipo de retorno mudou
create function concluir_pedido_cores(p_id uuid, p_consumo jsonb)
returns boolean language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  if not is_equipe() then raise exception 'Sem permissão'; end if;
  if exists (select 1 from jsonb_array_elements(coalesce(p_consumo, '[]'::jsonb)) e where coalesce((e->>'gramas')::numeric, -1) < 0) then
    raise exception 'Gramas não podem ser negativos nem vazios';
  end if;
  update pedidos set status = 'pronto', pronto_em = now() where id = p_id and status in ('novo', 'producao');
  if not found then return false; end if;  -- já concluído: não baixa o estoque de novo
  for v in select * from jsonb_array_elements(coalesce(p_consumo, '[]'::jsonb)) loop
    update filamentos set estoque_g = greatest(0, estoque_g - (v->>'gramas')::numeric) where id = (v->>'fil_id')::uuid;
  end loop;
  return true;
end $$;

-- função antiga (um filamento só), mantida para telas ainda abertas; agora também não baixa duas vezes
create or replace function concluir_pedido(p_id uuid, p_fil uuid, p_gramas numeric)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_equipe() then raise exception 'Sem permissão'; end if;
  update pedidos set status = 'pronto', pronto_em = now() where id = p_id and status in ('novo', 'producao');
  if not found then return; end if;
  if p_fil is not null and coalesce(p_gramas, 0) > 0 then
    update filamentos set estoque_g = greatest(0, estoque_g - p_gramas) where id = p_fil;
  end if;
end $$;

-- avisa a API do Supabase sobre as colunas e a função novas
notify pgrst, 'reload schema';
