import { describe, expect, it } from 'vitest';
import { parseAndRollDice } from '../src/dice';

describe('Safe Tabletop Dice Parser & Roller', () => {
  // Deterministic RNG generating sequence: 0.1, 0.5, 0.9, ...
  const createMockRng = (values: number[]) => {
    let index = 0;
    return () => values[index++ % values.length];
  };

  it('rolls a single die without modifier', () => {
    // With rng returning 0.5 on d20: Math.floor(0.5 * 20) + 1 = 11
    const rng = createMockRng([0.5]);
    const res = parseAndRollDice('1d20', rng);

    expect(res.expression).toBe('1d20');
    expect(res.rolls).toEqual([11]);
    expect(res.modifier).toBe(0);
    expect(res.total).toBe(11);
  });

  it('evaluates dice with positive and negative modifiers', () => {
    // 2d6 with rng [0.0, 0.9]: dice are 1 and 6 -> sum 7
    const rng = createMockRng([0.0, 0.9]);
    const plusRes = parseAndRollDice('2d6+5', rng);
    expect(plusRes.rolls).toEqual([1, 6]);
    expect(plusRes.modifier).toBe(5);
    expect(plusRes.total).toBe(12);

    const minusRng = createMockRng([0.5, 0.5]); // 4 and 4 -> 8
    const minusRes = parseAndRollDice('2d6-3', minusRng);
    expect(minusRes.rolls).toEqual([4, 4]);
    expect(minusRes.modifier).toBe(-3);
    expect(minusRes.total).toBe(5);
  });

  it('supports keep highest (advantage / stat roll) like 2d20kh1 and 4d6kh3', () => {
    // 2d20 advantage: rolls 5 and 18, keep 18
    const rng = createMockRng([0.2, 0.85]); // Math.floor(0.2*20)+1 = 5, Math.floor(0.85*20)+1 = 18
    const adv = parseAndRollDice('2d20kh1+2', rng);
    expect(adv.rolls).toEqual([5, 18]);
    expect(adv.total).toBe(20); // 18 + 2

    // 4d6kh3: rolls [1, 3, 5, 6] -> sum of top 3 is 3+5+6=14
    const statRng = createMockRng([0.0, 0.4, 0.7, 0.9]); // 1, 3, 5, 6
    const stat = parseAndRollDice('4d6kh3', statRng);
    expect(stat.rolls).toEqual([1, 3, 5, 6]);
    expect(stat.total).toBe(14);
  });

  it('supports keep lowest (disadvantage) like 2d20kl1', () => {
    const rng = createMockRng([0.2, 0.85]); // rolls 5 and 18, keep lowest = 5
    const dis = parseAndRollDice('2d20kl1', dis => rng());
    expect(dis.rolls).toEqual([5, 18]);
    expect(dis.total).toBe(5);
  });

  it('rejects invalid or unsafe expressions without using eval()', () => {
    expect(() => parseAndRollDice('alert(1)')).toThrow();
    expect(() => parseAndRollDice('1d0')).toThrow();
    expect(() => parseAndRollDice('9999d20')).toThrow(); // anti-DDoS / runaway bounds check
  });
});
