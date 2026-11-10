import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createThrottledEmitter } from '../src/throttle';

describe('createThrottledEmitter (10 Hz network invariant)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('emits at most once per 100ms window and delivers trailing final value', () => {
    const spy = vi.fn();
    const emit = createThrottledEmitter<[string, number, number]>(spy, 100);

    // Simulate 60Hz drag burst across 50ms
    emit('t1', 10, 10);
    vi.advanceTimersByTime(16);
    emit('t1', 20, 25);
    vi.advanceTimersByTime(16);
    emit('t1', 35, 40);
    vi.advanceTimersByTime(16);
    emit('t1', 50, 60);

    // Leading edge fired once immediately
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenLastCalledWith('t1', 10, 10);

    // Advance past the 100ms window -> trailing edge fires with final coordinates
    vi.advanceTimersByTime(60);
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenLastCalledWith('t1', 50, 60);
  });

  it('allows immediate emit again after quiet period', () => {
    const spy = vi.fn();
    const emit = createThrottledEmitter<[number]>(spy, 100);

    emit(1);
    expect(spy).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(150);
    emit(2);
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenLastCalledWith(2);
  });
});
