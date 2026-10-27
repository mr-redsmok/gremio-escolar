-- ============================================================================
-- URNA ESCOLAR — 004 — Storage
-- Bucket privado para os PDFs de zerésima, boletim e ata.
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('urna-relatorios', 'urna-relatorios', false)
on conflict (id) do update set public = false;

drop policy if exists "urna_relatorios_storage_select" on storage.objects;
create policy "urna_relatorios_storage_select"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'urna-relatorios'
    and public.urna_is_admin()
  );

drop policy if exists "urna_relatorios_storage_insert" on storage.objects;
create policy "urna_relatorios_storage_insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'urna-relatorios'
    and public.urna_is_admin()
  );

-- Sem policy de update/delete: relatórios são imutáveis.
