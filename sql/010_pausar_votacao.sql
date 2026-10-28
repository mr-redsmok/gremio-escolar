-- ============================================================================
-- URNA ESCOLAR — 010 — Pausar e retomar a votação
-- Rode no SQL Editor depois de 009. É seguro rodar mais de uma vez.
--
-- A pausa mantém a eleição com status 'aberta' (continua impedindo outra
-- eleição aberta) e marca pausada = true:
--  - nenhuma votação nova pode ser iniciada enquanto estiver pausada;
--  - quem já iniciou a votação pode concluí-la, mesmo se o prazo passar;
--  - ao retomar, o tempo da pausa é devolvido às sessões em andamento.
-- Os votos já registrados não são alterados.
-- ============================================================================

alter table public.urna_eleicoes
  add column if not exists pausada boolean not null default false,
  add column if not exists pausa_em timestamptz,
  add column if not exists motivo_pausa text;

create or replace function public.urna_estado_publico()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_eleicao public.urna_eleicoes%rowtype;
  v_cargos jsonb := '[]'::jsonb;
begin
  select *
    into v_eleicao
    from public.urna_eleicoes
   where status <> 'arquivada'
   order by criado_em desc
   limit 1;

  if not found then
    return jsonb_build_object('eleicao', null, 'cargos', '[]'::jsonb);
  end if;

  if v_eleicao.status = 'aberta' then
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', c.id,
          'nome', c.nome,
          'descricao', c.descricao,
          'ordem', c.ordem,
          'digitos', c.digitos,
          'permite_branco', c.permite_branco,
          'candidatos', coalesce(
            (
              select jsonb_agg(
                jsonb_build_object(
                  'id', cand.id,
                  'numero', cand.numero,
                  'nome', cand.nome,
                  'nome_urna', cand.nome_urna,
                  'chapa', cand.chapa,
                  'vice', cand.vice,
                  'proposta', cand.proposta
                )
                order by cand.numero
              )
                from public.urna_candidatos cand
               where cand.cargo_id = c.id
                 and cand.ativo = true
            ),
            '[]'::jsonb
          )
        )
        order by c.ordem, c.nome
      ),
      '[]'::jsonb
    )
      into v_cargos
      from public.urna_cargos c
     where c.eleicao_id = v_eleicao.id
       and c.ativo = true;
  end if;

  return jsonb_build_object(
    'eleicao', jsonb_build_object(
      'id', v_eleicao.id,
      'escola_nome', v_eleicao.escola_nome,
      'nome', v_eleicao.nome,
      'descricao', v_eleicao.descricao,
      'data_eleicao', v_eleicao.data_eleicao,
      'status', v_eleicao.status,
      'pausada', v_eleicao.pausada,
      'digitos_padrao', v_eleicao.digitos_padrao,
      'som_ativo', v_eleicao.som_ativo,
      'tempo_inatividade_segundos', v_eleicao.tempo_inatividade_segundos
    ),
    'cargos', v_cargos
  );
end;
$$;

revoke all on function public.urna_estado_publico() from public;
grant execute on function public.urna_estado_publico() to anon, authenticated;

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

  if v_eleicao.pausada then
    raise exception 'A votação está pausada. Aguarde a retomada pelo responsável.';
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

  select *
    into v_eleicao
    from public.urna_eleicoes
   where id = v_sessao.eleicao_id
   for share;

  if not found or v_eleicao.status <> 'aberta' then
    raise exception 'A votação não está aberta.';
  end if;

  -- Durante a pausa, a sessão já iniciada não expira: o prazo volta a valer
  -- quando a votação for retomada, com o tempo da pausa devolvido.
  if v_sessao.expira_em <= now() and not v_eleicao.pausada then
    update public.urna_sessoes
       set status = 'expirada'
     where id = v_sessao.id;
    raise exception 'Sessão de votação expirada. Reinicie a votação.';
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

