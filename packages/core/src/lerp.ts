export interface Point2D {
  x: number;
  y: number;
}

/**
 * Standard linear interpolation between two scalars.
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

/**
 * Linear interpolation between two 2D points.
 */
export function lerpPoint(p1: Point2D, p2: Point2D, t: number): Point2D {
  return {
    x: lerp(p1.x, p2.x, t),
    y: lerp(p1.y, p2.y, t)
  };
}

/**
 * Frame-rate independent exponential smoothing.
 * @param current Current value
 * @param target Target value
 * @param decay Decay coefficient (higher = faster snap, lower = smoother lag, e.g. 15-25)
 * @param dt Delta time in seconds (e.g. 0.016 for 60 FPS)
 */
export function expDecay(current: number, target: number, decay: number, dt: number): number {
  return target + (current - target) * Math.exp(-decay * dt);
}

/**
 * Frame-rate independent exponential smoothing for 2D points.
 */
export function expDecayPoint(current: Point2D, target: Point2D, decay: number, dt: number): Point2D {
  return {
    x: expDecay(current.x, target.x, decay, dt),
    y: expDecay(current.y, target.y, decay, dt)
  };
}
