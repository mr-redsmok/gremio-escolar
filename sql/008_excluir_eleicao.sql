-- ============================================================================
-- URNA ESCOLAR — 008 — Apagar eleição
-- Rode no SQL Editor depois de 007. É seguro rodar mais de uma vez.
--
-- Permite ao administrador apagar uma eleição que não esteja aberta, junto
-- com cargos, candidatos, votos, presenças, sessões, relatórios e auditoria.
-- Os PDFs do storage são removidos pela aplicação antes desta função.
-- ============================================================================

create or replace function public.urna_bloquear_config_aberta()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_eleicao_id uuid;
begin
  -- Exclusão feita por urna_excluir_eleicao (somente administrador).
  if tg_op = 'DELETE'
     and coalesce(current_setting('app.excluir_eleicao', true), '') = 'on' then
    return old;
  end if;

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

create or replace function public.urna_excluir_eleicao(p_eleicao_id uuid)
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

  if v_eleicao.status = 'aberta' then
    raise exception 'Não é possível apagar uma eleição aberta. Encerre a votação antes.';
  end if;

  perform set_config('app.excluir_eleicao', 'on', true);

  delete from public.urna_votos where eleicao_id = p_eleicao_id;
  delete from public.urna_presencas where eleicao_id = p_eleicao_id;
  delete from public.urna_sessoes where eleicao_id = p_eleicao_id;
  delete from public.urna_relatorios where eleicao_id = p_eleicao_id;
  delete from public.urna_auditoria where eleicao_id = p_eleicao_id;
  delete from public.urna_candidatos where eleicao_id = p_eleicao_id;
  delete from public.urna_cargos where eleicao_id = p_eleicao_id;
  delete from public.urna_eleicoes where id = p_eleicao_id;

  return jsonb_build_object('ok', true, 'nome', v_eleicao.nome);
end;
$$;

revoke all on function public.urna_excluir_eleicao(uuid) from public;
grant execute on function public.urna_excluir_eleicao(uuid) to authenticated;

-- Permite ao administrador remover os PDFs de uma eleição que será apagada.
drop policy if exists "urna_relatorios_storage_delete" on storage.objects;
create policy "urna_relatorios_storage_delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'urna-relatorios'
    and public.urna_is_admin()
  );
