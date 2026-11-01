// Extracts a compact JSON dataset from the SRD 5.2.1 (CC-BY-4.0) pack
// `@opencharacter/5e-srd-5.2` into src/data/. Run with `npm run build:srd`.
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

const pkgDir = fileURLToPath(new URL('../node_modules/@opencharacter/5e-srd-5.2/', import.meta.url));
const en = JSON.parse(readFileSync(join(pkgDir, 'dist/i18n/en.json'), 'utf8'));
const outDir = new URL('../src/data/', import.meta.url);
mkdirSync(outDir, { recursive: true });

const load = (folder) =>
  readdirSync(join(pkgDir, 'content', folder))
    .filter((f) => f.endsWith('.yaml'))
    .map((f) => YAML.parse(readFileSync(join(pkgDir, 'content', folder, f), 'utf8')));
const short = (id) => id.split('.').slice(1).join('.');
const t = (id, key) => en[`${id}.${key}`];

const CASTING = {
  action: 'Action', 'bonus-action': 'Bonus Action', reaction: 'Reaction',
  '1-minute': '1 minute', '10-minutes': '10 minutes', '1-hour': '1 hour',
  '8-hours': '8 hours', '12-hours': '12 hours', '24-hours': '24 hours',
};
function rangeText(f) {
  switch (f.rangeKind) {
    case 'ranged': return f.range >= 5280 ? `${f.range / 5280} mile${f.range > 5280 ? 's' : ''}` : `${f.range} feet`;
    case 'self': return f.areaShape ? `Self (${f.areaSize}-foot ${f.areaShape})` : 'Self';
    case 'touch': return 'Touch';
    case 'sight': return 'Sight';
    case 'unlimited': return 'Unlimited';
    default: return 'Special';
  }
}
function durationText(f) {
  const u = f.durationUnit;
  if (u === 'instantaneous') return 'Instantaneous';
  if (u === 'until-dispelled') return 'Until dispelled';
  if (u === 'special') return 'Special';
  const n = f.durationAmount ?? 1;
  const s = `${n} ${u}${n === 1 ? '' : 's'}`;
  return f.concentration ? `Concentration, up to ${s}` : s;
}

const spells = load('spells').map((s) => {
  const f = s.fields;
  const o = {
    id: short(s.id),
    name: t(s.id, 'name'),
    level: f.level,
    school: f.school,
    classes: (f.classes || []).map(short),
    castingTime: CASTING[f.castingTime] ?? f.castingTime,
    range: rangeText(f),
    components: [f.verbal && 'V', f.somatic && 'S', f.material && 'M'].filter(Boolean).join(', '),
    duration: durationText(f),
    description: t(s.id, 'description') ?? '',
  };
  const material = t(s.id, 'texts.material');
  if (material) o.material = material;
  if (f.concentration) o.concentration = true;
  if (f.ritual) o.ritual = true;
  if (f.save) o.save = f.save;
  if (f.attack) o.attack = f.attack;
  if (f.damage) o.damage = f.damage;
  if (f.damageType) o.damageType = f.damageType;
  if (f.damageBonus) o.damageBonus = f.damageBonus;
  if (f.damageAddsMod) o.damageAddsMod = true;
  if (f.upcastDice) o.upcastDice = f.upcastDice;
  if (f.heal) o.heal = f.heal;
  if (f.healBonus) o.healBonus = f.healBonus;
  if (f.healAddsMod) o.healAddsMod = true;
  if (f.upcastHealDice) o.upcastHealDice = f.upcastHealDice;
  if (f.upcastHealBonus) o.upcastHealBonus = f.upcastHealBonus;
  if (f.cantripScaling) o.cantripScaling = true;
  return o;
}).sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));

// Spellcasting rules per class (2024 PHB / SRD 5.2.1).
const CASTER = {
  bard: ['cha', 'full'], cleric: ['wis', 'full'], druid: ['wis', 'full'], sorcerer: ['cha', 'full'],
  wizard: ['int', 'full'], paladin: ['cha', 'half'], ranger: ['wis', 'half'], warlock: ['cha', 'pact'],
};
const classes = load('classes').map((c) => {
  const id = short(c.id);
  const saves = (c.effects || [])
    .filter((e) => e.target === 'proficiencies.saves')
    .map((e) => e.value.tag.replace('save.', ''));
  const skillChoice = (c.choices || []).find((ch) => ch.id === 'skills');
  const skillValues = skillChoice?.from?.values?.filter((v) => v.startsWith('skill.')).map((v) => v.slice(6));
  return {
    id,
    name: t(c.id, 'name'),
    hitDie: Number(String(c.fields.hitDie).replace('1d', '')),
    saves,
    skillCount: skillChoice?.pick ?? 2,
    skillOptions: skillValues?.length ? skillValues : null, // null = any skill
    spellAbility: CASTER[id]?.[0] ?? null,
    casterType: CASTER[id]?.[1] ?? 'none',
  };
});

const species = load('species').map((s) => ({
  id: short(s.id), name: t(s.id, 'name'), speed: s.fields.speed, size: s.fields.size,
  description: t(s.id, 'description') ?? '',
}));

const backgrounds = load('backgrounds').map((b) => {
  const skills = (b.effects || [])
    .filter((e) => e.target === 'proficiencies.skills')
    .map((e) => e.value.tag.replace('skill.', ''));
  const inc = (b.choices || []).find((c) => c.id === 'ability-increase');
  const abilities = inc?.from?.options?.[0]?.choices?.[0]?.from?.values ?? [];
  return { id: short(b.id), name: t(b.id, 'name'), skills, abilities, description: t(b.id, 'description') ?? '' };
});

const weapons = load('weapons').map((w) => {
  const f = w.fields;
  const tags = w.tags || [];
  const props = tags
    .filter((tag) => !['simple', 'martial', 'melee', 'ranged'].includes(tag) && !tag.startsWith('mastery.'))
    .map((tag) => tag.replace('property.', ''));
  return {
    id: short(w.id), name: t(w.id, 'name'), category: f.category, range: f.range,
    damage: String(f.damage), damageType: f.damageType, versatileDamage: f.versatileDamage,
    normalRange: f.normalRange, longRange: f.longRange, properties: props, mastery: f.mastery,
    weight: f.weight ?? 0,
  };
});

const write = (name, data) => writeFileSync(new URL(name, outDir), JSON.stringify(data));
write('spells.json', spells);
write('classes.json', classes);
write('species.json', species);
write('backgrounds.json', backgrounds);
write('weapons.json', weapons);
console.log(`spells: ${spells.length}, classes: ${classes.length}, species: ${species.length}, backgrounds: ${backgrounds.length}, weapons: ${weapons.length}`);
