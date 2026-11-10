import type { FogPatch, GridConfig, TokenState } from './contracts';
import type { SheetTemplate } from './sheet';

export interface CampaignSnapshot {
  version: '1.0';
  id: string;
  name: string;
  savedAt: number;
  grid: GridConfig;
  tokens: TokenState[];
  fog: FogPatch[];
  sheetTemplate?: SheetTemplate;
  sheetValues?: Record<string, number | string>;
}

export function createCampaignSnapshot(
  params: Omit<CampaignSnapshot, 'version' | 'savedAt'>
): CampaignSnapshot {
  return {
    version: '1.0',
    savedAt: Date.now(),
    ...params
  };
}

export function validateCampaignSnapshot(data: unknown): CampaignSnapshot {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid campaign: payload is not an object');
  }

  const candidate = data as Partial<CampaignSnapshot>;
  if (candidate.version !== '1.0') {
    throw new Error(`Unsupported campaign format version: "${candidate.version}"`);
  }
  if (!candidate.id || typeof candidate.id !== 'string') {
    throw new Error('Invalid campaign: missing or invalid "id"');
  }
  if (!candidate.name || typeof candidate.name !== 'string') {
    throw new Error('Invalid campaign: missing or invalid "name"');
  }
  if (!candidate.grid || typeof candidate.grid.size !== 'number' || !candidate.grid.type) {
    throw new Error('Invalid campaign: missing or invalid "grid" configuration');
  }
  if (!Array.isArray(candidate.tokens)) {
    throw new Error('Invalid campaign: missing "tokens" array');
  }
  if (!Array.isArray(candidate.fog)) {
    throw new Error('Invalid campaign: missing "fog" array');
  }

  return candidate as CampaignSnapshot;
}
