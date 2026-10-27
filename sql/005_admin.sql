-- ============================================================================
-- URNA ESCOLAR — 005 — Administrador inicial
--
-- 1. No painel do Supabase, abra Authentication > Users e crie um usuário
--    com e-mail e senha (ex.: admin@escola.com).
-- 2. Troque o e-mail abaixo e rode este SQL.
-- 3. Desabilite cadastros públicos em Authentication > Providers > Email
--    (desmarque "Enable sign ups"), se essa opção estiver disponível.
-- ============================================================================

insert into public.urna_admins (user_id, nome, papel)
select
  id,
  'Administrador',
  'admin'
from auth.users
where lower(email) = lower('admin@escola.com')
on conflict (user_id) do update
  set nome = excluded.nome,
      papel = 'admin';

-- Confira o resultado:
select
  a.user_id,
  u.email,
  a.nome,
  a.papel,
  a.criado_em
from public.urna_admins a
join auth.users u on u.id = a.user_id;
