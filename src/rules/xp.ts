import type { Character } from '../types';
import { abilityMod } from './abilities';

/** XP needed to reach each level (index = level; index 0 unused). 2024 Player's Handbook / SRD 5.2.1. */
export const XP_TABLE = [0, 0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000];

export function levelForXp(xp: number): number {
  let l = 1;
  while (l < 20 && xp >= XP_TABLE[l + 1]) l++;
  return l;
}

/** XP needed for the next level (the level-20 threshold once at 20). */
export const xpForNext = (level: number) => XP_TABLE[Math.min(20, level + 1)];

/** Progress through the current level band, 0–100. */
export function bandPct(xp: number): number {
  const l = levelForXp(xp);
  if (l >= 20) return 100;
  return Math.max(0, Math.min(100, ((xp - XP_TABLE[l]) / (XP_TABLE[l + 1] - XP_TABLE[l])) * 100));
}

/** HP gained per level with the fixed average: die/2 + 1 + CON mod, at least 1. */
export const hpPerLevel = (hitDie: number, con: number) => Math.max(1, hitDie / 2 + 1 + abilityMod(con));

/**
 * Adds experience. Crossing a threshold does not raise the level by itself: the level-up flow
 * (`src/rules/progression.ts`) takes each new level with the player's choices.
 */
export function applyXp(c: Character, amount: number): { character: Character; levelsReady: number } {
  const xp = Math.max(0, c.xp + Math.max(0, Math.floor(amount)));
  return { character: { ...c, xp }, levelsReady: Math.max(0, levelForXp(xp) - c.level) };
}
