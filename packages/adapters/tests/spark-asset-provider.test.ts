import { describe, it, expect } from 'vitest';
import { SparkAssetProvider } from '../src/spark-asset-provider';

describe('SparkAssetProvider (Beta Spark Plan invariant)', () => {
  const provider = new SparkAssetProvider();

  it('resolves bundled static assets from Firebase Hosting paths', async () => {
    const result = await provider.resolveAssetUrl('/assets/maps/crypt.webp');
    expect(result.url).toBe('/assets/maps/crypt.webp');
    expect(result.hash).toBeTruthy();
  });

  it('resolves valid external HTTPS image URLs', async () => {
    const url = 'https://cdn.example.com/maps/tavern.webp';
    const result = await provider.resolveAssetUrl(url);
    expect(result.url).toBe(url);
    expect(result.hash).toBeTruthy();
  });

  it('rejects insecure HTTP, javascript, or empty asset references', async () => {
    await expect(provider.resolveAssetUrl('')).rejects.toThrow();
    await expect(provider.resolveAssetUrl('http://insecure.com/map.png')).rejects.toThrow();
    await expect(provider.resolveAssetUrl('javascript:alert(1)')).rejects.toThrow();
  });
});
