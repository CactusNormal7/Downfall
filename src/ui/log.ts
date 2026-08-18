/**
 * Logger categorise.
 *
 * Format impose (CLAUDE.md §3) : `[LEXA][CAT] VERBE cle=valeur cle=valeur`.
 * Une ligne = un evenement. Pas de phrases. Ca doit se grepper :
 *
 *   grep '\[NET\]'   -> tout le trafic reseau simule
 *   grep 'CHAIN'     -> toutes les chaines pour calibrer le multiplicateur
 *   grep 'TOPOUT'    -> les fins de partie
 *
 * Le moteur n'appelle jamais ce module : il emet des evenements, et c'est ici
 * qu'ils deviennent du texte. Les logs sont donc gratuits en test.
 */
export type LogCategory =
  | 'NET'
  | 'WORD'
  | 'CHAIN'
  | 'SPAWN'
  | 'EFFECT'
  | 'STATE'
  | 'GARBAGE'
  | 'DICT'
  | 'INPUT';

/** Categories actives. Coupez-en pour isoler un bug sans noyer la console. */
const ENABLED: Record<LogCategory, boolean> = {
  NET: true,
  WORD: true,
  CHAIN: true,
  SPAWN: false, // tres bavard : une ligne par lettre
  EFFECT: true,
  STATE: true,
  GARBAGE: true,
  DICT: true,
  INPUT: false,
};

/** Historique en memoire, expose pour l'overlay de debug in-game. */
const HISTORY: string[] = [];
const HISTORY_MAX = 500;

export function setCategory(category: LogCategory, enabled: boolean): void {
  ENABLED[category] = enabled;
}

export function logHistory(): readonly string[] {
  return HISTORY;
}

export function log(
  category: LogCategory,
  verb: string,
  fields: Record<string, string | number | boolean> = {},
): void {
  const pairs = Object.entries(fields)
    .map(([key, value]) => `${key}=${value}`)
    .join(' ');
  const line = `[LEXA][${category}] ${verb.padEnd(14)} ${pairs}`.trimEnd();

  HISTORY.push(line);
  if (HISTORY.length > HISTORY_MAX) HISTORY.shift();

  if (!ENABLED[category]) return;
  // eslint-disable-next-line no-console
  console.log(line);
}

/**
 * Raccourci pour le trafic reseau simule.
 * C'est LE point a surveiller : chaque appel marque un endroit ou, en vrai PvP,
 * un message part reellement sur le fil. Si un `netLog` n'a pas de `[NET]` en
 * commentaire juste au-dessus, c'est un oubli.
 */
export function netLog(verb: string, fields: Record<string, string | number | boolean>): void {
  log('NET', verb, fields);
}
