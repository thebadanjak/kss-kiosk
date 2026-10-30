-- KSS Kiosk · ispravak za upload fotografija
-- Pokrenite jednom u Supabase -> SQL Editor -> Run.

insert into storage.buckets (id, name, public)
values ('menu-photos', 'menu-photos', true)
on conflict (id) do update set public = true;

drop policy if exists "member reads photos" on storage.objects;
create policy "member reads photos" on storage.objects
  for select to authenticated
  using (bucket_id = 'menu-photos' and public.is_member(((storage.foldername(name))[1])::uuid));
