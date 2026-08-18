/**
 * PRNG seede (mulberry32).
 *
 * Pourquoi pas Math.random : le determinisme est une exigence d'architecture,
 * pas un confort. Un serveur autoritaire doit pouvoir rejouer la partie d'un
 * client a partir de (seed, suite d'actions) et retomber sur le meme etat.
 * L'etat du generateur vit donc dans le GameState, pas dans une closure.
 */

/** Avance le generateur. Rend la valeur dans [0,1) et le nouvel etat. */
export function nextRandom(state: number): { value: number; state: number } {
  let t = (state + 0x6d2b79f5) | 0;
  let z = t;
  z = Math.imul(z ^ (z >>> 15), z | 1);
  z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
  return { value: ((z ^ (z >>> 14)) >>> 0) / 4294967296, state: t };
}

/** Entier dans [0, max). */
export function nextInt(state: number, max: number): { value: number; state: number } {
  const roll = nextRandom(state);
  return { value: Math.floor(roll.value * max), state: roll.state };
}

/** Seed lisible a partir d'une chaine — pratique pour rejouer un bug depuis un log. */
export function seedFromString(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
