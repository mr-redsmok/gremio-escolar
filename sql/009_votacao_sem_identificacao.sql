-- ============================================================================
-- URNA ESCOLAR — 009 — Votação sem identificação do eleitor
-- Rode no SQL Editor depois de 008. É seguro rodar mais de uma vez.
--
-- O eleitor não informa mais nome nem turma. Qualquer pessoa pode iniciar
-- uma votação, e cada sessão continua valendo para um único voto. Não há
-- controle de quantas vezes a mesma pessoa vota.
-- ============================================================================

drop index if exists public.urna_sessao_ativa_unica_idx;

alter table public.urna_presencas
  drop constraint if exists urna_presencas_eleicao_id_nome_normalizado_turma_normalizad_key;

create or replace function public.urna_liberar_eleitor(
  p_eleicao_id uuid,
  p_nome text default '',
  p_turma text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_eleicao public.urna_eleicoes%rowtype;
  v_token text;
  v_token_hash text;
  v_expira timestamptz;
begin
  select *
    into v_eleicao
    from public.urna_eleicoes
   where id = p_eleicao_id
     and status = 'aberta';

  if not found then
    raise exception 'A votação não está aberta.';
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
    '',
    '',
    '',
    '',
    v_token_hash,
    v_expira
  );

  return jsonb_build_object(
    'token', v_token,
    'nome', '',
    'turma', '',
    'expira_em', v_expira
  );
end;
$$;

revoke all on function public.urna_liberar_eleitor(uuid, text, text) from public;
grant execute on function public.urna_liberar_eleitor(uuid, text, text) to anon, authenticated;

create or replace function public.urna_registrar_voto(
  p_token text,
  p_votos jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_sessao public.urna_sessoes%rowtype;
  v_eleicao public.urna_eleicoes%rowtype;
  v_cargo public.urna_cargos%rowtype;
  v_candidato public.urna_candidatos%rowtype;
  v_item jsonb;
  v_cargo_id uuid;
  v_candidato_id uuid;
  v_tipo text;
  v_cargo_count integer;
  v_distintos integer;
  v_protocolo text;
begin
  select *
    into v_sessao
    from public.urna_sessoes
   where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
   for update;

  if not found then
    raise exception 'Sessão de votação inválida.';
  end if;

  if v_sessao.status = 'usada' then
    return jsonb_build_object('ok', true, 'ja_registrado', true);
  end if;

  if v_sessao.status <> 'ativa' then
    raise exception 'Sessão de votação expirada ou cancelada.';
  end if;

  if v_sessao.expira_em <= now() then
    update public.urna_sessoes
       set status = 'expirada'
     where id = v_sessao.id;
    raise exception 'Sessão de votação expirada. Reinicie a votação.';
  end if;

  select *
    into v_eleicao
    from public.urna_eleicoes
   where id = v_sessao.eleicao_id
   for share;

  if not found or v_eleicao.status <> 'aberta' then
    raise exception 'A votação não está aberta.';
  end if;

  if p_votos is null or jsonb_typeof(p_votos) <> 'array' then
    raise exception 'Lista de votos inválida.';
  end if;

  select count(*)::integer
    into v_cargo_count
    from public.urna_cargos
   where eleicao_id = v_sessao.eleicao_id
     and ativo = true;

  if v_cargo_count < 1 then
    raise exception 'A eleição não possui cargos ativos.';
  end if;

  if jsonb_array_length(p_votos) <> v_cargo_count then
    raise exception 'Quantidade de votos diferente da quantidade de cargos.';
  end if;

  select count(distinct (item ->> 'cargo_id')::uuid)::integer
    into v_distintos
    from jsonb_array_elements(p_votos) item;

  if v_distintos <> v_cargo_count then
    raise exception 'Há cargos repetidos ou ausentes na lista de votos.';
  end if;

  for v_item in select * from jsonb_array_elements(p_votos)
  loop
    begin
      v_cargo_id := (v_item ->> 'cargo_id')::uuid;
    exception
      when others then
        raise exception 'Cargo inválido na lista de votos.';
    end;

    select *
      into v_cargo
      from public.urna_cargos
     where id = v_cargo_id
       and eleicao_id = v_sessao.eleicao_id
       and ativo = true;

    if not found then
      raise exception 'Cargo inválido ou inativo.';
    end if;

    v_tipo := v_item ->> 'tipo';
    v_candidato_id := null;

    if v_tipo = 'candidato' then
      begin
        v_candidato_id := nullif(v_item ->> 'candidato_id', '')::uuid;
      exception
        when others then
          raise exception 'Candidato inválido na lista de votos.';
      end;

      if v_candidato_id is null then
        raise exception 'Candidato não informado.';
      end if;

      select *
        into v_candidato
        from public.urna_candidatos
       where id = v_candidato_id
         and cargo_id = v_cargo.id
         and eleicao_id = v_sessao.eleicao_id
         and ativo = true;

      if not found then
        raise exception 'Candidato inválido ou inativo.';
      end if;
    elsif v_tipo = 'branco' then
      if not v_cargo.permite_branco then
        raise exception 'Este cargo não permite voto em branco.';
      end if;
      v_candidato_id := null;
    elsif v_tipo = 'nulo' then
      v_candidato_id := null;
    else
      raise exception 'Tipo de voto inválido.';
    end if;

    insert into public.urna_votos (eleicao_id, cargo_id, candidato_id, tipo)
    values (v_sessao.eleicao_id, v_cargo.id, v_candidato_id, v_tipo);
  end loop;

  update public.urna_sessoes
     set status = 'usada',
         usada_em = now()
   where id = v_sessao.id;

  insert into public.urna_presencas (
    eleicao_id,
    nome_eleitor,
    nome_normalizado,
    turma,
    turma_normalizada,
    sessao_id
  )
  values (
    v_sessao.eleicao_id,
    '',
    '',
    '',
    '',
    v_sessao.id
  );

  v_protocolo := upper(
    substr(
      encode(
        extensions.digest(
          v_sessao.id::text || clock_timestamp()::text,
          'sha256'
        ),
        'hex'
      ),
      1,
      12
    )
  );

  insert into public.urna_auditoria (eleicao_id, actor_id, acao, detalhes)
  values (
    v_sessao.eleicao_id,
    auth.uid(),
    'voto_registrado',
    jsonb_build_object('protocolo', v_protocolo)
  );

  return jsonb_build_object('ok', true, 'protocolo', v_protocolo);
exception
  when unique_violation then
    raise exception 'Não foi possível registrar o voto. Tente novamente.';
end;
$$;

revoke all on function public.urna_registrar_voto(text, jsonb) from public;
grant execute on function public.urna_registrar_voto(text, jsonb) to anon, authenticated;
