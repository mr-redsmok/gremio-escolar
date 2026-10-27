-- ============================================================================
-- URNA ESCOLAR — 002 — Funções RPC
-- Rode depois do 001_schema.sql.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Autorização
-- ---------------------------------------------------------------------------
create or replace function public.urna_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.urna_admins
     where user_id = auth.uid()
       and papel = 'admin'
  );
$$;

revoke all on function public.urna_is_admin() from public;
grant execute on function public.urna_is_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- Estado público da urna
-- Retorna apenas dados seguros: escola, eleição, cargos e candidatos ativos.
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Configuração da eleição
-- A atualização direta da tabela é bloqueada por RLS. Esta RPC limita os
-- campos editáveis e garante que somente rascunhos possam ser alterados.
-- ---------------------------------------------------------------------------
create or replace function public.urna_salvar_eleicao(
  p_eleicao_id uuid,
  p_patch jsonb
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

  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    raise exception 'Configuração inválida.';
  end if;

  select *
    into v_eleicao
    from public.urna_eleicoes
   where id = p_eleicao_id
   for update;

  if not found then
    raise exception 'Eleição não encontrada.';
  end if;

  if v_eleicao.status <> 'rascunho' then
    raise exception
      'A configuração não pode ser alterada depois da abertura da eleição.';
  end if;

  update public.urna_eleicoes
     set escola_nome = case
           when p_patch ? 'escola_nome'
           then btrim(coalesce(p_patch ->> 'escola_nome', ''))
           else escola_nome
         end,
         nome = case
           when p_patch ? 'nome'
           then btrim(coalesce(p_patch ->> 'nome', ''))
           else nome
         end,
         descricao = case
           when p_patch ? 'descricao'
           then nullif(btrim(coalesce(p_patch ->> 'descricao', '')), '')
           else descricao
         end,
         data_eleicao = case
           when p_patch ? 'data_eleicao'
           then nullif(p_patch ->> 'data_eleicao', '')::date
           else data_eleicao
         end,
         total_eleitores_aptos = case
           when p_patch ? 'total_eleitores_aptos'
           then nullif(p_patch ->> 'total_eleitores_aptos', '')::integer
           else total_eleitores_aptos
         end,
         digitos_padrao = case
           when p_patch ? 'digitos_padrao'
           then (p_patch ->> 'digitos_padrao')::integer
           else digitos_padrao
         end,
         som_ativo = case
           when p_patch ? 'som_ativo'
           then (p_patch ->> 'som_ativo')::boolean
           else som_ativo
         end,
         tempo_inatividade_segundos = case
           when p_patch ? 'tempo_inatividade_segundos'
           then (p_patch ->> 'tempo_inatividade_segundos')::integer
           else tempo_inatividade_segundos
         end,
         presidente_comissao = case
           when p_patch ? 'presidente_comissao'
           then nullif(btrim(coalesce(p_patch ->> 'presidente_comissao', '')), '')
           else presidente_comissao
         end,
         secretario_comissao = case
           when p_patch ? 'secretario_comissao'
           then nullif(btrim(coalesce(p_patch ->> 'secretario_comissao', '')), '')
           else secretario_comissao
         end
   where id = p_eleicao_id
  returning * into v_eleicao;

  if btrim(coalesce(v_eleicao.escola_nome, '')) = ''
     or btrim(coalesce(v_eleicao.nome, '')) = '' then
    raise exception 'Informe o nome da escola e o nome da eleição.';
  end if;

  if v_eleicao.digitos_padrao not between 2 and 4 then
    raise exception 'A quantidade de dígitos deve ser entre 2 e 4.';
  end if;

  if v_eleicao.tempo_inatividade_segundos not between 30 and 600 then
    raise exception 'O tempo de inatividade deve ser entre 30 e 600 segundos.';
  end if;

  if v_eleicao.total_eleitores_aptos < 0 then
    raise exception 'O total de eleitores aptos não pode ser negativo.';
  end if;

  insert into public.urna_auditoria (eleicao_id, actor_id, acao, detalhes)
  values (
    p_eleicao_id,
    auth.uid(),
    'configuracao_atualizada',
    jsonb_build_object(
      'escola_nome', v_eleicao.escola_nome,
      'nome', v_eleicao.nome
    )
  );

  return to_jsonb(v_eleicao);
end;
$$;

revoke all on function public.urna_salvar_eleicao(uuid, jsonb) from public;
grant execute on function public.urna_salvar_eleicao(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Identificação do eleitor
-- Cria uma sessão de uso único. Não grava voto ainda.
-- ---------------------------------------------------------------------------
create or replace function public.urna_liberar_eleitor(
  p_eleicao_id uuid,
  p_nome text,
  p_turma text
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

  if length(v_nome_norm) < 3 then
    raise exception 'Digite seu nome completo.';
  end if;

  if length(v_turma_norm) < 1 then
    raise exception 'Digite sua turma.';
  end if;

  select *
    into v_eleicao
    from public.urna_eleicoes
   where id = p_eleicao_id
     and status = 'aberta';

  if not found then
    raise exception 'A votação não está aberta.';
  end if;

  -- Serializa tentativas simultâneas para o mesmo nome + turma.
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
    raise exception 'Este nome e turma já votaram nesta eleição.';
  end if;

  -- Expira sessões antigas do mesmo eleitor.
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
      'Já existe uma votação em andamento para este nome e turma. Aguarde % minuto(s) ou procure o responsável.',
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

-- ---------------------------------------------------------------------------
-- Registro atômico do voto
-- Valida todos os cargos, grava os votos e a presença na mesma transação.
-- ---------------------------------------------------------------------------
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

  if exists (
    select 1
      from public.urna_presencas
     where eleicao_id = v_sessao.eleicao_id
       and nome_normalizado = v_sessao.nome_normalizado
       and turma_normalizada = v_sessao.turma_normalizada
  ) then
    update public.urna_sessoes
       set status = 'usada',
           usada_em = now()
     where id = v_sessao.id;
    return jsonb_build_object('ok', true, 'ja_registrado', true);
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
    v_sessao.nome_eleitor,
    v_sessao.nome_normalizado,
    v_sessao.turma,
    v_sessao.turma_normalizada,
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
    raise exception 'Este nome e turma já votaram nesta eleição.';
end;
$$;

revoke all on function public.urna_registrar_voto(text, jsonb) from public;
grant execute on function public.urna_registrar_voto(text, jsonb) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Cancelamento de sessão (inatividade / saída)
-- ---------------------------------------------------------------------------
create or replace function public.urna_cancelar_sessao(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  update public.urna_sessoes
     set status = 'cancelada'
   where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
     and status = 'ativa';

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.urna_cancelar_sessao(text) from public;
grant execute on function public.urna_cancelar_sessao(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Conferência de votante (admin)
-- ---------------------------------------------------------------------------
create or replace function public.urna_conferir_votante(
  p_eleicao_id uuid,
  p_nome text,
  p_turma text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_presenca public.urna_presencas%rowtype;
begin
  if not public.urna_is_admin() then
    raise exception 'Acesso negado.';
  end if;

  select *
    into v_presenca
    from public.urna_presencas
   where eleicao_id = p_eleicao_id
     and nome_normalizado = public.urna_normalizar_nome(p_nome)
     and turma_normalizada = public.urna_normalizar_turma(p_turma)
   limit 1;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'id', v_presenca.id,
    'nome_eleitor', v_presenca.nome_eleitor,
    'turma', v_presenca.turma,
    'votou_em', v_presenca.votou_em
  );
end;
$$;

revoke all on function public.urna_conferir_votante(uuid, text, text) from public;
grant execute on function public.urna_conferir_votante(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Apuração
-- ---------------------------------------------------------------------------
create or replace function public.urna_apurar(
  p_eleicao_id uuid,
  p_parcial boolean default false
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_eleicao public.urna_eleicoes%rowtype;
  v_total_votantes integer;
  v_cargos jsonb := '[]'::jsonb;
  v_cargo public.urna_cargos%rowtype;
  v_cargo_json jsonb;
  v_candidatos jsonb;
  v_total_votos integer;
  v_validos integer;
  v_brancos integer;
  v_nulos integer;
  v_qtd_max integer;
  v_empate boolean;
begin
  if not public.urna_is_admin() then
    raise exception 'Acesso negado.';
  end if;

  select *
    into v_eleicao
    from public.urna_eleicoes
   where id = p_eleicao_id;

  if not found then
    raise exception 'Eleição não encontrada.';
  end if;

  if v_eleicao.status <> 'encerrada' and not coalesce(p_parcial, false) then
    raise exception 'A eleição ainda não foi encerrada.';
  end if;

  select count(*)::integer
    into v_total_votantes
    from public.urna_presencas
   where eleicao_id = p_eleicao_id;

  for v_cargo in
    select *
      from public.urna_cargos
     where eleicao_id = p_eleicao_id
     order by ordem, nome
  loop
    select
      count(*)::integer,
      count(*) filter (where tipo = 'candidato')::integer,
      count(*) filter (where tipo = 'branco')::integer,
      count(*) filter (where tipo = 'nulo')::integer
      into v_total_votos, v_validos, v_brancos, v_nulos
      from public.urna_votos
     where eleicao_id = p_eleicao_id
       and cargo_id = v_cargo.id;

    with votos_cand as (
      select
        cand.id,
        cand.numero,
        cand.nome,
        cand.nome_urna,
        cand.chapa,
        cand.vice,
        cand.ativo,
        count(v.id)::integer as votos
        from public.urna_candidatos cand
        left join public.urna_votos v
          on v.candidato_id = cand.id
         and v.cargo_id = v_cargo.id
         and v.eleicao_id = p_eleicao_id
         and v.tipo = 'candidato'
       where cand.cargo_id = v_cargo.id
       group by cand.id
    ),
    base0 as (
      select vc.*, max(vc.votos) over () as max_votos
        from votos_cand vc
    ),
    base as (
      select
        b.*,
        row_number() over (order by b.votos desc, b.nome asc) as posicao,
        count(*) filter (where b.votos = b.max_votos and b.max_votos > 0) over () as qtd_max
        from base0 b
    )
    select
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', b.id,
            'numero', b.numero,
            'nome', b.nome,
            'nome_urna', b.nome_urna,
            'chapa', b.chapa,
            'vice', b.vice,
            'ativo', b.ativo,
            'votos', b.votos,
            'percentual', case
              when v_validos > 0
              then round((b.votos::numeric / v_validos) * 100, 2)
              else 0
            end,
            'posicao', b.posicao,
            'eleito', (b.qtd_max = 1 and b.max_votos > 0 and b.votos = b.max_votos),
            'empate', (b.qtd_max > 1)
          )
          order by b.posicao
        ),
        '[]'::jsonb
      ),
      coalesce(max(b.qtd_max), 0)::integer
      into v_candidatos, v_qtd_max
      from base b;

    v_empate := v_qtd_max > 1;

    v_cargo_json := jsonb_build_object(
      'id', v_cargo.id,
      'nome', v_cargo.nome,
      'descricao', v_cargo.descricao,
      'ordem', v_cargo.ordem,
      'digitos', v_cargo.digitos,
      'permite_branco', v_cargo.permite_branco,
      'ativo', v_cargo.ativo,
      'total_votos', v_total_votos,
      'validos', v_validos,
      'brancos', v_brancos,
      'nulos', v_nulos,
      'empate', v_empate,
      'candidatos', v_candidatos
    );

    v_cargos := v_cargos || jsonb_build_array(v_cargo_json);
  end loop;

  return jsonb_build_object(
    'eleicao', jsonb_build_object(
      'id', v_eleicao.id,
      'escola_nome', v_eleicao.escola_nome,
      'nome', v_eleicao.nome,
      'descricao', v_eleicao.descricao,
      'data_eleicao', v_eleicao.data_eleicao,
      'status', v_eleicao.status,
      'total_eleitores_aptos', v_eleicao.total_eleitores_aptos,
      'presidente_comissao', v_eleicao.presidente_comissao,
      'secretario_comissao', v_eleicao.secretario_comissao,
      'abertura_em', v_eleicao.abertura_em,
      'encerramento_em', v_eleicao.encerramento_em
    ),
    'total_votantes', v_total_votantes,
    'comparecimento_percentual', case
      when v_eleicao.total_eleitores_aptos is not null
       and v_eleicao.total_eleitores_aptos > 0
      then round((v_total_votantes::numeric / v_eleicao.total_eleitores_aptos) * 100, 2)
      else null
    end,
    'parcial', coalesce(p_parcial, false),
    'cargos', v_cargos
  );
end;
$$;

revoke all on function public.urna_apurar(uuid, boolean) from public;
grant execute on function public.urna_apurar(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Zerésima
-- ---------------------------------------------------------------------------
create or replace function public.urna_zeresima(p_eleicao_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_result jsonb;
begin
  if not public.urna_is_admin() then
    raise exception 'Acesso negado.';
  end if;

  if not exists (
    select 1 from public.urna_eleicoes where id = p_eleicao_id
  ) then
    raise exception 'Eleição não encontrada.';
  end if;

  if exists (
    select 1 from public.urna_votos where eleicao_id = p_eleicao_id
  ) then
    raise exception 'A zerésima só pode ser gerada antes do primeiro voto.';
  end if;

  v_result := public.urna_apurar(p_eleicao_id, true);
  v_result := jsonb_set(v_result, '{parcial}', 'false'::jsonb);
  v_result := jsonb_set(v_result, '{zeresima}', 'true'::jsonb);
  v_result := jsonb_set(v_result, '{gerado_em}', to_jsonb(now()));

  return v_result;
end;
$$;

revoke all on function public.urna_zeresima(uuid) from public;
grant execute on function public.urna_zeresima(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Ciclo de vida da eleição
-- ---------------------------------------------------------------------------
create or replace function public.urna_abrir_eleicao(p_eleicao_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_eleicao public.urna_eleicoes%rowtype;
  v_abertura timestamptz;
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

  if v_eleicao.status <> 'rascunho' then
    raise exception 'Somente eleições em rascunho podem ser abertas.';
  end if;

  if exists (
    select 1
      from public.urna_eleicoes
     where status = 'aberta'
       and id <> p_eleicao_id
  ) then
    raise exception 'Já existe outra eleição aberta. Encerre-a antes de abrir esta.';
  end if;

  if btrim(coalesce(v_eleicao.escola_nome, '')) = ''
     or btrim(coalesce(v_eleicao.nome, '')) = '' then
    raise exception 'Informe o nome da escola e o nome da eleição.';
  end if;

  if not exists (
    select 1
      from public.urna_cargos
     where eleicao_id = p_eleicao_id
       and ativo = true
  ) then
    raise exception 'Cadastre pelo menos um cargo ativo.';
  end if;

  if exists (
    select 1
      from public.urna_cargos c
     where c.eleicao_id = p_eleicao_id
       and c.ativo = true
       and not exists (
         select 1
           from public.urna_candidatos cand
          where cand.cargo_id = c.id
            and cand.ativo = true
       )
  ) then
    raise exception 'Todo cargo ativo precisa ter pelo menos um candidato ativo.';
  end if;

  if exists (
    select 1
      from public.urna_candidatos cand
      join public.urna_cargos c on c.id = cand.cargo_id
     where cand.eleicao_id = p_eleicao_id
       and cand.ativo = true
       and length(cand.numero) <> c.digitos
  ) then
    raise exception 'Há candidato com número fora do tamanho configurado para o cargo.';
  end if;

  if exists (
    select 1 from public.urna_votos where eleicao_id = p_eleicao_id
  ) or exists (
    select 1 from public.urna_presencas where eleicao_id = p_eleicao_id
  ) then
    raise exception 'Esta eleição já possui votos registrados.';
  end if;

  v_abertura := now();

  update public.urna_eleicoes
     set status = 'aberta',
         abertura_em = v_abertura,
         encerramento_em = null
   where id = p_eleicao_id;

  insert into public.urna_auditoria (eleicao_id, actor_id, acao, detalhes)
  values (
    p_eleicao_id,
    auth.uid(),
    'eleicao_aberta',
    jsonb_build_object('abertura_em', v_abertura)
  );

  return jsonb_build_object(
    'ok', true,
    'eleicao_id', p_eleicao_id,
    'abertura_em', v_abertura
  );
end;
$$;

revoke all on function public.urna_abrir_eleicao(uuid) from public;
grant execute on function public.urna_abrir_eleicao(uuid) to authenticated;

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
         encerramento_em = v_encerramento
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

create or replace function public.urna_reabrir_eleicao(
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

  if v_eleicao.status <> 'encerrada' then
    raise exception 'Somente eleições encerradas podem ser reabertas.';
  end if;

  if exists (
    select 1
      from public.urna_eleicoes
     where status = 'aberta'
       and id <> p_eleicao_id
  ) then
    raise exception 'Já existe outra eleição aberta. Encerre-a antes de reabrir esta.';
  end if;

  update public.urna_eleicoes
     set status = 'aberta',
         encerramento_em = null
   where id = p_eleicao_id;

  insert into public.urna_auditoria (eleicao_id, actor_id, acao, detalhes)
  values (
    p_eleicao_id,
    auth.uid(),
    'eleicao_reaberta',
    jsonb_build_object('motivo', nullif(btrim(coalesce(p_motivo, '')), ''))
  );

  return jsonb_build_object('ok', true, 'eleicao_id', p_eleicao_id);
end;
$$;

revoke all on function public.urna_reabrir_eleicao(uuid, text) from public;
grant execute on function public.urna_reabrir_eleicao(uuid, text) to authenticated;

create or replace function public.urna_nova_eleicao(
  p_escola_nome text,
  p_nome text,
  p_data_eleicao date default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_nova public.urna_eleicoes%rowtype;
begin
  if not public.urna_is_admin() then
    raise exception 'Acesso negado.';
  end if;

  if exists (
    select 1 from public.urna_eleicoes where status = 'aberta'
  ) then
    raise exception 'Encerre a eleição atual antes de criar outra.';
  end if;

  if btrim(coalesce(p_escola_nome, '')) = ''
     or btrim(coalesce(p_nome, '')) = '' then
    raise exception 'Informe o nome da escola e o nome da eleição.';
  end if;

  update public.urna_eleicoes
     set status = 'arquivada'
   where status in ('rascunho', 'encerrada');

  insert into public.urna_eleicoes (
    escola_nome,
    nome,
    data_eleicao,
    status,
    created_by
  )
  values (
    btrim(p_escola_nome),
    btrim(p_nome),
    p_data_eleicao,
    'rascunho',
    auth.uid()
  )
  returning * into v_nova;

  insert into public.urna_auditoria (eleicao_id, actor_id, acao, detalhes)
  values (
    v_nova.id,
    auth.uid(),
    'eleicao_criada',
    jsonb_build_object(
      'escola_nome', v_nova.escola_nome,
      'nome', v_nova.nome
    )
  );

  return jsonb_build_object(
    'ok', true,
    'eleicao', jsonb_build_object(
      'id', v_nova.id,
      'escola_nome', v_nova.escola_nome,
      'nome', v_nova.nome,
      'data_eleicao', v_nova.data_eleicao,
      'status', v_nova.status
    )
  );
end;
$$;

revoke all on function public.urna_nova_eleicao(text, text, date) from public;
grant execute on function public.urna_nova_eleicao(text, text, date) to authenticated;

-- ---------------------------------------------------------------------------
-- Auditoria e relatórios
-- ---------------------------------------------------------------------------
create or replace function public.urna_auditar(
  p_eleicao_id uuid,
  p_acao text,
  p_detalhes jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  if not public.urna_is_admin() then
    raise exception 'Acesso negado.';
  end if;

  insert into public.urna_auditoria (eleicao_id, actor_id, acao, detalhes)
  values (
    p_eleicao_id,
    auth.uid(),
    left(coalesce(p_acao, 'acao'), 80),
    coalesce(p_detalhes, '{}'::jsonb)
  );

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.urna_auditar(uuid, text, jsonb) from public;
grant execute on function public.urna_auditar(uuid, text, jsonb) to authenticated;

create or replace function public.urna_registrar_relatorio(
  p_eleicao_id uuid,
  p_tipo text,
  p_parcial boolean default false,
  p_cargo_id uuid default null,
  p_storage_path text default null,
  p_hash_dados text default null,
  p_hash_arquivo text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_relatorio public.urna_relatorios%rowtype;
begin
  if not public.urna_is_admin() then
    raise exception 'Acesso negado.';
  end if;

  if p_tipo not in ('zeresima', 'boletim_cargo', 'ata_encerramento') then
    raise exception 'Tipo de relatório inválido.';
  end if;

  insert into public.urna_relatorios (
    eleicao_id,
    cargo_id,
    tipo,
    parcial,
    storage_path,
    hash_dados,
    hash_arquivo,
    gerado_por
  )
  values (
    p_eleicao_id,
    p_cargo_id,
    p_tipo,
    coalesce(p_parcial, false),
    p_storage_path,
    p_hash_dados,
    p_hash_arquivo,
    auth.uid()
  )
  returning * into v_relatorio;

  insert into public.urna_auditoria (eleicao_id, actor_id, acao, detalhes)
  values (
    p_eleicao_id,
    auth.uid(),
    'relatorio_gerado',
    jsonb_build_object(
      'tipo', p_tipo,
      'parcial', coalesce(p_parcial, false),
      'hash_dados', p_hash_dados
    )
  );

  return jsonb_build_object(
    'id', v_relatorio.id,
    'eleicao_id', v_relatorio.eleicao_id,
    'cargo_id', v_relatorio.cargo_id,
    'tipo', v_relatorio.tipo,
    'parcial', v_relatorio.parcial,
    'storage_path', v_relatorio.storage_path,
    'hash_dados', v_relatorio.hash_dados,
    'hash_arquivo', v_relatorio.hash_arquivo,
    'criado_em', v_relatorio.criado_em
  );
end;
$$;

revoke all on function public.urna_registrar_relatorio(uuid, text, boolean, uuid, text, text, text) from public;
grant execute on function public.urna_registrar_relatorio(uuid, text, boolean, uuid, text, text, text) to authenticated;
