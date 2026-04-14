// Deterministic RNG for daily puzzles + clue selection.
// Hash from string -> 32-bit unsigned int (xmur3), then mulberry32 as generator.

function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

export function mulberry32(a: number): () => number {
  let t = a >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededRng(seed: string): () => number {
  const hasher = xmur3(seed);
  return mulberry32(hasher());
}

/** Pick `count` distinct items from `items` using weighted-without-replacement. */
export function weightedSample<T>(
  items: readonly T[],
  weights: readonly number[],
  count: number,
  rng: () => number,
): T[] {
  if (items.length !== weights.length) throw new Error("weights length mismatch");
  if (count > items.length) throw new Error("count too large");
  const pool = items.map((item, i) => ({ item, w: weights[i] }));
  const out: T[] = [];
  for (let k = 0; k < count; k++) {
    const total = pool.reduce((s, p) => s + p.w, 0);
    let pick = rng() * total;
    let chosen = pool.length - 1;
    for (let i = 0; i < pool.length; i++) {
      pick -= pool[i].w;
      if (pick <= 0) {
        chosen = i;
        break;
      }
    }
    out.push(pool[chosen].item);
    pool.splice(chosen, 1);
  }
  return out;
}
