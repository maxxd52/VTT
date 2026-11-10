import { describe, expect, it } from 'vitest';
import { createCampaignSnapshot } from '@vtt/core';
import {
  deserializeCampaign,
  listStoredCampaigns,
  loadCampaignFromStorage,
  saveCampaignToStorage,
  serializeCampaign
} from '../src/campaign-storage';

describe('Campaign Storage Adapter', () => {
  const sample = createCampaignSnapshot({
    id: 'camp-1',
    name: 'Tomb of Horrors',
    grid: { size: 70, type: 'square' },
    tokens: [{ id: 'hero-1', name: 'Ranger', x: 0, y: 0, imageUrl: '' }],
    fog: [{ mode: 'hide', rects: [[0, 0, 100, 100]] }]
  });

  it('serializes and deserializes campaign snapshots faithfully', () => {
    const json = serializeCampaign(sample);
    expect(json).toContain('"version": "1.0"');
    expect(json).toContain('"name": "Tomb of Horrors"');

    const deserialized = deserializeCampaign(json);
    expect(deserialized.id).toBe(sample.id);
    expect(deserialized.tokens).toHaveLength(1);
  });

  it('saves and loads campaigns from storage', () => {
    saveCampaignToStorage(sample);
    const loaded = loadCampaignFromStorage(sample.id);
    expect(loaded).not.toBeNull();
    expect(loaded?.name).toBe('Tomb of Horrors');

    const list = listStoredCampaigns();
    expect(list.some((item) => item.id === 'camp-1')).toBe(true);
  });
});
