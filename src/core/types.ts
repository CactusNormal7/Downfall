/**
 * Types partages du moteur.
 *
 * [NET] Tout ce qui est declare ici doit rester serialisable en JSON : ces
 * structures traverseront le reseau le jour du vrai PvP. Pas de Map, pas de Set,
 * pas de fonction, pas de classe dans un etat de jeu.
 */

/** Identifiant de joueur. Deux joueurs existent des la V0, meme en solo. */
export type PlayerId = 'P0' | 'P1';

/** Contenu d'une cellule : lettre A-Z, glyphe de bruit, joker, ou vide. */
export type Cell = string | null;

/** Grille stockee en ligne-major : grid[row][col], row 0 = haut. */
export type Grid = Cell[][];

/** La lettre actuellement en chute, controlee par le joueur. */
export interface FallingLetter {
  letter: string;
  row: number;
  col: number;
}

/** Etat d'un joueur. Identique pour l'humain et pour l'adversaire. */
export interface PlayerState {
  id: PlayerId;
  grid: Grid;
  falling: FallingLetter | null;
  /** File d'attente visible : QUEUE_SIZE lettres. */
  queue: string[];
  score: number;
  /** Etat du PRNG de ce joueur. Chaque joueur a sa propre seed (brief §5). */
  rngState: number;
  /** Lignes de garbage recues et pas encore inserees dans la grille. */
  pendingGarbage: number;
  /** Tours consecutifs sans aucun mot formable — declencheur du wildcard. */
  drySpell: number;
  wildcardsUsed: number;
  /** Nombre de mots effaces, tous clears confondus. */
  wordsCleared: number;
  /** Meilleure profondeur de chaine atteinte. */
  bestChain: number;
  alive: boolean;
}

/** Etat complet du match. C'est l'objet qu'un serveur autoritaire detiendrait. */
export interface GameState {
  players: Record<PlayerId, PlayerState>;
  /** Numero de tick logique, sert de horloge deterministe. */
  tick: number;
  /** Vainqueur, ou null tant que le match tourne. */
  winner: PlayerId | null;
  status: 'running' | 'over';
}

// --- Actions ----------------------------------------------------------------

/**
 * Les actions sont les seuls points d'entree du moteur.
 *
 * [NET] Ce sont exactement les messages qui partiront en WebSocket. Une action
 * doit donc etre auto-suffisante : elle porte son `player`, jamais un contexte
 * implicite. Le serveur autoritaire rejouera la meme action sur son propre etat.
 */
export type Action =
  | { type: 'MOVE_LEFT'; player: PlayerId }
  | { type: 'MOVE_RIGHT'; player: PlayerId }
  | { type: 'SOFT_DROP'; player: PlayerId }
  | { type: 'HARD_DROP'; player: PlayerId }
  /** Avance la simulation d'un cran (gravite). Emis par la boucle de jeu. */
  | { type: 'TICK'; player: PlayerId }
  /** [NET] Reception de garbage. En vrai PvP, ce message vient du serveur. */
  | { type: 'RECEIVE_GARBAGE'; player: PlayerId; rows: number };

// --- Evenements -------------------------------------------------------------

/**
 * Le moteur ne logge pas et ne dessine pas : il **decrit** ce qui s'est passe.
 * La couche au-dessus logge, anime, joue un son, ou envoie sur le reseau.
 * C'est ce qui rend le moteur testable sans navigateur et rejouable.
 */
export type GameEvent =
  | { type: 'LETTER_SPAWNED'; player: PlayerId; letter: string; queue: string[] }
  | { type: 'LETTER_LOCKED'; player: PlayerId; letter: string; row: number; col: number }
  | {
      type: 'WORD_MATCHED';
      player: PlayerId;
      word: string;
      row: number;
      fromCol: number;
      toCol: number;
      /**
       * Cellules exactes du mot, dans l'ordre de lecture. Necessaire des que le
       * mot n'est plus forcement horizontal : row/fromCol/toCol seuls ne
       * suffisent pas a savoir quelles cases surligner pour une diagonale.
       */
      cells: Array<{ row: number; col: number }>;
      score: number;
      chainDepth: number;
    }
  | {
      type: 'CHAIN_STEP';
      player: PlayerId;
      depth: number;
      multiplier: number;
      /**
       * Grille telle qu'elle est AU MOMENT ou ce maillon est detecte : les mots
       * de ce depth y sont encore visibles (rien n'est efface). C'est la base
       * sur laquelle l'UI surligne les mots avant de les faire disparaitre —
       * sans ca, elle devrait reimplementer sa propre resolution pour savoir
       * a quoi la grille ressemblait juste avant le clear.
       */
      grid: Grid;
    }
  | {
      type: 'BOARD_SETTLED';
      player: PlayerId;
      chainDepth: number;
      /**
       * Grille apres effacement des mots de ce depth, effets appliques et
       * gravite retombee. Pendant du "avant" fourni par CHAIN_STEP.grid :
       * ensemble, les deux bornent exactement ce qu'un joueur doit voir pour
       * comprendre "ces lettres ont forme ce mot, puis ont disparu".
       */
      grid: Grid;
    }
  /** [NET] A brancher sur un envoi WS `GARBAGE_SEND` vers le serveur. */
  | { type: 'GARBAGE_SENT'; from: PlayerId; to: PlayerId; rows: number; word: string }
  | { type: 'GARBAGE_APPLIED'; player: PlayerId; rows: number }
  | { type: 'WILDCARD_GRANTED'; player: PlayerId; drySpell: number }
  | { type: 'EFFECT_TRIGGERED'; player: PlayerId; word: string; effect: string; cellsDestroyed: number }
  | { type: 'TOPOUT'; player: PlayerId }
  | { type: 'GAME_OVER'; winner: PlayerId | null };

/** Resultat d'une transition. Le moteur est pur : il rend un nouvel etat. */
export interface StepResult {
  state: GameState;
  events: GameEvent[];
}
