import { describe, expect, it, vi } from 'vitest';
import { CachedAssetProvider } from '../src/cached-asset-provider';

describe('CachedAssetProvider (Dexie / Memory Fallback)', () => {
  it('resolves bundled /assets/... paths immediately without fetching', async () => {
    const fetchMock = vi.fn();
    const provider = new CachedAssetProvider({ fetchFn: fetchMock });

    const res = await provider.resolveAssetUrl('/assets/maps/dungeon.webp');
    expect(res.url).toBe('/assets/maps/dungeon.webp');
    expect(res.hash).toMatch(/^fnv1a_/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('downloads remote HTTPS assets and caches via simulated fetch', async () => {
    const fakeBlob = new Blob(['fake-image-bytes'], { type: 'image/webp' });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      blob: async () => fakeBlob
    });

    const provider = new CachedAssetProvider({ fetchFn: fetchMock as unknown as typeof fetch });

    const res = await provider.resolveAssetUrl('https://firebasestorage.googleapis.com/v0/b/vtt/o/map.webp');
    expect(res.hash).toMatch(/^fnv1a_/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('gracefully falls back to direct URL if fetch fails', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('Network error'));
    const provider = new CachedAssetProvider({ fetchFn: fetchMock as unknown as typeof fetch });

    const res = await provider.resolveAssetUrl('https://example.com/asset.png');
    expect(res.url).toBe('https://example.com/asset.png');
    expect(res.hash).toMatch(/^fnv1a_/);
  });
});
