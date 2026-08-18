/**
 * Normalisation lexicale.
 *
 * Decision de design (CLAUDE.md §5) : les accents sont **normalises**.
 * "ETE" matche `ete`, `ete` et `etre`... non, mais `été` oui. Concretement la
 * grille ne contient que A-Z : sans ca il faudrait 6 glyphes de plus dans le sac
 * de lettres, et le joueur devrait deviner si la case porte un E ou un E accentue,
 * ce qui est illisible en ASCII. Si la decision change un jour, elle ne change
 * qu'ici et dans la table de poids des lettres.
 */
export function normalizeWord(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // retire les diacritiques
    .replace(/œ/gi, 'OE')
    .replace(/æ/gi, 'AE')
    .toUpperCase();
}
