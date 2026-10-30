-- =====================================================================
-- KSS Kiosk · Supabase shema
-- Pokrenite cijelu datoteku jednom u Supabase -> SQL Editor -> Run.
-- Sigurno ju je pokrenuti ponovno (ne briše podatke).
-- =====================================================================

-- ---------- Lokali (restorani) ----------
create table if not exists public.restaurants (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now()
);

-- ---------- Tko pripada kojem lokalu ----------
create table if not exists public.members (
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  role          text not null default 'staff' check (role in ('owner','staff')),
  created_at    timestamptz not null default now(),
  primary key (restaurant_id, user_id)
);

-- ---------- Meni (cijela konfiguracija lokala u jednom JSON-u) ----------
create table if not exists public.menus (
  restaurant_id uuid primary key references public.restaurants(id) on delete cascade,
  config        jsonb not null,
  updated_at    timestamptz not null default now(),
  updated_by    uuid default auth.uid()
);

-- ---------- Narudžbe ----------
create table if not exists public.orders (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  client_id     text not null,                 -- id koji generira kiosk, štiti od duplih narudžbi
  number        int  not null,                 -- broj koji kupac vidi
  business_date date not null,
  dine          text,
  lines         jsonb not null,
  total         numeric(10,2) not null,
  status        text not null default 'open' check (status in ('open','paid','void')),
  device        text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (restaurant_id, client_id)
);
create index if not exists orders_restaurant_created_idx on public.orders (restaurant_id, created_at desc);

-- ---------- Brojač narudžbi po danu ----------
create table if not exists public.order_counters (
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  business_date date not null,
  last          int  not null default 0,
  primary key (restaurant_id, business_date)
);

-- ---------- Pomoćna funkcija: je li prijavljeni korisnik član lokala ----------
create or replace function public.is_member(r uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from public.members m where m.restaurant_id = r and m.user_id = auth.uid());
$$;

-- ---------- Nova narudžba s kioska: dodjeljuje broj (100, 101, ... svaki dan ispočetka) ----------
create or replace function public.place_order(
  p_restaurant uuid,
  p_client_id  text,
  p_dine       text,
  p_lines      jsonb,
  p_total      numeric,
  p_device     text default null,
  p_number     int  default null      -- samo za narudžbe primljene dok kiosk nije imao internet
)
returns public.orders
language plpgsql security definer
set search_path = public
as $$
declare
  d date := (now() at time zone 'Europe/Zagreb')::date;
  n int;
  o public.orders;
begin
  if not public.is_member(p_restaurant) then
    raise exception 'Korisnik nije član ovog lokala' using errcode = '42501';
  end if;

  -- isti client_id = ista narudžba (ponovljeni pokušaj nakon prekida veze)
  select * into o from public.orders where restaurant_id = p_restaurant and client_id = p_client_id;
  if found then return o; end if;

  if p_number is null then
    insert into public.order_counters as c (restaurant_id, business_date, last)
    values (p_restaurant, d, 1)
    on conflict (restaurant_id, business_date) do update set last = c.last + 1
    returning c.last into n;
    n := 99 + n;
  else
    n := p_number;
  end if;

  insert into public.orders (restaurant_id, client_id, number, business_date, dine, lines, total, device)
  values (p_restaurant, p_client_id, n, d, p_dine, p_lines, p_total, p_device)
  returning * into o;
  return o;
end;
$$;

revoke all on function public.place_order(uuid, text, text, jsonb, numeric, text, int) from public, anon;
grant execute on function public.place_order(uuid, text, text, jsonb, numeric, text, int) to authenticated;
grant execute on function public.is_member(uuid) to authenticated;

-- ---------- Pristup (Row Level Security) ----------
alter table public.restaurants    enable row level security;
alter table public.members        enable row level security;
alter table public.menus          enable row level security;
alter table public.orders         enable row level security;
alter table public.order_counters enable row level security;

drop policy if exists "member reads restaurant" on public.restaurants;
create policy "member reads restaurant" on public.restaurants
  for select to authenticated using (public.is_member(id));

drop policy if exists "user reads own membership" on public.members;
create policy "user reads own membership" on public.members
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "member reads menu" on public.menus;
create policy "member reads menu" on public.menus
  for select to authenticated using (public.is_member(restaurant_id));
drop policy if exists "member creates menu" on public.menus;
create policy "member creates menu" on public.menus
  for insert to authenticated with check (public.is_member(restaurant_id));
drop policy if exists "member updates menu" on public.menus;
create policy "member updates menu" on public.menus
  for update to authenticated using (public.is_member(restaurant_id)) with check (public.is_member(restaurant_id));

-- narudžbe se stvaraju samo kroz place_order(); čitanje, promjena statusa i brisanje starih za članove
drop policy if exists "member reads orders" on public.orders;
create policy "member reads orders" on public.orders
  for select to authenticated using (public.is_member(restaurant_id));
drop policy if exists "member updates orders" on public.orders;
create policy "member updates orders" on public.orders
  for update to authenticated using (public.is_member(restaurant_id)) with check (public.is_member(restaurant_id));
drop policy if exists "member deletes orders" on public.orders;
create policy "member deletes orders" on public.orders
  for delete to authenticated using (public.is_member(restaurant_id));
-- order_counters: bez pravila = nitko izvana, samo place_order()

grant select on public.restaurants to authenticated;
grant select on public.members to authenticated;
grant select, insert, update on public.menus to authenticated;
grant select, update, delete on public.orders to authenticated;

-- ---------- Uživo (Realtime) za narudžbe i meni ----------
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'orders') then
    alter publication supabase_realtime add table public.orders;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'menus') then
    alter publication supabase_realtime add table public.menus;
  end if;
end $$;

-- ---------- Fotografije artikala (javno čitanje, upload samo članovi) ----------
insert into storage.buckets (id, name, public)
values ('menu-photos', 'menu-photos', true)
on conflict (id) do update set public = true;

drop policy if exists "member reads photos" on storage.objects;
create policy "member reads photos" on storage.objects
  for select to authenticated
  using (bucket_id = 'menu-photos' and public.is_member(((storage.foldername(name))[1])::uuid));
drop policy if exists "member uploads photos" on storage.objects;
create policy "member uploads photos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'menu-photos' and public.is_member(((storage.foldername(name))[1])::uuid));
drop policy if exists "member updates photos" on storage.objects;
create policy "member updates photos" on storage.objects
  for update to authenticated
  using (bucket_id = 'menu-photos' and public.is_member(((storage.foldername(name))[1])::uuid));
drop policy if exists "member deletes photos" on storage.objects;
create policy "member deletes photos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'menu-photos' and public.is_member(((storage.foldername(name))[1])::uuid));
