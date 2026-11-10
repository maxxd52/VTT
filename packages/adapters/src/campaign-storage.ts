import {
  type CampaignSnapshot,
  validateCampaignSnapshot
} from '@vtt/core';

export function serializeCampaign(campaign: CampaignSnapshot): string {
  const validated = validateCampaignSnapshot(campaign);
  return JSON.stringify(validated, null, 2);
}

export function deserializeCampaign(jsonStr: string): CampaignSnapshot {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (err) {
    throw new Error(`Failed to parse campaign JSON: ${(err as Error).message}`);
  }
  return validateCampaignSnapshot(parsed);
}

const STORAGE_PREFIX = 'vtt_campaign_';
const defaultMemoryStorage = createMemoryStorage();

function getStorage(custom?: Storage): Storage {
  if (custom) return custom;
  if (typeof localStorage !== 'undefined') return localStorage;
  return defaultMemoryStorage;
}

export function saveCampaignToStorage(
  campaign: CampaignSnapshot,
  storage?: Storage
): void {
  const target = getStorage(storage);
  const serialized = serializeCampaign(campaign);
  target.setItem(`${STORAGE_PREFIX}${campaign.id}`, serialized);
}

export function loadCampaignFromStorage(
  id: string,
  storage?: Storage
): CampaignSnapshot | null {
  const target = getStorage(storage);
  const item = target.getItem(`${STORAGE_PREFIX}${id}`);
  if (!item) return null;
  return deserializeCampaign(item);
}

export function listStoredCampaigns(
  storage?: Storage
): Array<{ id: string; name: string; savedAt: number }> {
  const target = getStorage(storage);
  const list: Array<{ id: string; name: string; savedAt: number }> = [];

  for (let i = 0; i < target.length; i++) {
    const key = target.key(i);
    if (key?.startsWith(STORAGE_PREFIX)) {
      try {
        const data = deserializeCampaign(target.getItem(key)!);
        list.push({ id: data.id, name: data.name, savedAt: data.savedAt });
      } catch {
        // Skip corrupt entries
      }
    }
  }

  return list.sort((a, b) => b.savedAt - a.savedAt);
}

function createMemoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, String(value));
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
    clear: () => {
      map.clear();
    },
    key: (index: number) => Array.from(map.keys())[index] ?? null,
    get length() {
      return map.size;
    }
  };
}
