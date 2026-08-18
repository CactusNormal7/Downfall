/**
 * Adversaire simule.
 *
 * Ce n'est PAS un placeholder vide : il joue reellement, gagne du score et
 * envoie du garbage. C'est ce qui permet de tester toute la plomberie PvP
 * (routage du garbage, conditions de victoire, affichage de la grille adverse)
 * sans une seule ligne de reseau.
 *
 * [NET] Le jour du vrai PvP, ce module est remplace par les actions recues du
 * serveur pour le joueur distant. La signature ne change pas : dans les deux
 * cas, on produit une `Action` a appliquer a `players.P1`.
 */
import type { Action, GameState, PlayerId } from '../core/types.js';
import { dropRow, setCell } from '../core/grid.js';
import { findWordsThrough } from '../core/words.js';
import { scoreWord } from '../core/scoring.js';
import type { Dictionary } from '../dict/dictionary.js';

/**
 * Strategie gloutonne a un coup : on simule la pose dans chaque colonne et on
 * garde le meilleur score immediat. A defaut de mot, on empile a plat pour
 * garder la grille basse. Suffisant pour un sparring-partner, deliberement
 * pas plus : le vrai equilibrage se fera contre des humains.
 */
export function chooseBotAction(
  state: GameState,
  botId: PlayerId,
  dictionary: Dictionary,
): Action {
  const bot = state.players[botId];
  if (!bot.falling) return { type: 'TICK', player: botId };

  const cols = bot.grid[0]?.length ?? 0;
  let bestCol = bot.falling.col;
  let bestScore = -Infinity;

  for (let col = 0; col < cols; col += 1) {
    const landing = dropRow(bot.grid, col);
    if (landing < 0) continue;

    const probe = setCell(bot.grid, landing, col, bot.falling.letter);
    // Seuls les mots traversant la case posee peuvent avoir change : un scan
    // complet par colonne coutait ~20k lookups pour rien sur une grille 12x18.
    const matches = findWordsThrough(probe, landing, col, dictionary);
    const wordScore = matches.reduce((sum, match) => sum + scoreWord(match.word, 1), 0);

    // A score egal, on prefere la colonne la plus basse : garder la grille plate
    // repousse le topping out, exactement comme un humain le ferait.
    const value = wordScore * 1000 + landing;
    if (value > bestScore) {
      bestScore = value;
      bestCol = col;
    }
  }

  if (bestCol < bot.falling.col) return { type: 'MOVE_LEFT', player: botId };
  if (bestCol > bot.falling.col) return { type: 'MOVE_RIGHT', player: botId };
  return { type: 'HARD_DROP', player: botId };
}
