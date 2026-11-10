import { describe, expect, it } from 'vitest';
import {
  evaluateFormula,
  evaluateSheet,
  resolveActionRoll,
  type SheetTemplate
} from '../src/sheet';

describe('Custom Sheet Engine (Declarative CSB)', () => {
  const d20Template: SheetTemplate = {
    systemId: 'custom-d20-lite',
    name: 'Hero Sheet',
    fields: [
      { key: 'str', label: 'Strength', type: 'number', default: 16 },
      { key: 'dex', label: 'Dexterity', type: 'number', default: 14 },
      { key: 'strMod', label: 'STR Mod', type: 'computed', formula: 'floor((str - 10) / 2)' },
      { key: 'dexMod', label: 'DEX Mod', type: 'computed', formula: 'floor((dex - 10) / 2)' },
      { key: 'ac', label: 'Armor Class', type: 'computed', formula: '10 + dexMod' }
    ],
    actions: [
      { label: 'Melee Attack', roll: '1d20 + strMod' },
      { label: 'Greatsword Damage', roll: '2d6 + strMod' }
    ]
  };

  it('evaluates safe math expressions without eval()', () => {
    const scope = { str: 16, dex: 14 };
    expect(evaluateFormula('floor((str - 10) / 2)', scope)).toBe(3);
    expect(evaluateFormula('10 + dex', scope)).toBe(24);
    expect(evaluateFormula('ceil(str / 3)', scope)).toBe(6);
  });

  it('evaluates complete sheet template with defaults and chained computed fields', () => {
    const evaluated = evaluateSheet(d20Template, { str: 18, dex: 10 });

    expect(evaluated['str']).toBe(18);
    expect(evaluated['dex']).toBe(10);
    expect(evaluated['strMod']).toBe(4); // floor((18 - 10) / 2) = 4
    expect(evaluated['dexMod']).toBe(0); // floor((10 - 10) / 2) = 0
    expect(evaluated['ac']).toBe(10); // 10 + 0 = 10
  });

  it('resolves action roll templates with evaluated values', () => {
    const values = { strMod: 3, dexMod: -1 };

    // Positive modifier: 1d20 + strMod -> 1d20+3
    expect(resolveActionRoll('1d20 + strMod', values)).toBe('1d20+3');

    // Negative modifier: 1d20 + dexMod -> 1d20-1 (clean arithmetic sign normalization)
    expect(resolveActionRoll('1d20 + dexMod', values)).toBe('1d20-1');
  });

  it('rejects unsafe tokens or unauthorized function calls in formula', () => {
    const scope = { x: 5 };
    expect(() => evaluateFormula('window.alert(1)', scope)).toThrow();
    expect(() => evaluateFormula('process.exit()', scope)).toThrow();
    expect(() => evaluateFormula('eval("2+2")', scope)).toThrow();
  });
});
