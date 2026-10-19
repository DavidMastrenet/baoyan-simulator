/** All gameplay randomness comes from the saved generator. Rendering never consumes it. */
export function hashSeed(value: string): number {
  let h = 2166136261;
  for (const char of value) {
    h ^= char.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0 || 1;
}
export function random(state: { rng: number }): number {
  let x = state.rng >>> 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  state.rng = x >>> 0 || 1;
  return state.rng / 4294967296;
}
export function integer(state: { rng: number }, min: number, max: number): number {
  return Math.floor(random(state) * (max - min + 1)) + min;
}
export function pick<T>(state: { rng: number }, values: readonly T[]): T {
  if (!values.length) throw new Error('候选集合为空');
  return values[integer(state, 0, values.length - 1)]!;
}
export function weighted<T>(state: { rng: number }, values: T[], weight: (v: T) => number): T {
  const sum = values.reduce((n, v) => n + Math.max(0, weight(v)), 0);
  if (!values.length || sum <= 0) throw new Error('事件权重为空');
  let n = random(state) * sum;
  for (const value of values) {
    n -= Math.max(0, weight(value));
    if (n < 0) return value;
  }
  return values[values.length - 1]!;
}
export function newSeed(): string {
  const a = new Uint32Array(2);
  globalThis.crypto.getRandomValues(a);
  return `${a[0]!.toString(36)}-${a[1]!.toString(36)}`.toUpperCase();
}
