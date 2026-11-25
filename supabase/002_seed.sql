-- =====================================================================
-- J&V Personalizados — dados iniciais (vindos da planilha de precificação)
-- Rode DEPOIS do 001_schema.sql.
-- =====================================================================
insert into config (id, filamento_kg, maquina_h, hora_sua) values (1, 74, 2, 20);
insert into capacidade (id, impressoras, horas_dia) values (1, 1, 20);

insert into plataformas (id, nome, ordem, lim, c_low, f_low, c_high, f_high, outras, imposto, pag, anuncio, frete, margem) values
('shopee',  'Shopee',             1, 80, 0.20, 4.5, 0.14, 16, 0, 0.06, 0,    0, 0, 0.25),
('ml',      'Mercado Livre',      2, 79, 0.12, 6.5, 0.12,  0, 0, 0.06, 0,    0, 0, 0.25),
('tiktok',  'TikTok Shop',        3, 50, 0.10, 4,   0.06,  6, 0, 0.06, 0,    0, 0, 0.25),
('whats',   'Instagram/WhatsApp', 4,  0, 0,    0,   0,     0, 0, 0.06, 0.03, 3, 0, 0.30);

insert into produtos (nome, gramas, tempo_min) values
('Kit árvores em espiral — Kit com 3 (pequena, média e grande)', 164, 540),
('Renas decorativas — Rena pequena (unidade)', 21, 90),
('Renas decorativas — Rena média (unidade)', 36, 140),
('Quebra-nozes — Estilo minimalista', 63, 180),
('Letreiro Feliz Natal — Com floco de neve', 90, 180),
('Kit bandeja + Feliz Natal — Letreiro + bandeja', 159, 310),
('Kit presépio — Sagrada Família, árvore e bandeja', 55, 260),
('Casinhas iluminadas — Kit com 3 e velinhas de LED', 492, 900),
('Casinhas iluminadas — Casinha avulsa', 164, 300),
('Lembrança com foto — Pequena', 8, 34),
('Lembrança com foto — Média', 28, 110),
('Lembrança com foto — Grande', 71, 210),
('Bandejas decorativas — Unidade', 69, 130),
('Porta-guardanapo de pano — Kit com 5', 46, 150),
('Porta-guardanapo Noel — Kit com 4', 112, 290),
('Porta-guardanapo árvore — Árvore dourada', 20, 51),
('Tigelinhas árvore — Kit com 6', 280, 500),
('Porta-panetone — Roupa do Papai Noel', 60, 140),
('Calça do elfo — Porta-doces', 246, 690),
('Bola de Natal — Opção 1 (porta-doces)', 431, 1560),
('Bola de Natal — Opção 2 (porta-doces)', 137, 270),
('Chapéu de Natal — Porta-doces com tampa', 180, 360),
('Tigela rena — Tamanho G', 178, 280),
('Tigela boneco de neve — Porta-doces', 256, 630),
('Caixa pinheiro — Padrão (chocolates não inclusos)', 63, 100),
('Caixa pinheiro — Grande (chocolates não inclusos)', 100, 120),
('Enfeite de Natal — Gatinho com nome personalizado', 23, 43),
('Enfeite de Natal — Cachorro (patinha) com nome personalizado', 23, 43);

-- ---------- usuários ----------
-- Troque TROQUE-ESTA-SENHA antes de rodar e não salve a senha real neste arquivo.
-- Este bloco pode ser rodado sozinho e repetido: quem já existe mantém a senha,
-- só o papel é reaplicado.
do $$
declare
  v_senha text := 'TROQUE-ESTA-SENHA';  -- senha inicial dos dois usuários
  u record;
  v_id uuid;
begin
  for u in
    select * from (values
      ('joaovitor@jevpersonalizados.com', 'João Vitor', 'operacional'::app_role),
      ('victor@jevpersonalizados.com',    'Victor',     'gestao'::app_role)
    ) as t(email, nome, papel)
  loop
    select id into v_id from auth.users where email = u.email;

    if v_id is null then
      if v_senha = 'TROQUE-ESTA-SENHA' or length(v_senha) < 8 then
        raise exception 'Defina em v_senha uma senha com pelo menos 8 caracteres';
      end if;
      v_id := gen_random_uuid();

      -- os tokens precisam ser '' (com null o login do Supabase falha)
      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change, email_change_token_new
      ) values (
        '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', u.email,
        extensions.crypt(v_senha, extensions.gen_salt('bf')), now(),
        '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('nome', u.nome), now(), now(),
        '', '', '', ''
      );

      insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
      values (v_id::text, v_id,
              jsonb_build_object('sub', v_id::text, 'email', u.email, 'email_verified', true),
              'email', now(), now(), now());
    end if;

    -- o trigger on_auth_user_created já cria o perfil; aqui garantimos o papel
    insert into profiles (id, email, nome, role) values (v_id, u.email, u.nome, u.papel)
    on conflict (id) do update set role = excluded.role;
  end loop;
end $$;
