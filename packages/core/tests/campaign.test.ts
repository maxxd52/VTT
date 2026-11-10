import { describe, expect, it } from 'vitest';
import {
  createCampaignSnapshot,
  validateCampaignSnapshot,
  type CampaignSnapshot
} from '../src/campaign';

describe('Local Campaign Persistence (Tauri & Browser)', () => {
  it('creates and validates a standard CampaignSnapshot', () => {
    const snapshot = createCampaignSnapshot({
      id: 'camp-crypt-1',
      name: 'Crimson Crypt Adventure',
      grid: { size: 60, type: 'square' },
      tokens: [
        { id: 't1', name: 'Valeros', x: 120, y: 180, imageUrl: '', hp: [28, 30] }
      ],
      fog: [
        { mode: 'hide', rects: [[0, 0, 400, 400]] }
      ],
      sheetValues: { str: 16, hp: 28 }
    });

    expect(snapshot.version).toBe('1.0');
    expect(snapshot.savedAt).toBeGreaterThan(0);
    expect(snapshot.name).toBe('Crimson Crypt Adventure');

    const validated = validateCampaignSnapshot(snapshot);
    expect(validated.id).toBe('camp-crypt-1');
  });

  it('rejects corrupt, unversioned, or malformed campaign snapshots', () => {
    expect(() => validateCampaignSnapshot(null)).toThrow();
    expect(() => validateCampaignSnapshot({ version: '2.0' })).toThrow(/version/);
    expect(() => validateCampaignSnapshot({ version: '1.0', id: '123' })).toThrow(/name/);
    expect(() => validateCampaignSnapshot({ version: '1.0', id: '123', name: 'Test', grid: null })).toThrow(/grid/);
  });
});
