import type { Ability, AbilityScores, ArmorInfo, Character, CharacterSpell, ClassLevel, Item, Note, Spell } from '../types';
import { BACKGROUNDS, CLASSES, SPECIES, WEAPONS, armorByName, classById, subclassesFor } from '../data';
import { ABILITIES, ABILITY_NAMES, SKILLS, abilityMod } from './abilities';
import { armorClassFrom } from './origin';
import { newCombat } from './combat';

/*
 * Converts a character exported as a `.cah` file (JSON with `jsonType: "character"`) by another
 * character sheet app into a D&D Assist character. The format is not documented, so every field
 * is read defensively and anything that cannot be mapped ends up in the notes or the warnings.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
type Obj = Record<string, any>;

export interface CahImportResult { character: Character; warnings: string[] }

export function isCahCharacter(data: unknown): data is Obj {
  const d = data as Obj;
  return !!d && typeof d === 'object' && !Array.isArray(d) && d.jsonType === 'character' && Array.isArray(d.jobs);
}

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const num = (v: unknown, fallback = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const arr = (v: unknown): Obj[] => (Array.isArray(v) ? v.filter((x) => x && typeof x === 'object') : []);
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const titleCase = (s: string) => s.replace(/[_-]+/g, ' ').trim().replace(/\b\w/g, (m) => m.toUpperCase());
const defaultId = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));

const ABILITY_KEYS: Record<Ability, string> = {
  str: 'strength', dex: 'dexterity', con: 'constitution', int: 'intelligence', wis: 'wisdom', cha: 'charisma',
};
const ABILITY_BY_NAME = Object.fromEntries(ABILITIES.map((a) => [ABILITY_NAMES[a].toLowerCase(), a])) as Record<string, Ability>;

/** "65 lb." → 65, "1/2 lb" → 0.5 */
export function parseWeight(v: unknown): number {
  if (typeof v === 'number') return v;
  const m = /(\d+)(?:\s*\/\s*(\d+))?(?:\.(\d+))?/.exec(str(v));
  if (!m) return 0;
  if (m[2]) return Number(m[1]) / Number(m[2]);
  return Number(`${m[1]}${m[3] ? `.${m[3]}` : ''}`);
}

/** Splits "V, S, M (holy water)" into components and material. */
function splitComponents(raw: string): { components: string; material?: string } {
  const m = /^(.*?M)\s*\((.*)\)\s*$/s.exec(raw);
  return m ? { components: m[1].trim(), material: m[2].trim() } : { components: raw };
}

/** Builds a custom spell from an exported one, reading damage, saves and attacks from the text where it can. */
export function cahSpellToCustom(s: Obj, id: string): Spell {
  const level = Math.max(0, Math.min(9, num(s.level)));
  const description = str(s.description);
  const higher = str(s.higherLevels);
  const { components, material } = splitComponents(str(s.components));
  const duration = str(s.duration);
  const knownClasses = str(s.classes).split(',').map((x) => x.trim()).filter((x) => CLASSES.some((c) => c.id === x));
  const spell: Spell = {
    id,
    name: str(s.name) || 'Unnamed spell',
    level,
    school: str(s.school).toLowerCase() || 'evocation',
    classes: [...new Set(knownClasses)],
    // "1 bonus action" → "Bonus Action", as in the 2024 SRD.
    castingTime: str(s.castingTime).replace(/^1\s+(bonus action|action|reaction)/i, (_, t: string) => t.replace(/\b\w/g, (m) => m.toUpperCase())),
    range: str(s.range),
    components,
    duration,
    description: higher ? `${description}\n\n**Using a Higher-Level Spell Slot.** ${higher}` : description,
  };
  if (material) spell.material = material;
  if (/concentration/i.test(duration)) spell.concentration = true;
  if (s.isRitual === true || /\britual\b/i.test(str(s.type))) spell.ritual = true;
  const dmg = /(\d+d\d+)\s+([a-z]+)\s+damage/i.exec(description);
  if (dmg) {
    spell.damage = dmg[1];
    spell.damageType = dmg[2].toLowerCase();
    const up = /increases by (\d+)d\d+ for each (?:spell )?slot level/i.exec(higher);
    if (up && level > 0) spell.upcastDice = Number(up[1]);
    if (level === 0 && /(5th|level 5)/i.test(higher)) spell.cantripScaling = true;
  }
  const save = /\b(strength|dexterity|constitution|intelligence|wisdom|charisma) saving throw/i.exec(description);
  if (save) spell.save = ABILITY_BY_NAME[save[1].toLowerCase()];
  const atk = /\b(ranged|melee) spell attack/i.exec(description);
  if (atk) spell.attack = atk[1].toLowerCase() as 'ranged' | 'melee';
  return spell;
}

