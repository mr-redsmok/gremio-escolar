-- ============================================================================
-- URNA ESCOLAR — 003 — Row Level Security
-- Rode depois do 002_functions.sql.
--
-- A urna pública NÃO lê tabelas diretamente: usa apenas as funções RPC
-- urna_estado_publico, urna_liberar_eleitor, urna_registrar_voto e
-- urna_cancelar_sessao.
-- ============================================================================

alter table public.urna_admins enable row level security;
alter table public.urna_eleicoes enable row level security;
alter table public.urna_cargos enable row level security;
alter table public.urna_candidatos enable row level security;
alter table public.urna_sessoes enable row level security;
alter table public.urna_presencas enable row level security;
alter table public.urna_votos enable row level security;
alter table public.urna_relatorios enable row level security;
alter table public.urna_auditoria enable row level security;

-- ---------------------------------------------------------------------------
-- Administradores
-- ---------------------------------------------------------------------------
drop policy if exists "urna_admins_select_self" on public.urna_admins;
create policy "urna_admins_select_self"
  on public.urna_admins
  for select
  to authenticated
  using (user_id = auth.uid() or public.urna_is_admin());

-- ---------------------------------------------------------------------------
-- Eleições
-- ---------------------------------------------------------------------------
drop policy if exists "urna_eleicoes_select_admin" on public.urna_eleicoes;
create policy "urna_eleicoes_select_admin"
  on public.urna_eleicoes
  for select
  to authenticated
  using (public.urna_is_admin());

drop policy if exists "urna_eleicoes_update_admin" on public.urna_eleicoes;
create policy "urna_eleicoes_update_admin"
  on public.urna_eleicoes
  for update
  to authenticated
  using (public.urna_is_admin())
  with check (public.urna_is_admin());

-- ---------------------------------------------------------------------------
-- Cargos
-- ---------------------------------------------------------------------------
drop policy if exists "urna_cargos_admin" on public.urna_cargos;
create policy "urna_cargos_admin"
  on public.urna_cargos
  for all
  to authenticated
  using (public.urna_is_admin())
  with check (public.urna_is_admin());

-- ---------------------------------------------------------------------------
-- Candidatos
-- ---------------------------------------------------------------------------
drop policy if exists "urna_candidatos_admin" on public.urna_candidatos;
create policy "urna_candidatos_admin"
  on public.urna_candidatos
  for all
  to authenticated
  using (public.urna_is_admin())
  with check (public.urna_is_admin());

-- ---------------------------------------------------------------------------
-- Sessões — apenas leitura administrativa; escrita somente por RPC.
-- ---------------------------------------------------------------------------
drop policy if exists "urna_sessoes_select_admin" on public.urna_sessoes;
create policy "urna_sessoes_select_admin"
  on public.urna_sessoes
  for select
  to authenticated
  using (public.urna_is_admin());

-- ---------------------------------------------------------------------------
-- Presenças — apenas leitura administrativa; escrita somente por RPC.
-- ---------------------------------------------------------------------------
drop policy if exists "urna_presencas_select_admin" on public.urna_presencas;
create policy "urna_presencas_select_admin"
  on public.urna_presencas
  for select
  to authenticated
  using (public.urna_is_admin());

-- ---------------------------------------------------------------------------
-- Votos — nenhuma policy.
-- Nem admin lê voto individual pelo app. A apuração é feita por RPC.
-- O service_role (usado apenas fora do frontend) ignora RLS.
-- ---------------------------------------------------------------------------
-- (intencionalmente sem policies)

-- ---------------------------------------------------------------------------
-- Relatórios — admin lê o histórico; escrita somente por RPC.
-- ---------------------------------------------------------------------------
drop policy if exists "urna_relatorios_select_admin" on public.urna_relatorios;
create policy "urna_relatorios_select_admin"
  on public.urna_relatorios
  for select
  to authenticated
  using (public.urna_is_admin());

-- ---------------------------------------------------------------------------
-- Auditoria — admin lê; escrita somente por RPC.
-- ---------------------------------------------------------------------------
drop policy if exists "urna_auditoria_select_admin" on public.urna_auditoria;
create policy "urna_auditoria_select_admin"
  on public.urna_auditoria
  for select
  to authenticated
  using (public.urna_is_admin());
