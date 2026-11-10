import { describe, expect, it } from 'vitest';
import { expDecay, expDecayPoint, lerp, lerpPoint } from '../src/lerp';

describe('Lerp & Smooth Interpolation (60 FPS)', () => {
  it('interpolates linearly between scalars', () => {
    expect(lerp(0, 100, 0)).toBe(0);
    expect(lerp(0, 100, 0.5)).toBe(50);
    expect(lerp(0, 100, 1)).toBe(100);
  });

  it('interpolates 2D points', () => {
    const p1 = { x: 10, y: 20 };
    const p2 = { x: 30, y: 60 };
    const mid = lerpPoint(p1, p2, 0.5);
    expect(mid).toEqual({ x: 20, y: 40 });
  });

  it('performs frame-rate independent exponential smoothing', () => {
    // 60 FPS dt = 0.0166s, high decay approaches target smoothly
    const current = 0;
    const target = 100;
    const next1 = expDecay(current, target, 15, 0.016);
    expect(next1).toBeGreaterThan(0);
    expect(next1).toBeLessThan(100);

    // After multiple frames, converges on target
    let val = current;
    for (let frame = 0; frame < 30; frame++) {
      val = expDecay(val, target, 20, 0.016);
    }
    expect(val).toBeCloseTo(100, 0);
  });

  it('smooths 2D points with exponential decay', () => {
    const cur = { x: 0, y: 0 };
    const tgt = { x: 100, y: 200 };
    const smoothed = expDecayPoint(cur, tgt, 16, 0.016);

    expect(smoothed.x).toBeGreaterThan(0);
    expect(smoothed.x).toBeLessThan(100);
    expect(smoothed.y).toBeGreaterThan(0);
    expect(smoothed.y).toBeLessThan(200);
  });
});
