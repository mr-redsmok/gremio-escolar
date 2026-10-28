-- ============================================================================
-- URNA ESCOLAR — 007 — Identificação só pelo primeiro nome
-- Rode no SQL Editor depois de 006. É seguro rodar mais de uma vez.
--
-- O eleitor informa apenas o primeiro nome. A turma deixa de ser obrigatória
-- e é gravada vazia. A regra de bloqueio passa a ser somente pelo nome
-- normalizado: dois eleitores com o mesmo primeiro nome na mesma eleição
-- não conseguem votar os dois.
-- ============================================================================

create or replace function public.urna_liberar_eleitor(
  p_eleicao_id uuid,
  p_nome text,
  p_turma text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_eleicao public.urna_eleicoes%rowtype;
  v_nome text;
  v_turma text;
  v_nome_norm text;
  v_turma_norm text;
  v_token text;
  v_token_hash text;
  v_expira timestamptz;
  v_minutos integer;
begin
  v_nome := btrim(regexp_replace(coalesce(p_nome, ''), '\s+', ' ', 'g'));
  v_turma := btrim(regexp_replace(coalesce(p_turma, ''), '\s+', ' ', 'g'));
  v_nome_norm := public.urna_normalizar_nome(v_nome);
  v_turma_norm := public.urna_normalizar_turma(v_turma);

  if length(v_nome_norm) < 2 then
    raise exception 'Digite seu primeiro nome.';
  end if;

  select *
    into v_eleicao
    from public.urna_eleicoes
   where id = p_eleicao_id
     and status = 'aberta';

  if not found then
    raise exception 'A votação não está aberta.';
  end if;

  -- Serializa tentativas simultâneas para o mesmo nome.
  perform pg_advisory_xact_lock(
    hashtextextended(
      p_eleicao_id::text || '|' || v_nome_norm || '|' || v_turma_norm,
      0
    )
  );

  if exists (
    select 1
      from public.urna_presencas
     where eleicao_id = p_eleicao_id
       and nome_normalizado = v_nome_norm
       and turma_normalizada = v_turma_norm
  ) then
    raise exception 'Este nome já votou nesta eleição.';
  end if;

  -- Expira sessões antigas do mesmo nome.
  update public.urna_sessoes
     set status = 'expirada'
   where eleicao_id = p_eleicao_id
     and nome_normalizado = v_nome_norm
     and turma_normalizada = v_turma_norm
     and status = 'ativa'
     and expira_em <= now();

  if exists (
    select 1
      from public.urna_sessoes
     where eleicao_id = p_eleicao_id
       and nome_normalizado = v_nome_norm
       and turma_normalizada = v_turma_norm
       and status = 'ativa'
       and expira_em > now()
  ) then
    select greatest(
      1,
      ceil(extract(epoch from (expira_em - now())) / 60.0)::integer
    )
      into v_minutos
      from public.urna_sessoes
     where eleicao_id = p_eleicao_id
       and nome_normalizado = v_nome_norm
       and turma_normalizada = v_turma_norm
       and status = 'ativa'
       and expira_em > now()
     order by expira_em desc
     limit 1;

    raise exception
      'Já existe uma votação em andamento para este nome. Aguarde % minuto(s) ou procure o responsável.',
      v_minutos;
  end if;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  v_token_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');
  v_expira := now() + make_interval(secs => v_eleicao.tempo_inatividade_segundos + 60);

  insert into public.urna_sessoes (
    eleicao_id,
    nome_eleitor,
    nome_normalizado,
    turma,
    turma_normalizada,
    token_hash,
    expira_em
  )
  values (
    p_eleicao_id,
    v_nome,
    v_nome_norm,
    v_turma,
    v_turma_norm,
    v_token_hash,
    v_expira
  );

  return jsonb_build_object(
    'token', v_token,
    'nome', v_nome,
    'turma', v_turma,
    'expira_em', v_expira
  );
end;
$$;

revoke all on function public.urna_liberar_eleitor(uuid, text, text) from public;
grant execute on function public.urna_liberar_eleitor(uuid, text, text) to anon, authenticated;
