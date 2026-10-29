// Sastavlja web dio aplikacije za jedan način rada: kiosk | blagajna | admin
// Upotreba: node scripts/build-web.mjs kiosk   (ili: all)
// Supabase podaci: varijable KSS_SUPABASE_URL i KSS_SUPABASE_ANON_KEY, inače kss.config.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = process.argv[2] || 'kiosk';
const modes = arg === 'all' ? ['kiosk', 'blagajna', 'admin'] : [arg];

let cfg = {};
const cfgFile = path.join(root, 'kss.config.json');
if (fs.existsSync(cfgFile)) cfg = JSON.parse(fs.readFileSync(cfgFile, 'utf8'));
const supabaseUrl = (process.env.KSS_SUPABASE_URL || cfg.supabaseUrl || '').trim();
const supabaseAnonKey = (process.env.KSS_SUPABASE_ANON_KEY || cfg.supabaseAnonKey || '').trim();

function copyFonts(outVendor) {
  const fontsOut = path.join(outVendor, 'fonts');
  const sheets = [
    ['@fontsource/anton', ['400']],
    ['@fontsource/archivo', ['400', '500', '600', '700', '800']],
  ];
  const imports = [];
  for (const [pkg, weights] of sheets) {
    const dir = path.join(root, 'node_modules', pkg);
    if (!fs.existsSync(dir)) { console.warn(`! ${pkg} nije instaliran, koristi se rezervni font`); continue; }
    const name = pkg.split('/')[1];
    fs.mkdirSync(path.join(fontsOut, name, 'files'), { recursive: true });
    for (const w of weights) {
      const cssPath = path.join(dir, `${w}.css`);
      if (!fs.existsSync(cssPath)) continue;
      const css = fs.readFileSync(cssPath, 'utf8');
      for (const m of css.matchAll(/url\(\.\/files\/([^)]+)\)/g)) {
        const src = path.join(dir, 'files', m[1]);
        if (fs.existsSync(src)) fs.copyFileSync(src, path.join(fontsOut, name, 'files', m[1]));
      }
      fs.writeFileSync(path.join(fontsOut, name, `${w}.css`), css);
      imports.push(`@import url("fonts/${name}/${w}.css");`);
    }
  }
  fs.writeFileSync(path.join(outVendor, 'fonts.css'), imports.join('\n') + '\n');
}

for (const mode of modes) {
  const out = path.join(root, 'dist', mode);
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(path.join(out, 'vendor'), { recursive: true });
  for (const f of ['index.html', 'app.js', 'style.css']) fs.copyFileSync(path.join(root, 'app', f), path.join(out, f));

  const sbUmd = path.join(root, 'node_modules', '@supabase', 'supabase-js', 'dist', 'umd', 'supabase.js');
  if (fs.existsSync(sbUmd)) fs.copyFileSync(sbUmd, path.join(out, 'vendor', 'supabase.js'));
  else { console.warn('! @supabase/supabase-js nije instaliran (npm install), aplikacija će raditi u demo načinu'); fs.writeFileSync(path.join(out, 'vendor', 'supabase.js'), ''); }

  copyFonts(path.join(out, 'vendor'));

  fs.writeFileSync(path.join(out, 'config.js'),
    `window.KSS_MODE=${JSON.stringify(mode)};\nwindow.KSS_CONFIG=${JSON.stringify({ supabaseUrl, supabaseAnonKey })};\n`);
  console.log(`✓ dist/${mode}  (${supabaseUrl ? 'Supabase: ' + supabaseUrl : 'demo način, bez Supabasea'})`);
}
