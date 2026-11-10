export const DEFAULT_EMIT_INTERVAL_MS = 100;

/**
 * Leading + trailing edge rate limiter enforcing the <= 10 Hz network invariant.
 */
export function createThrottledEmitter<TArgs extends unknown[]>(
  fn: (...args: TArgs) => void,
  intervalMs: number = DEFAULT_EMIT_INTERVAL_MS
): (...args: TArgs) => void {
  let lastEmitTime = 0;
  let pendingTimer: ReturnType<typeof setTimeout> | null = null;
  let pendingArgs: TArgs | null = null;

  return (...args: TArgs) => {
    const now = Date.now();
    const elapsed = now - lastEmitTime;

    if (elapsed >= intervalMs) {
      if (pendingTimer !== null) {
        clearTimeout(pendingTimer);
        pendingTimer = null;
      }
      pendingArgs = null;
      lastEmitTime = now;
      fn(...args);
      return;
    }

    pendingArgs = args;
    if (pendingTimer === null) {
      const remaining = intervalMs - elapsed;
      pendingTimer = setTimeout(() => {
        pendingTimer = null;
        if (pendingArgs !== null) {
          const latest = pendingArgs;
          pendingArgs = null;
          lastEmitTime = Date.now();
          fn(...latest);
        }
      }, remaining);
    }
  };
}