/** Armour data for an exported armour: its category ("Heavy Armor", "Shield") and AC. */
function armorInfo(a: Obj): ArmorInfo | undefined {
  const cat = `${str(a.category)} ${str(a.name)}`.toLowerCase();
  const known = armorByName(str(a.name));
  const category: ArmorInfo['category'] | undefined =
    cat.includes('shield') ? 'shield' : cat.includes('heavy') ? 'heavy' : cat.includes('medium') ? 'medium' : cat.includes('light') ? 'light' : known?.category;
  if (!category) return undefined;
  return { category, ac: num(a.armor, known?.ac ?? (category === 'shield' ? 2 : 10)) };
}

function inventory(d: Obj, makeId: () => string): Item[] {
  const items: Item[] = [];
  for (const a of arr(d.armors)) {
    const bits = [str(a.category), a.armor ? `AC ${a.armor}` : '', a.stealthDisadvantage ? 'Stealth disadvantage' : '', a.strRequired ? `Str ${a.strRequired}` : '', str(a.description)];
    const armor = armorInfo(a);
    items.push({
      id: makeId(), name: str(a.name) || 'Armor', qty: 1, weight: parseWeight(a.weight), notes: bits.filter(Boolean).join(' · '),
      equipped: !!a.equipped, kind: 'gear', ...(armor ? { armor } : {}),
    });
  }
  for (const w of arr(d.weapons)) {
    const dice = w.damageDiceAmount && str(w.damageDiceName) ? `${w.damageDiceAmount}${str(w.damageDiceName)}` : '';
    const dmg = [dice + (num(w.bonus) ? ` +${num(w.bonus)}` : ''), str(w.damageTypeName).toLowerCase()].filter(Boolean).join(' ');
    const bits = [dmg, str(w.properties), w.isRanged && w.normalRange ? `range ${w.normalRange}/${w.maxRange}` : '', str(w.description)];
    const srd = WEAPONS.find((x) => norm(x.name) === norm(str(w.name)));
    items.push({
      id: makeId(), name: str(w.name) || 'Weapon', qty: 1, weight: parseWeight(w.weight) || srd?.weight || 0, notes: bits.filter(Boolean).join(' · '),
      equipped: w.equipped !== false, kind: 'weapon', ...(srd ? { weaponId: srd.id } : {}),
    });
  }
  for (const e of arr(d.equipment)) {
    items.push({
      id: makeId(),
      name: str(e.name) || 'Item',
      qty: Math.max(1, num(e.quantity, num(e.amount, num(e.count, 1)))),
      weight: parseWeight(e.weight),
      notes: str(e.description),
      equipped: !!e.equipped,
      kind: 'gear',
    });
  }
  return items;
}

/** Notes from the export: each note of the other app, plus one pinned note with everything the sheet does not track. */
function buildNotes(d: Obj, classes: ClassLevel[], extra: string[], makeId: () => string, now: number): Note[] {
  const sections: string[] = [];
  const add = (title: string, lines: string[]) => { if (lines.length) sections.push(`${title}\n${lines.join('\n')}`); };
  add('Classes', [classes.map((c) => `${classById(c.id)?.name ?? c.id} ${c.level}`).join(' / ')]);
  if (str(d.alignmentName)) add('Alignment', [titleCase(str(d.alignmentName).toLowerCase())]);
  if (str(d.player)) add('Player', [str(d.player)]);
  add('Resources', arr(d.specialAbilities).filter((a) => str(a.name)).map((a) => `- ${str(a.name)}: ${num(a.usesLeft)} left`));
  const features = [
    ...arr(d.feats).map((f) => str(f.name)),
    ...arr(d.selectableFeatures).flatMap((g) => arr(g.selectedFeatures).map((f) => `${str(f.name)} (${str(g.name)})`)),
  ].filter(Boolean);
  add('Feats & features', features.map((f) => `- ${f}`));
  const profs = (type: string) => arr(d.proficiencies).filter((p) => p.typeName === type).map((p) => str(p.name)).filter(Boolean);
  add('Proficiencies', [
    ...(profs('ARMOR').length ? [`Armor: ${profs('ARMOR').join(', ')}`] : []),
    ...(profs('WEAPON').length ? [`Weapons: ${profs('WEAPON').join(', ')}`] : []),
  ]);
  for (const [key, title] of [['personalityTraits', 'Personality traits'], ['ideals', 'Ideals'], ['bonds', 'Bonds'], ['flaws', 'Flaws'], ['about', 'About']] as const) {
    if (str(d[key])) add(title, [str(d[key])]);
  }
  add('Import notes', extra.map((e) => `- ${e}`));
  const created = (n: Obj) => { const t = Date.parse(str(n.createdString)); return Number.isFinite(t) ? t : now; };
  const own: Note[] = arr(d.notes).filter((n) => !n.archivedString && str(n.text)).map((n) => {
    const text = str(n.text);
    const first = text.split('\n')[0];
    return {
      id: makeId(), tag: 'Session', title: first.length > 40 ? `${first.slice(0, 40).trimEnd()}…` : first,
      body: text, pinned: !!n.pinned, createdAt: created(n),
    };
  });
  return [{ id: makeId(), tag: 'Session', title: 'Imported from .cah', body: sections.join('\n\n'), pinned: true, createdAt: now }, ...own];
}

