# KSS Kiosk · postavljanje

Dvije Android aplikacije i web administracija koje dijele isti meni i narudžbe preko Supabasea:

| Aplikacija | Gdje | Što radi |
| --- | --- | --- |
| **KSS Kiosk** (APK) | tablet za kupce | meni, košarica, broj narudžbe |
| **KSS Blagajna** (APK) | tablet kraj blagajne | narudžbe uživo sa zvukom, označavanje „Naplaćeno”, uređivanje menija |
| **Administracija** (web) | mobitel ili računalo | uređivanje menija, cijena i fotografija s bilo kojeg mjesta |

Kupac naruči na kiosku i dobije broj (100, 101… svaki dan ispočetka). Osoblje vidi narudžbu na blagajni, prekuca je u Pelion i naplati. Fiskalni račun izdaje Pelion.

Za postavljanje treba oko sat vremena. Trebaju vam besplatni računi na **supabase.com** i **github.com**.

---

## 1. Supabase (baza i fotografije)

1. Na [supabase.com](https://supabase.com) napravite novi projekt. Regija: **Central EU (Frankfurt)**. Zapišite lozinku baze.
2. Otvorite **SQL Editor → New query**, zalijepite cijeli sadržaj datoteke `supabase/schema.sql` i kliknite **Run**. Trebali biste vidjeti „Success. No rows returned”.
3. Otvorite **Authentication → Users → Add user → Create new user**. Upišite e-mail i lozinku lokala (npr. `kss@vasadomena.hr`) i uključite **Auto Confirm User**. Tim se računom prijavljuju svi uređaji lokala.
4. U **SQL Editoru** otvorite `supabase/setup-lokal.sql`, upišite naziv lokala i e-mail iz koraka 3, pa kliknite **Run**. Rezultat treba imati jedan redak s ulogom `owner`.
5. Otvorite **Project Settings → API Keys** (na starijim projektima **Project Settings → API**) i zapišite:
   - **Project URL** (npr. `https://abcd1234.supabase.co`, piše i na početnoj stranici projekta)
   - **anon public** ključ (počinje s `eyJ…`, pod „Legacy API keys”) ili **Publishable key** (počinje s `sb_publishable_…`). Oba rade.

   Anon ključ smije biti u aplikaciji. Podatke štite pravila u bazi (RLS), pa bez prijave računom lokala nitko ništa ne vidi.

## 2. GitHub (automatska gradnja APK-a)

1. Na [github.com](https://github.com) napravite novi **privatni** repozitorij, npr. `kss-kiosk`.
2. Prenesite sve datoteke iz ove mape, **uključujući skrivenu mapu `.github`**. Najlakše je preko [GitHub Desktopa](https://desktop.github.com). Ako prenosite preko weba („Add file → Upload files”), skrivena mapa se često ne prenese. Tada je napravite ručno: **Add file → Create new file**, naziv `.github/workflows/build.yml`, i zalijepite sadržaj te datoteke.
3. Otvorite **Settings → Secrets and variables → Actions → New repository secret** i dodajte dvije tajne:
   - `KSS_SUPABASE_URL` = Project URL iz koraka 1.5
   - `KSS_SUPABASE_ANON_KEY` = anon public ključ iz koraka 1.5
4. Otvorite karticu **Actions**, odaberite **Izgradi aplikacije** i kliknite **Run workflow**. Gradnja traje 5–10 minuta.
5. Kad završi, kliknite na tu gradnju i dolje pod **Artifacts** skinite:
   - `KSS-kiosk-apk`
   - `KSS-blagajna-apk`
   - `KSS-admin-web` (web administracija)

Svaka nova promjena koju prenesete na GitHub automatski gradi nove APK-ove.

## 3. Instalacija na tablete

1. Raspakirajte skinuti ZIP i prebacite `.apk` na tablet (USB, Google Drive ili e-mail).
2. Otvorite APK na tabletu. Android će tražiti dopuštenje za instalaciju iz nepoznatih izvora, pa ga odobrite za aplikaciju kojom otvarate datoteku.
3. Pokrenite aplikaciju i prijavite se e-mailom i lozinkom lokala iz koraka 1.3. Prijava ostaje zapamćena.
4. Prvi uređaj koji se prijavi pošalje svoj meni u oblak. Svi ostali uređaji zatim preuzimaju taj meni.

**Kiosk tablet:** uključite prikvačivanje aplikacije da kupci ne mogu izaći iz aplikacije: **Postavke → Sigurnost → Prikvači aplikaciju** (na Samsungu: Biometrija i sigurnost → Ostale sigurnosne postavke). Zatim otvorite KSS Kiosk, dodirnite gumb Nedavne aplikacije, ikonu aplikacije i **Prikvači**. Za trajni kiosk način kasnije možete koristiti MDM ili aplikaciju poput Fully Kiosk.

**Blagajna tablet:** otvorite KSS Blagajna, otključajte PIN-om (početni PIN je **1234**, promijenite ga u Postavkama) i dodirnite ekran jednom da se uključi zvuk za nove narudžbe.

**Ekran:** obje aplikacije drže ekran upaljenim i rade preko cijelog zaslona.

## 4. Web administracija (mobitel)

Datoteke iz `KSS-admin-web` možete objaviti na bilo kojem hostingu. Najjednostavnije je ovako:

- **Netlify Drop:** otvorite [app.netlify.com/drop](https://app.netlify.com/drop) i povucite raspakiranu mapu. Dobit ćete adresu koju otvorite na mobitelu i prijavite se računom lokala.
- **GitHub Pages** (samo javni repozitorij ili plaćeni GitHub): uključite **Settings → Pages → Source: GitHub Actions**, pa u **Settings → Secrets and variables → Actions → Variables** dodajte varijablu `KSS_PAGES` = `true`. Bez toga se taj korak preskače.

Administraciju možete otvoriti i na blagajni (tab Artikli, Kategorije, Opcije, Postavke).

## Svakodnevni rad

- **Artikli:** pretraga po nazivu, „Odaberi više” za skupnu promjenu kategorije, sekundarne kategorije, opcija i vidljivosti, te „Promijeni raspored” (najprije odaberite kategoriju) za redoslijed na kiosku.
- **Rasprodano:** na blagajni otvorite Artikli, dodirnite artikl, isključite „Dostupno za narudžbu” i spremite. Kiosk to prikaže za sekundu-dvije.
- **Nova cijena:** promijenite je u aplikaciji **i u Pelionu**, da kupac na blagajni plati isto što je vidio na kiosku.
- **Bez interneta:** kiosk i dalje prima narudžbe, s brojevima od 901 nadalje (označeni „bez veze”). Šalje ih na blagajnu čim se veza vrati. Blagajna u tom vremenu ne vidi nove narudžbe, pa kupac s brojem 9xx kaže narudžbu na blagajni.
- **Poruka na početnom ekranu:** u Postavkama upišite npr. „Danas: domaća štrudla 2,00 €”; prazno polje skriva poruku.
- **Ulaz u uređivanje na kiosku:** 5 brzih dodira na logo u gornjem lijevom kutu menija, pa PIN.
- **Stare narudžbe** (starije od 30 dana) blagajna briše automatski.

## Lokalno testiranje (nije obavezno)

```
npm install
npm run build          # dist/kiosk, dist/blagajna, dist/admin
npx http-server dist   # otvorite http://localhost:8080/kiosk/
```

Bez Supabase podataka (prazan `kss.config.json` i bez varijabli) aplikacija radi u **demo načinu** i sve sprema samo u preglednik.

APK lokalno (treba Android Studio, Java 17 i Node 20): `npm run android:kiosk` ili `npm run android:blagajna`. APK nastaje u mapi `out/`.

## Struktura

```
app/                 aplikacija (HTML, CSS, JS), jedan kod za sva tri načina
supabase/            schema.sql (tablice, pravila, fotografije), setup-lokal.sql
scripts/             build-web.mjs, build-android.sh
android-template/    MainActivity (ekran upaljen, cijeli zaslon), zajednički potpisni ključ
assets/              ikone aplikacija
.github/workflows/   automatska gradnja APK-a i web administracije
```

## Napomene

- APK-ovi su potpisani razvojnim ključem iz `android-template/debug.keystore`, isti za svaku gradnju, pa se nova verzija instalira preko stare. Za Google Play ili distribuciju drugim lokalima treba napraviti vlastiti produkcijski ključ.
- Shema je spremna za više lokala (svaki lokal ima svoj meni i narudžbe). Novi lokal dodajete preko `setup-lokal.sql` s drugim e-mailom.
