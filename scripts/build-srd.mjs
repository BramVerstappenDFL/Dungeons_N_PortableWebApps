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

// Names and weights for every item a starting kit can hand out.
const itemIndex = {};
for (const folder of ['gear', 'weapons', 'armor', 'tools']) {
  for (const it of load(folder)) itemIndex[it.id] = { name: t(it.id, 'name'), weight: it.fields?.weight ?? 0, kind: folder, armor: folder === 'armor' ? { category: it.fields.category, ac: it.fields.baseAc } : undefined };
}
/** Starting-kit options (A, B, C) from an item's `kit` action. */
function kitsOf(entry) {
  const step = (entry.actions || []).find((a) => a.id === 'kit')?.steps?.[0];
  if (!step) return [];
  return step.options.map((o) => {
    const items = [];
    let gp = 0;
    for (const ch of o.changes || []) {
      if (ch.type === 'adjust' && ch.field === 'coins.gp') gp += ch.by;
      if (ch.type !== 'addItem') continue;
      const ref = String(ch.entry.item).replace(/'/g, '');
      const info = itemIndex[ref];
      if (!info) continue;
      const item = { name: info.name, qty: ch.entry.quantity ?? 1, weight: info.weight };
      if (info.kind === 'weapons') item.weaponId = short(ref);
      if (info.armor) item.armor = info.armor;
      items.push(item);
    }
    return { id: o.id, items, gp };
  });
}

const ABILITY_WORDS = { Strength: 'str', Dexterity: 'dex', Constitution: 'con', Intelligence: 'int', Wisdom: 'wis', Charisma: 'cha' };
for (const c of classes) {
  const raw = load('classes').find((x) => short(x.id) === c.id);
  const m = /Primary Ability \| ([^|]+)/.exec(t(raw.id, 'description') ?? '');
  c.primary = m ? m[1].trim().split(/ and | or /).map((w) => ABILITY_WORDS[w.trim()]).filter(Boolean) : [];
  c.kits = kitsOf(raw);
}

/** Mechanics that the app applies: resistances, darkvision, HP per level, speed and granted spells. */
function mechanicsOf(entry) {
  const m = {};
  for (const e of entry.effects || []) {
    const tag = e.value?.tag;
    if (e.target === 'damage.resistances' && tag) (m.resistances ??= []).push(tag.replace('damage.', ''));
    if (e.target === 'senses.darkvision') m.darkvision = e.value;
    if (e.target === 'hp.perLevel') m.hpPerLevel = e.value;
    if (e.target === 'combat.speed' && e.op === 'add') m.speedBonus = e.value;
    if (e.target === 'spells.species' && e.value?.item) {
      const lvl = /level\.total >= (\d+)/.exec(e.when ?? '');
      (m.spells ??= []).push({ id: short(e.value.item), minLevel: lvl ? Number(lvl[1]) : 1 });
    }
  }
  if ((entry.choices || []).some((c) => c.id === 'ability' && c.from?.options?.some((o) => o.id === 'int'))) m.abilityChoice = true;
  return m;
}
const traitsById = Object.fromEntries(load('traits').map((tr) => [tr.id, tr]));
const traitOf = (id) => ({ id: short(id), name: t(id, 'name'), description: t(id, 'description') ?? '', ...mechanicsOf(traitsById[id] ?? {}) });
const species = load('species').map((s) => {
  const traits = (s.grants || []).map((g) => g.item).filter((i) => i?.startsWith('traits.')).map(traitOf);
  const sizeChoice = (s.choices || []).find((c) => c.id === 'size');
  return {
    id: short(s.id), name: t(s.id, 'name'), speed: s.fields.speed,
    size: s.fields.size === 'choice' ? 'medium' : s.fields.size,
    sizes: sizeChoice ? sizeChoice.from.options.map((o) => o.id) : [s.fields.size],
    lineage: (s.choices || []).some((c) => c.id === 'lineage'),
    traits,
    description: t(s.id, 'description') ?? '',
  };
});

const lineages = load('lineages').map((l) => ({
  id: short(l.id), name: t(l.id, 'name'), speciesId: short(l.fields.species),
  ...(l.fields.damageType ? { damageType: l.fields.damageType } : {}),
  ...mechanicsOf(l),
  description: t(l.id, 'description') ?? '',
})).sort((a, b) => a.name.localeCompare(b.name));

const subclasses = load('subclasses').map((s) => ({
  id: short(s.id), name: t(s.id, 'name'), classId: short(s.fields.class),
  features: (s.grants || []).filter((g) => g.item?.startsWith('features.')).map((g) => ({
    id: g.item.split('.').pop(), name: t(g.item, 'name'), level: Number(/>= (\d+)/.exec(g.when ?? '')?.[1] ?? 3),
    description: t(g.item, 'description') ?? '',
  })),
  description: t(s.id, 'description') ?? '',
}));

const feats = load('feats').map((f) => ({
  id: short(f.id), name: t(f.id, 'name'), category: f.fields?.category ?? 'general', description: t(f.id, 'description') ?? '',
})).sort((a, b) => a.name.localeCompare(b.name));

const languages = load('languages').map((l) => ({ id: short(l.id), name: t(l.id, 'name'), rare: !!l.fields?.rare }))
  .sort((a, b) => a.name.localeCompare(b.name));

const backgrounds = load('backgrounds').map((b) => {
  const skills = (b.effects || [])
    .filter((e) => e.target === 'proficiencies.skills')
    .map((e) => e.value.tag.replace('skill.', ''));
  const inc = (b.choices || []).find((c) => c.id === 'ability-increase');
  const abilities = inc?.from?.options?.[0]?.choices?.[0]?.from?.values ?? [];
  const featGrant = (b.grants || []).find((g) => g.item?.startsWith('feats.'));
  const featOption = featGrant?.choices?.list?.[0]?.option;
  const tool = (b.effects || []).find((e) => e.target === 'proficiencies.tools')?.value?.item;
  return {
    id: short(b.id), name: t(b.id, 'name'), skills, abilities,
    feat: featGrant ? short(featGrant.item) : undefined,
    featNote: featOption ? featOption.charAt(0).toUpperCase() + featOption.slice(1) : undefined,
    tool: tool ? itemIndex[tool]?.name : /\*\*Tool Proficiency:\*\* ([^\n]+)/.exec(t(b.id, 'description') ?? '')?.[1]?.replace(/^Choose one kind of /, '').replace(/ \(see chapter \d\)/, '').trim(),
    kits: kitsOf(b),
    description: t(b.id, 'description') ?? '',
  };
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
write('armor.json', load('armor').map((a) => ({ id: short(a.id), name: t(a.id, 'name'), category: a.fields.category, ac: a.fields.baseAc, weight: a.fields.weight ?? 0 })));
write('lineages.json', lineages);
write('subclasses.json', subclasses);
write('feats.json', feats);
write('languages.json', languages);
console.log(`spells: ${spells.length}, classes: ${classes.length}, species: ${species.length}, backgrounds: ${backgrounds.length}, weapons: ${weapons.length}, lineages: ${lineages.length}, subclasses: ${subclasses.length}, feats: ${feats.length}, languages: ${languages.length}`);
