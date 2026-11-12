// Builds the sign ledger, docs/typefaces.md, from two runtime text logs of the REAL game in a browser: one taken before the
// typeface pass, one after (see "How the log is made" in the doc). Every canvas text draw is logged with its text, font and call site.
//   node tools/typefaceLedger.mjs <before.json> <after.json> [out.md]
// Rows are unique (area, text, module:line); `Was` is the font drawn before, `Now` the role and family drawn after.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { roles, families, signKinds } from '../src/config/typefaces.js';

const [beforePath, afterPath, outPath = 'docs/typefaces.md'] = process.argv.slice(2);
const before = JSON.parse(readFileSync(beforePath, 'utf8'));
const after = JSON.parse(readFileSync(afterPath, 'utf8'));

const KIT = /^src\/(world\/(textures|posterTextures|mapKit|typeKit|wallBuy)|maps\/mall\/(lookKit|kit)|weapons\/models\/skinPattern)\.js/;
const callerOf = (e) => (e.chain.split(' < ').find((f) => !KIT.test(f)) ?? e.chain.split(' < ').at(-1));

const AREAS = [
  [/cinema/, 'Sunset Cinema'], [/atriumMurals|atriumStore|atriumDetails|atrium\.js|config\/atrium/, 'Grand Atrium'], [/atmosphere|concourse|zoneLooks|hallway/, 'Main hallway / concourse'],
  [/levelTwo|promenade/, 'Sunset Promenade (level 2)'], [/departmentStore|paintedInteriors/, "HOFFMAN'S"], [/megaMart|stores\.js/, 'Mega Mart / food court stores'],
  [/startRoom/, 'Start room'], [/workshop/, 'Build-A-Blaster'], [/claw|prizeCounter/, 'Claw machine / prize counter'], [/restock/, 'RESTOCK-O-MATIC'],
  [/kiosk/, 'Kiosk Kevin'], [/parking/, 'Customer Parking'], [/wardrobe|showpiece/, 'Wardrobe'], [/setPieces|props\.js|mall\.js/, 'Mall set pieces / props'],
  [/weapons\//, 'Weapon models'], [/zombies\//, 'Zombie costumes'], [/clearanceSticker|retailUnease|impactModels/, 'Runtime effects'], [/testRange/, 'Test range (debug)'],
];
const areaOf = (site) => (AREAS.find(([re]) => re.test(site)) ?? [null, 'Other / shared'])[1];

const PURPOSES = [
  [/\$|¢|%|\bOFF\b|SALE|PRICE|MARKDOWN|CLEARANCE|REFUND|FINAL|COUPON|SAVE/i, 'price / sale notice'],
  [/EXIT|ESCALATOR|STAIR|FOOD COURT|PARKING|STAFF|DIRECTORY|LEVEL|FLOOR|AISLE|REST ?ROOM|WAY|ENTRANCE|ENTER|LOBBY|ROW|LANE|LOT\b|NORTH|SOUTH/i, 'wayfinding'],
  [/NOW SERVING|^\d+(\.\d+)?$|SCORE|CREDIT|TICKETS?|\d\d:\d\d|^[\d\s.:·-]+$/i, 'display / counter / number'],
  [/PUSH|PULL|CAUTION|DANGER|WARNING|VOLTAGE|HAZARD|NO |DO NOT|KEEP|NOTICE|POLICY|RULES|ONLY/i, 'notice / warning'],
];
const purposeOf = (text, role) => {
  const hit = PURPOSES.find(([re]) => re.test(text));
  if (hit) return hit[1];
  if (['marquee', 'neonScript', 'neonBlock', 'chrome', 'mallBrand', 'hoffmanBrand', 'martBrand', 'toyBrand', 'dinerScript', 'wokBrush', 'carnival', 'varsity', 'industrial'].includes(role)) return 'storefront / brand name';
  if (['marker', 'note', 'scrawl', 'kevin'].includes(role)) return 'hand-made note';
  if (['typewriter', 'ticket'].includes(role)) return 'printed memo / ticket';
  if (['led', 'terminal', 'readout'].includes(role)) return 'electronic display';
  return 'label / caption';
};

const roleByFamily = new Map();
for (const [name, def] of Object.entries(roles)) {
  const key = `${def.italic ? 'italic ' : ''}${def.weight}|${def.family}`;
  if (!roleByFamily.has(key)) roleByFamily.set(key, []);
  roleByFamily.get(key).push(name);
}
const cleanFont = (font) => font.replace(/\d+(\.\d+)?px/, 'Npx').replace(/"/g, '');
const nowOf = (font) => {
  // the browser normalises ctx.font: 700 -> "bold", 400 -> nothing, quotes dropped from simple names
  const m = /^(italic )?(bold|[0-9]+)? ?[0-9.]+px (?:"([^"]+)"|([^,]+))/.exec(font);
  const family = m && (m[3] ?? m[4]);
  if (!m || !families[family]) return { text: '**' + cleanFont(font) + '** (fallback)', role: null };
  const weight = m[2] === 'bold' ? 700 : Number(m[2] ?? 400);
  const names = roleByFamily.get(`${m[1] ? 'italic ' : ''}${weight}|${family}`) ?? [];
  return { text: `${family} ${m[1] ?? ''}${weight}`, role: names[0] ?? null, names };
};

const row = (e) => ({ site: callerOf(e), draw: e.chain.split(' < ')[0], text: e.text.replace(/\s+/g, ' ').trim() });
const key = (r) => `${r.site}|${r.text}`;
const was = new Map();
for (const e of before) { const r = row(e); const k = key(r); if (!was.has(k)) was.set(k, { ...r, fonts: new Set() }); was.get(k).fonts.add(cleanFont(e.font)); }
const now = new Map();
for (const e of after) { const r = row(e); const k = key(r); if (!now.has(k)) now.set(k, { ...r, fonts: new Set() }); now.get(k).fonts.add(e.font); }

// Sites change line numbers during a pass: join by (module, text), not by line.
const strip = (site) => site.replace(/:\d+$/, '');
const rows = new Map();
const add = (map, field) => {
  for (const r of map.values()) {
    const k = r.text.toUpperCase();
    if (!rows.has(k)) rows.set(k, { module: strip(r.site), lines: new Set(), mods: new Set(), text: r.text, was: new Set(), now: new Set() });
    const out = rows.get(k);
    out.lines.add(r.site.split(':').pop()); out.mods.add(strip(r.site).replace('src/', '') + ':' + r.site.split(':').pop());
    for (const f of r.fonts) out[field].add(f);
  }
};
add(was, 'was');
add(now, 'now');

const esc = (s) => String(s).replace(/\|/g, '\\|').replace(/`/g, "'");
const groups = new Map();
for (const r of rows.values()) {
  const nowFonts = [...r.now].map(nowOf);
  const role = nowFonts.find((n) => n.role)?.role ?? null;
  const area = areaOf(r.module);
  if (!groups.has(area)) groups.set(area, []);
  groups.get(area).push({ ...r, nowFonts, role });
}

const fallbackNow = [];
const lines = [];
let total = 0;
for (const [area, list] of [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  list.sort((a, b) => a.module.localeCompare(b.module) || a.text.localeCompare(b.text));
  lines.push(`### ${area} (${list.length})`, '', '| Text | Module:line | Was | Now | Purpose |', '|---|---|---|---|---|');
  for (const r of list) {
    total++;
    const nowText = r.nowFonts.length ? [...new Set(r.nowFonts.map((n) => `${r.role === n.role && n.role ? `\`${n.role}\` ` : ''}${n.text}`))].join('; ') : '*(not drawn in the after-log: runtime-only)*';
    if (r.nowFonts.some((n) => !n.role && n.text.includes('(fallback)'))) fallbackNow.push(`${r.module}: ${r.text}`);
    lines.push(`| ${esc(r.text.length > 48 ? r.text.slice(0, 45) + '...' : r.text)} | ${esc(r.module.replace('src/', ''))}:${[...r.lines].slice(0, 2).join(',')} | ${esc([...r.was].slice(0, 2).join('; ') || '-')} | ${esc(nowText)} | ${esc(purposeOf(r.text, r.role))} |`);
  }
  lines.push('');
}

const USE = {
  neonScript: 'neon script signs (diner, lounge, cursive neon)', neonBlock: 'block neon (arcade, claw machine marquee)', chrome: 'chrome-outline 80s display (mall landmarks, murals)',
  mallBrand: "the Sunset Galleria's own voice: posters, banners, mall name", hoffmanBrand: "HOFFMAN'S department store: engraved serif caps (store name, farewell letter)",
  hoffmanSub: "HOFFMAN'S italic sub-lines, taglines, ghost adverts", hoffmanSerif: 'boutique serif (fashion, beauty, portraits)', martBrand: 'Mega Mart discount bold, aisle numbers',
  martSub: 'Mega Mart small caps sub-lines', toyBrand: 'toy store and Build-A-Blaster outlined bubble letters', toyBody: 'toy-store and workshop labels, Sunny the sun speaks in it',
  varsity: 'Good Sports varsity block', industrial: 'Nuts & Bolts / hardware, safety boards', terminal: 'computer store CRT text', readout: 'electronic counters and now-serving boards',
  dinerScript: 'Burger Barn diner script', wokBrush: 'Wok This Way brush lettering', carnival: 'Corn Dog Corral carnival slab', marquee: 'cinema art-deco marquee and movie titles',
  cinemaBody: 'cinema credit lines, menu boards, seat rows', ticket: 'ticket stubs and tear-offs', clearance: 'going-out-of-business, sale and refund banners',
  priceTag: 'price stickers, shelf tags', wayfinding: 'official wayfinding: exits, directions, levels', official: 'generic shop sign grotesk, customer service',
  officialBody: 'small official print', stencil: 'service / parking / RESTOCK-O-MATIC stencil', hazard: 'danger and caution signs', arcade: 'arcade instructions',
  marker: 'hand-made marker signs and notes', note: 'handwritten notes', scrawl: 'scrawled graffiti-style notes', kevin: "Kiosk Kevin's hustler hand-lettering",
  typewriter: 'memos, schedules, paperwork', led: 'dot-matrix / LED displays', hud3d: '3D-world numerals that echo the HUD',
};
const roleLines = ['| Role | Font | Treatment | Used for |', '|---|---|---|---|'];
for (const [name, d] of Object.entries(roles)) {
  const t = [d.caps && d.caps + ' case', d.tracking && 'tracking ' + d.tracking + 'em', d.slant && 'slant ' + d.slant, d.outline && 'outline', d.shadow && 'hard shadow', d.glow && 'glow'].filter(Boolean).join(', ');
  roleLines.push('| `' + name + '` | ' + d.family + ' ' + (d.italic ? 'italic ' : '') + d.weight + ' | ' + (t || '-') + ' | ' + (USE[name] ?? '') + ' |');
}
const familyLines = ['| Family | Weights | Licence |', '|---|---|---|'];
for (const [name, d] of Object.entries(families)) familyLines.push('| ' + name + ' | ' + d.weights.join(', ') + (d.italic ? ' + italic ' + d.italic.join(', ') : '') + ' | ' + (d.license === 'OFL' ? 'SIL OFL 1.1' : 'Apache 2.0') + ' |');
const kindLines = ['| Sign style | Role (name) | Role (sub-line) |', '|---|---|---|'];
for (const [k, v] of Object.entries(signKinds)) kindLines.push('| `' + k + '` | `' + v.main + '` | ' + (v.sub ? '`' + v.sub + '`' : '') + ' |');
const doc = [
  '# Typefaces: the sign ledger', '',
  'Every sign, poster, label, neon, notice, price tag and printed text drawn into the 3D world, and the typeface it now has. The HUD and menus (DOM, `style.css`, the minimap canvas) are out of scope.', '',
  '*This table is generated by `tools/typefaceLedger.mjs` from two runtime logs of the real game (before and after the pass); see "How the log is made". `Was` is the font string drawn before; `Now` is the role and the family+weight drawn after. Rows are unique (area, text, module). Purpose is a heuristic label from the text and role.*', '',
  `**${total} unique signs.**`, '', '## The type system', '', 'Roles live in `src/config/typefaces.js`; a module asks for a role through `world/typeKit.js` (`fontFor`, `drawType`). Fonts are bundled in `src/fonts/` (no network). Treatments (case, tracking, slant, outline, hard shadow, glow, gradient) are options of `drawType`, defaulting to the role itself.', '', '### Fonts and licences', '', ...familyLines, '', '### Roles', '', ...roleLines, '', '### Sign styles to roles', '', ...kindLines, '', '## Signs, by area', '',
  ...lines,
].join('\n');
writeFileSync(outPath + '.body', doc);
console.log(`${total} rows; ${fallbackNow.length} drawn in a fallback font after`);
if (fallbackNow.length) console.log(fallbackNow.slice(0, 40).join('\n'));
