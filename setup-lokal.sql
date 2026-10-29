-- =====================================================================
-- KSS Kiosk · dodavanje lokala i povezivanje korisnika
-- 1. U Supabase -> Authentication -> Users -> Add user napravite korisnika
--    (e-mail + lozinka, uključite "Auto Confirm User").
-- 2. Ispod upišite naziv lokala i taj e-mail, pa pokrenite u SQL Editoru.
-- =====================================================================

with r as (
  insert into public.restaurants (name)
  values ('KSS Street Food')                    -- naziv lokala
  returning id
)
insert into public.members (restaurant_id, user_id, role)
select r.id, u.id, 'owner'
from r, auth.users u
where u.email = 'kss@primjer.hr'                -- e-mail korisnika iz koraka 1
returning restaurant_id, user_id, role;

-- Ako je rezultat prazan, e-mail ne postoji u Authentication -> Users.

-- Dodatni korisnik za isti lokal (npr. zaseban račun za blagajnu):
-- insert into public.members (restaurant_id, user_id, role)
-- select (select id from public.restaurants where name = 'KSS Street Food'), id, 'staff'
-- from auth.users where email = 'blagajna@primjer.hr';
