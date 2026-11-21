import { bucket, levelFromDb } from '../src/ui/waveform';

describe('recorder waveform', () => {
  it('maps metering (dBFS) to bar heights, with a visible floor', () => {
    expect(levelFromDb(undefined)).toBe(0.06);
    expect(levelFromDb(-160)).toBe(0.06);
    expect(levelFromDb(0)).toBe(1);
    expect(levelFromDb(-27.5)).toBeCloseTo(0.5);
  });

  it('squeezes a long take into a fixed number of bars, keeping the peaks', () => {
    const levels = Array.from({ length: 480 }, (_, i) => (i === 100 ? 1 : 0.1));
    const bars = bucket(levels, 48);
    expect(bars).toHaveLength(48);
    expect(bars[10]).toBe(1);
    expect(bucket([0.2, 0.3], 48)).toEqual([0.2, 0.3]);
  });
});
