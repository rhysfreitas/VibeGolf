// Value noise and small helpers shared by the course modules (pure).
export function hash2(i, j) { let h = Math.imul(i | 0, 374761393) + Math.imul(j | 0, 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }
export function vnoise(x, z) { const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz); const a = hash2(i, j), b = hash2(i + 1, j), c = hash2(i, j + 1), d = hash2(i + 1, j + 1); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
export function fbm(x, z) { return vnoise(x, z) * 0.5 + vnoise(x * 2.03 + 17, z * 2.03 + 5) * 0.25 + vnoise(x * 4.1 + 3, z * 4.1 + 11) * 0.125 + vnoise(x * 8.3, z * 8.3 + 7) * 0.0625; }
export function rng(seed) { let s = seed >>> 0; return () => { s = Math.imul(s ^ (s >>> 15), 2246822507) + 0x6d2b79f5 >>> 0; return (s >>> 8) / 16777216; }; }
export const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