create or replace function public.urna_pausar_eleicao(
  p_eleicao_id uuid,
  p_motivo text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_eleicao public.urna_eleicoes%rowtype;
begin
  if not public.urna_is_admin() then
    raise exception 'Acesso negado.';
  end if;

  select *
    into v_eleicao
    from public.urna_eleicoes
   where id = p_eleicao_id
   for update;

  if not found then
    raise exception 'Eleição não encontrada.';
  end if;

  if v_eleicao.status <> 'aberta' then
    raise exception 'Somente eleições abertas podem ser pausadas.';
  end if;

  if v_eleicao.pausada then
    raise exception 'A votação já está pausada.';
  end if;

  update public.urna_eleicoes
     set pausada = true,
         pausa_em = now(),
         motivo_pausa = nullif(btrim(coalesce(p_motivo, '')), '')
   where id = p_eleicao_id;

  insert into public.urna_auditoria (eleicao_id, actor_id, acao, detalhes)
  values (
    p_eleicao_id,
    auth.uid(),
    'eleicao_pausada',
    jsonb_build_object('motivo', nullif(btrim(coalesce(p_motivo, '')), ''))
  );

  return jsonb_build_object('ok', true, 'pausa_em', now());
end;
$$;

revoke all on function public.urna_pausar_eleicao(uuid, text) from public;
grant execute on function public.urna_pausar_eleicao(uuid, text) to authenticated;

create or replace function public.urna_retomar_eleicao(p_eleicao_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_eleicao public.urna_eleicoes%rowtype;
  v_pausa interval;
begin
  if not public.urna_is_admin() then
    raise exception 'Acesso negado.';
  end if;

  select *
    into v_eleicao
    from public.urna_eleicoes
   where id = p_eleicao_id
   for update;

  if not found then
    raise exception 'Eleição não encontrada.';
  end if;

  if not v_eleicao.pausada then
    raise exception 'A votação não está pausada.';
  end if;

  v_pausa := now() - v_eleicao.pausa_em;

  update public.urna_sessoes
     set expira_em = expira_em + v_pausa
   where eleicao_id = p_eleicao_id
     and status = 'ativa';

  update public.urna_eleicoes
     set pausada = false,
         pausa_em = null,
         motivo_pausa = null
   where id = p_eleicao_id;

  insert into public.urna_auditoria (eleicao_id, actor_id, acao, detalhes)
  values (
    p_eleicao_id,
    auth.uid(),
    'eleicao_retomada',
    jsonb_build_object('pausa_segundos', round(extract(epoch from v_pausa)))
  );

  return jsonb_build_object('ok', true, 'eleicao_id', p_eleicao_id);
end;
$$;

revoke all on function public.urna_retomar_eleicao(uuid) from public;
grant execute on function public.urna_retomar_eleicao(uuid) to authenticated;

create or replace function public.urna_encerrar_eleicao(p_eleicao_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_eleicao public.urna_eleicoes%rowtype;
  v_encerramento timestamptz;
begin
  if not public.urna_is_admin() then
    raise exception 'Acesso negado.';
  end if;

  select *
    into v_eleicao
    from public.urna_eleicoes
   where id = p_eleicao_id
   for update;

  if not found then
    raise exception 'Eleição não encontrada.';
  end if;

  if v_eleicao.status <> 'aberta' then
    raise exception 'Somente eleições abertas podem ser encerradas.';
  end if;

  v_encerramento := now();

  update public.urna_eleicoes
     set status = 'encerrada',
         encerramento_em = v_encerramento,
         pausada = false,
         pausa_em = null,
         motivo_pausa = null
   where id = p_eleicao_id;

  insert into public.urna_auditoria (eleicao_id, actor_id, acao, detalhes)
  values (
    p_eleicao_id,
    auth.uid(),
    'eleicao_encerrada',
    jsonb_build_object('encerramento_em', v_encerramento)
  );

  return jsonb_build_object(
    'ok', true,
    'eleicao_id', p_eleicao_id,
    'encerramento_em', v_encerramento
  );
end;
$$;

revoke all on function public.urna_encerrar_eleicao(uuid) from public;
grant execute on function public.urna_encerrar_eleicao(uuid) to authenticated;
