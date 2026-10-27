-- ============================================================================
-- URNA ESCOLAR — 001 — Estrutura
-- Rode este arquivo no SQL Editor do Supabase, na ordem 001 → 004.
-- ============================================================================

create extension if not exists pgcrypto with schema extensions;
create extension if not exists unaccent with schema extensions;

-- ---------------------------------------------------------------------------
-- Administradores
-- ---------------------------------------------------------------------------
create table if not exists public.urna_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  nome text not null default 'Administrador',
  papel text not null default 'admin' check (papel in ('admin', 'mesario')),
  criado_em timestamptz not null default now()
);

comment on table public.urna_admins is
  'Usuários do Supabase Auth autorizados a administrar a urna.';

-- ---------------------------------------------------------------------------
-- Eleições
-- ---------------------------------------------------------------------------
create table if not exists public.urna_eleicoes (
  id uuid primary key default gen_random_uuid(),
  escola_nome text not null default '',
  nome text not null default '',
  descricao text,
  data_eleicao date,
  status text not null default 'rascunho'
    check (status in ('rascunho', 'aberta', 'encerrada', 'arquivada')),
  total_eleitores_aptos integer
    check (total_eleitores_aptos is null or total_eleitores_aptos >= 0),
  digitos_padrao integer not null default 2
    check (digitos_padrao between 2 and 4),
  som_ativo boolean not null default true,
  tempo_inatividade_segundos integer not null default 120
    check (tempo_inatividade_segundos between 30 and 600),
  presidente_comissao text,
  secretario_comissao text,
  abertura_em timestamptz,
  encerramento_em timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

comment on table public.urna_eleicoes is
  'Configuração da eleição. Apenas uma pode estar com status = aberta.';

-- Só pode existir uma eleição aberta por vez.
create unique index if not exists urna_uma_aberta_idx
  on public.urna_eleicoes ((status))
  where status = 'aberta';

-- ---------------------------------------------------------------------------
-- Cargos
-- ---------------------------------------------------------------------------
create table if not exists public.urna_cargos (
  id uuid primary key default gen_random_uuid(),
  eleicao_id uuid not null references public.urna_eleicoes (id) on delete cascade,
  nome text not null,
  descricao text,
  ordem integer not null default 0,
  digitos integer not null default 2 check (digitos between 2 and 4),
  permite_branco boolean not null default true,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (eleicao_id, nome),
  unique (id, eleicao_id)
);

comment on table public.urna_cargos is
  'Cargos votados na eleição, na ordem em que aparecem na urna.';

-- ---------------------------------------------------------------------------
-- Candidatos
-- ---------------------------------------------------------------------------
create table if not exists public.urna_candidatos (
  id uuid primary key default gen_random_uuid(),
  eleicao_id uuid not null references public.urna_eleicoes (id) on delete cascade,
  cargo_id uuid not null,
  numero text not null check (numero ~ '^[0-9]{2,4}$'),
  nome text not null,
  nome_urna text,
  chapa text,
  vice text,
  proposta text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (cargo_id, numero),
  foreign key (cargo_id, eleicao_id)
    references public.urna_cargos (id, eleicao_id) on delete cascade
);

comment on table public.urna_candidatos is
  'Candidatos vinculados a um cargo. O número é único dentro do cargo.';

-- ---------------------------------------------------------------------------
-- Sessões temporárias de votação
-- ---------------------------------------------------------------------------
create table if not exists public.urna_sessoes (
  id uuid primary key default gen_random_uuid(),
  eleicao_id uuid not null references public.urna_eleicoes (id) on delete cascade,
  nome_eleitor text not null,
  nome_normalizado text not null,
  turma text not null,
  turma_normalizada text not null,
  token_hash text not null unique,
  status text not null default 'ativa'
    check (status in ('ativa', 'usada', 'expirada', 'cancelada')),
  expira_em timestamptz not null,
  usada_em timestamptz,
  criada_em timestamptz not null default now()
);

comment on table public.urna_sessoes is
  'Sessão de uso único criada ao identificar o eleitor. O token em claro nunca é gravado.';

-- Impede duas sessões ativas para o mesmo nome + turma.
create unique index if not exists urna_sessao_ativa_unica_idx
  on public.urna_sessoes (eleicao_id, nome_normalizado, turma_normalizada)
  where status = 'ativa';

create index if not exists urna_sessoes_token_idx
  on public.urna_sessoes (token_hash);

create index if not exists urna_sessoes_eleicao_idx
  on public.urna_sessoes (eleicao_id, criada_em desc);

-- ---------------------------------------------------------------------------
-- Presenças (quem já votou)
-- ---------------------------------------------------------------------------
create table if not exists public.urna_presencas (
  id uuid primary key default gen_random_uuid(),
  eleicao_id uuid not null references public.urna_eleicoes (id) on delete cascade,
  nome_eleitor text not null,
  nome_normalizado text not null,
  turma text not null,
  turma_normalizada text not null,
  sessao_id uuid references public.urna_sessoes (id) on delete set null,
  votou_em timestamptz not null default now(),
  unique (eleicao_id, nome_normalizado, turma_normalizada)
);

comment on table public.urna_presencas is
  'Registro de comparecimento. Não possui vínculo com os votos.';

create index if not exists urna_presencas_eleicao_idx
  on public.urna_presencas (eleicao_id, votou_em desc);

-- ---------------------------------------------------------------------------
-- Votos (anônimos)
-- ---------------------------------------------------------------------------
create table if not exists public.urna_votos (
  id uuid primary key default gen_random_uuid(),
  eleicao_id uuid not null references public.urna_eleicoes (id) on delete cascade,
  cargo_id uuid not null references public.urna_cargos (id) on delete restrict,
  candidato_id uuid references public.urna_candidatos (id) on delete restrict,
  tipo text not null check (tipo in ('candidato', 'branco', 'nulo')),
  check (
    (tipo = 'candidato' and candidato_id is not null)
    or (tipo in ('branco', 'nulo') and candidato_id is null)
  )
);

comment on table public.urna_votos is
  'Votos anônimos: sem eleitor, sem sessão e sem horário individual.';

create index if not exists urna_votos_apuracao_idx
  on public.urna_votos (eleicao_id, cargo_id, candidato_id);

-- ---------------------------------------------------------------------------
-- Relatórios gerados
-- ---------------------------------------------------------------------------
create table if not exists public.urna_relatorios (
  id uuid primary key default gen_random_uuid(),
  eleicao_id uuid not null references public.urna_eleicoes (id) on delete cascade,
  cargo_id uuid references public.urna_cargos (id) on delete set null,
  tipo text not null
    check (tipo in ('zeresima', 'boletim_cargo', 'ata_encerramento')),
  parcial boolean not null default false,
  storage_path text,
  hash_dados text,
  hash_arquivo text,
  gerado_por uuid references auth.users (id) on delete set null,
  criado_em timestamptz not null default now()
);

create index if not exists urna_relatorios_eleicao_idx
  on public.urna_relatorios (eleicao_id, criado_em desc);

-- ---------------------------------------------------------------------------
-- Auditoria
-- ---------------------------------------------------------------------------
create table if not exists public.urna_auditoria (
  id bigserial primary key,
  eleicao_id uuid references public.urna_eleicoes (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  acao text not null,
  detalhes jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now()
);

create index if not exists urna_auditoria_eleicao_idx
  on public.urna_auditoria (eleicao_id, criado_em desc);

-- ---------------------------------------------------------------------------
-- Funções utilitárias
-- ---------------------------------------------------------------------------
create or replace function public.urna_normalizar_nome(p_nome text)
returns text
language sql
stable
set search_path = public, extensions
as $$
  select btrim(
    regexp_replace(
      regexp_replace(
        lower(extensions.unaccent(btrim(coalesce(p_nome, '')))),
        '[^a-z0-9 ]', '', 'g'
      ),
      '\s+', ' ', 'g'
    )
  );
$$;

create or replace function public.urna_normalizar_turma(p_turma text)
returns text
language sql
stable
set search_path = public, extensions
as $$
  select upper(
    regexp_replace(
      extensions.unaccent(btrim(coalesce(p_turma, ''))),
      '[^a-zA-Z0-9]', '', 'g'
    )
  );
$$;

create or replace function public.urna_set_atualizado_em()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

create or replace function public.urna_set_normalizados()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
begin
  new.nome_normalizado := public.urna_normalizar_nome(new.nome_eleitor);
  new.turma_normalizada := public.urna_normalizar_turma(new.turma);
  return new;
end;
$$;

create or replace function public.urna_bloquear_config_aberta()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_eleicao_id uuid;
begin
  -- Um registro nunca pode ser movido para outra eleição. Além de preservar
  -- a integridade, isso impede contornar o congelamento usando um rascunho.
  if tg_op = 'UPDATE' and new.eleicao_id is distinct from old.eleicao_id then
    raise exception 'O vínculo com a eleição não pode ser alterado.';
  end if;

  if tg_op = 'DELETE' then
    v_eleicao_id := old.eleicao_id;
  else
    v_eleicao_id := new.eleicao_id;
  end if;

  if exists (
    select 1
      from public.urna_eleicoes
     where id = v_eleicao_id
       and status in ('aberta', 'encerrada', 'arquivada')
  ) then
    raise exception
      'A configuração não pode ser alterada depois da abertura da eleição.';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

-- Triggers de atualização
drop trigger if exists trg_urna_eleicoes_atualizado on public.urna_eleicoes;
create trigger trg_urna_eleicoes_atualizado
  before update on public.urna_eleicoes
  for each row execute function public.urna_set_atualizado_em();

drop trigger if exists trg_urna_cargos_atualizado on public.urna_cargos;
create trigger trg_urna_cargos_atualizado
  before update on public.urna_cargos
  for each row execute function public.urna_set_atualizado_em();

drop trigger if exists trg_urna_candidatos_atualizado on public.urna_candidatos;
create trigger trg_urna_candidatos_atualizado
  before update on public.urna_candidatos
  for each row execute function public.urna_set_atualizado_em();

-- Normalização automática de nome/turma
drop trigger if exists trg_urna_sessoes_normaliza on public.urna_sessoes;
create trigger trg_urna_sessoes_normaliza
  before insert or update on public.urna_sessoes
  for each row execute function public.urna_set_normalizados();

drop trigger if exists trg_urna_presencas_normaliza on public.urna_presencas;
create trigger trg_urna_presencas_normaliza
  before insert or update on public.urna_presencas
  for each row execute function public.urna_set_normalizados();

-- Congelamento da configuração
drop trigger if exists trg_urna_cargos_congela on public.urna_cargos;
create trigger trg_urna_cargos_congela
  before insert or update or delete on public.urna_cargos
  for each row execute function public.urna_bloquear_config_aberta();

drop trigger if exists trg_urna_candidatos_congela on public.urna_candidatos;
create trigger trg_urna_candidatos_congela
  before insert or update or delete on public.urna_candidatos
  for each row execute function public.urna_bloquear_config_aberta();