/** Matches an exported subclass id ("paladin_oath_of_the_ancients") to a subclass of the class. */
export function matchSubclass(classId: string, archetypeId: string): string | undefined {
  const raw = archetypeId.toLowerCase().startsWith(`${classId}_`) ? archetypeId.slice(classId.length + 1) : archetypeId;
  const want = norm(raw.replace(/^the[_\s-]+/i, ''));
  if (!want) return undefined;
  const list = subclassesFor(classId);
  return (list.find((s) => norm(s.name) === want) ?? list.find((s) => norm(s.name).includes(want) || want.includes(norm(s.name))))?.id;
}

/** Converts a `.cah` character. `srdSpells` is the bundled SRD list used to match spells by name. */
export function fromCah(d: Obj, srdSpells: Spell[], makeId: () => string = defaultId, now = Date.now()): CahImportResult {
  const warnings: string[] = [];
  const noteLines: string[] = [];

  // Classes
  const classes: ClassLevel[] = [];
  for (const j of arr(d.jobs)) {
    const id = str(j.jobId).toLowerCase();
    const level = Math.max(1, Math.min(20, num(j.level, 1)));
    if (!CLASSES.some((c) => c.id === id)) {
      warnings.push(`Unknown class "${str(j.jobId)}" (level ${level}) was skipped.`);
      continue;
    }
    if (classes.some((c) => c.id === id)) continue;
    const arch = str(j.archetypeId);
    const subclassId = arch ? matchSubclass(id, arch) : undefined;
    if (arch && !subclassId) noteLines.push(`Subclass not found: ${titleCase(arch)}`);
    classes.push({ id, level, ...(subclassId ? { subclassId } : {}) });
  }
  if (!classes.length) {
    classes.push({ id: 'fighter', level: 1 });
    warnings.push('No supported class found; the character was set to Fighter 1.');
  }
  let total = classes.reduce((n, c) => n + c.level, 0);
  if (total > 20) warnings.push('Total level was above 20 and has been capped.');
  while (total > 20) {
    const last = classes[classes.length - 1];
    const cut = Math.min(last.level - 1, total - 20);
    if (cut <= 0) { classes.pop(); } else { last.level -= cut; }
    total = classes.reduce((n, c) => n + c.level, 0);
  }

  // Species and background
  const raceId = str(d.race?.raceId).toLowerCase();
  let speciesId = SPECIES.find((s) => s.id === raceId || norm(s.name) === norm(raceId))?.id;
  if (!speciesId) {
    speciesId = SPECIES.find((s) => raceId.includes(s.id))?.id ?? 'human';
    if (raceId) warnings.push(`Species "${raceId}" is not in the SRD list; using ${SPECIES.find((s) => s.id === speciesId)?.name}.`);
    if (raceId) noteLines.push(`Original species: ${titleCase(raceId)}`);
  }
  const bgId = str(d.background?.backgroundId).toLowerCase();
  const backgroundId = BACKGROUNDS.find((b) => b.id === bgId || norm(b.name) === norm(bgId))?.id ?? 'custom';
  if (backgroundId === 'custom' && bgId) noteLines.push(`Background: ${titleCase(bgId)}`);

  // Abilities and skills
  const abilities = Object.fromEntries(
    ABILITIES.map((a) => [a, Math.max(1, Math.min(30, num(d[ABILITY_KEYS[a]]?.score, 10)))]),
  ) as AbilityScores;
  const skills: string[] = [];
  const expertise: string[] = [];
  const half: string[] = [];
  for (const s of arr(d.skills)) {
    const id = str(s.typeName).toLowerCase().replace(/_/g, '-');
    if (!SKILLS.some((k) => k.id === id)) continue;
    const p = str(s.proficiencyName).toUpperCase();
    if (p === 'FULL' || p === 'EXPERTISE') skills.push(id);
    if (p === 'EXPERTISE') expertise.push(id);
    if (p === 'HALF') half.push(id);
  }
  if (half.length) noteLines.push(`Half proficiency (not tracked): ${half.map((h) => SKILLS.find((k) => k.id === h)!.name).join(', ')}`);

  // HP: the export stores HP without CON; the sheet adds CON per level.
  const conMod = abilityMod(abilities.con);
  // Without a stored base: the full first die, then the fixed average for every other level.
  const avg = classes.reduce((n, c, i) => {
    const die = classById(c.id)?.hitDie ?? 8;
    return n + (i === 0 ? die + (c.level - 1) * (die / 2 + 1) : c.level * (die / 2 + 1));
  }, 0);
  const fromBase = (typeof d.baseHp === 'number' ? d.baseHp : avg) + conMod * total;
  const maxHp = Math.max(1, fromBase, num(d.hp));
  const currentHp = Math.max(0, Math.min(maxHp, num(d.hp, maxHp)));

  // Spells
  const srdByName = new Map(srdSpells.map((s) => [norm(s.name), s]));
  const spells: CharacterSpell[] = [];
  const customSpells: Spell[] = [];
  const casterIds = classes.filter((c) => CLASSES.find((k) => k.id === c.id)?.spellAbility).map((c) => c.id);
  const sourceFor = (spellClasses: string[]) => casterIds.find((id) => spellClasses.includes(id)) ?? casterIds[0];
  // Some exports never mark spells prepared; then every known spell counts as prepared.
  const tracksPrepared = arr(d.spells).some((s) => s.prepared === true);
  for (const s of arr(d.spells)) {
    const name = str(s.name);
    if (!name) continue;
    const srd = srdByName.get(norm(name));
    const exportClasses = str(s.classes).split(',').map((x) => x.trim());
    let spell: Spell;
    if (srd) spell = srd;
    else {
      spell = cahSpellToCustom(s, `custom-${makeId()}`);
      customSpells.push(spell);
    }
    if (spells.some((x) => x.id === spell.id)) continue;
    const classId = sourceFor([...spell.classes, ...exportClasses]);
    spells.push({ id: spell.id, prepared: !tracksPrepared || s.prepared === true || spell.level === 0, ...(classId ? { classId } : {}) });
  }
  if (customSpells.length) {
    warnings.push(`${customSpells.length} spell${customSpells.length > 1 ? 's are' : ' is'} not in the SRD and ${customSpells.length > 1 ? 'were' : 'was'} added as custom: ${customSpells.map((s) => s.name).join(', ')}.`);
  }

  const inv = inventory(d, makeId);
  const extraAc = num(d.extraAC);
  const [first, ...rest] = classes;
  const character: Character = {
    id: makeId(),
    name: str(d.name) || 'Imported character',
    classId: first.id,
    level: total,
    ...(first.subclassId ? { subclassId: first.subclassId } : {}),
    ...(rest.length ? { multiclass: rest } : {}),
    speciesId,
    backgroundId,
    abilities,
    skills,
    expertise,
    armorClass: armorClassFrom(first.id, abilities, inv.filter((i) => i.equipped)) + extraAc,
    ...(num(d.speedModifier) ? { speedOverride: (SPECIES.find((s) => s.id === speciesId)?.speed ?? 30) + num(d.speedModifier) } : {}),
    hp: { max: maxHp, current: currentHp, temp: Math.max(0, num(d.tempHp)) },
    hitDiceUsed: {},
    deathSaves: { successes: Math.min(3, num(d.successes)), failures: Math.min(3, num(d.failures)) },
    exhaustion: 0,
    conditions: [],
    spellSlotsUsed: Array(9).fill(0),
    pactSlotsUsed: 0,
    spells,
    customSpells,
    concentration: null,
    inventory: inv,
    currency: { cp: num(d.copper), sp: num(d.silver), ep: num(d.electrum), gp: num(d.gold), pp: num(d.platinum) },
    rollLog: [],
    xp: Math.max(0, num(d.exp)),
    inspiration: !!d.hasInspiration,
    notes: buildNotes(d, classes, noteLines, makeId, now),
    combat: newCombat(),
    languages: ['common'],
    tools: [],
    featureUses: {},
    feats: [],
    levelHistory: [],
    // AC follows equipped armour unless the export adds a bonus the sheet cannot see.
    creation: { method: 'manual', base: abilities, boosts: {}, hpAuto: false, acAuto: !extraAc },
    createdAt: now,
    updatedAt: now,
  };
  return { character, warnings };
}
