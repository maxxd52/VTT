import type { DiceRollResult } from './contracts';

export type RandomNumberGenerator = () => number;

const DICE_REGEX = /^(\d+)?d(\d+)(?:(kh|kl)(\d+))?([+-]\d+)?$/i;

/**
 * Parses and evaluates a tabletop dice notation string safely without eval().
 * Supports standard RPG patterns:
 * - "1d20"
 * - "2d6+5" / "1d8-1"
 * - "2d20kh1" (Advantage / Keep Highest)
 * - "2d20kl1" (Disadvantage / Keep Lowest)
 * - "4d6kh3" (Standard ability score generation)
 */
export function parseAndRollDice(
  rawExpression: string,
  rng: RandomNumberGenerator = Math.random
): DiceRollResult {
  const trimmed = rawExpression.trim().replace(/\s+/g, '');
  if (!trimmed) {
    throw new Error('Dice expression cannot be empty');
  }

  const match = trimmed.match(DICE_REGEX);
  if (!match) {
    throw new Error(`Invalid dice expression: "${rawExpression}". Example formats: "1d20", "2d6+3", "4d6kh3".`);
  }

  const countStr = match[1];
  const sidesStr = match[2];
  const keepMode = match[3]?.toLowerCase();
  const keepCountStr = match[4];
  const modStr = match[5];

  const count = countStr ? parseInt(countStr, 10) : 1;
  const sides = parseInt(sidesStr, 10);
  const modifier = modStr ? parseInt(modStr, 10) : 0;

  // Safety guardrails against runaway execution or resource exhaustion
  if (count <= 0 || count > 100) {
    throw new Error(`Dice count must be between 1 and 100, received ${count}`);
  }
  if (sides <= 0 || sides > 1000) {
    throw new Error(`Dice sides must be between 1 and 1000, received ${sides}`);
  }

  // Generate rolls
  const rolls: number[] = [];
  for (let i = 0; i < count; i++) {
    const rawRandom = rng();
    const roll = Math.floor(rawRandom * sides) + 1;
    rolls.push(roll);
  }

  let keptSum = 0;
  if (keepMode && keepCountStr) {
    const keepCount = parseInt(keepCountStr, 10);
    if (keepCount <= 0 || keepCount > count) {
      throw new Error(`Keep count (${keepCount}) must be between 1 and total dice rolled (${count})`);
    }

    const sorted = [...rolls].sort((a, b) => (keepMode === 'kh' ? b - a : a - b));
    keptSum = sorted.slice(0, keepCount).reduce((acc, val) => acc + val, 0);
  } else {
    keptSum = rolls.reduce((acc, val) => acc + val, 0);
  }

  const total = keptSum + modifier;

  return {
    expression: trimmed,
    total,
    rolls,
    modifier
  };
}
