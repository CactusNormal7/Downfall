/**
 * Dictionnaire de jeu.
 *
 * Structure : un Set de chaines. Le brief demandait un trie ou un hashset ;
 * le Set natif est un hashset, en O(1) et sans code a maintenir. Le trie ne
 * deviendra utile que le jour ou on voudra repondre a "existe-t-il un mot
 * commencant par ces lettres ?" (aide au joueur, IA d'adversaire) — d'ou
 * `hasPrefix` ci-dessous, qui est pour l'instant volontairement absent plutot
 * que faux. [V2]
 *
 * Interdit : toute recherche lineaire. On est dans une boucle temps reel.
 */
export class Dictionary {
  private readonly words: Set<string>;

  constructor(words: Iterable<string>) {
    this.words = new Set(words);
  }

  /** Construit depuis le fichier texte genere par scripts/build-dict.ts. */
  static fromText(raw: string): Dictionary {
    const words = raw
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    return new Dictionary(words);
  }

  has(word: string): boolean {
    return this.words.has(word);
  }

  get size(): number {
    return this.words.size;
  }
}
