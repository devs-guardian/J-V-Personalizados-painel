-- Guarda quando a produção de cada pedido começou, para calcular o prazo ("Atrasado").
-- Rode no SQL Editor do Supabase. Pode ser rodado mais de uma vez.

alter table pedidos add column if not exists iniciado_em timestamptz;

-- O horário vem sempre do banco: o aplicativo não consegue informar nem alterar.
create or replace function marca_inicio_producao() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    new.iniciado_em := case when new.status = 'producao' then now() end;
  elsif new.status = 'producao' and old.status <> 'producao' then
    new.iniciado_em := now();            -- começou (ou recomeçou) a produzir
  elsif new.status = 'novo' then
    new.iniciado_em := null;             -- voltou para a fila: zera a contagem
  else
    new.iniciado_em := old.iniciado_em;
  end if;
  return new;
end $$;

drop trigger if exists marca_inicio_producao on pedidos;
create trigger marca_inicio_producao before insert or update on pedidos
for each row execute function marca_inicio_producao();

-- Pedidos que já estavam em produção ficam sem horário de início e não são marcados como atrasados.
-- Para começar a contar o prazo deles a partir de agora, descomente e rode:
-- alter table pedidos disable trigger marca_inicio_producao;
-- update pedidos set iniciado_em = now() where status = 'producao' and iniciado_em is null;
-- alter table pedidos enable trigger marca_inicio_producao;
