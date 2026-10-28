-- ============================================================================
-- URNA ESCOLAR — 006 — Correções para projetos já instalados
-- Rode no SQL Editor depois de 001 a 005. É seguro rodar mais de uma vez.
--
-- 1. Bloqueia a alteração de vínculo (eleicao_id) de cargos e candidatos.
-- 2. Cria a RPC urna_salvar_eleicao, que é a única forma de editar a eleição.
-- 3. Remove a política que permitia UPDATE direto em urna_eleicoes. Assim a
--    configuração só muda em rascunho, mesmo se alguém usar a API diretamente.
-- ============================================================================

create or replace function public.urna_bloquear_config_aberta()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_eleicao_id uuid;
begin
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

drop policy if exists "urna_eleicoes_update_admin" on public.urna_eleicoes;
