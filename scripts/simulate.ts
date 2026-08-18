/**
 * Banc de calibration.
 *
 * Le brief (§8) identifie l'equilibrage comme le risque principal du concept et
 * exige "un vrai travail statistique, pas une estimation a l'oeil". Ce script
 * est cet outil : il fait jouer le bot contre lui-meme sur N parties et sort
 * les metriques qui pilotent les constantes [BALANCE] de src/config.ts.
 *
 *   npm run simulate            # metriques de partie
 *   npm run simulate calibrate  # distribution des plateaux morts
 *   npm run simulate 100        # sur 100 parties
 *
 * Attention a l'interpretation : le bot est glouton a un coup, il ne construit
 * jamais de mot long a l'avance. Ses chiffres sont donc un PLANCHER, pas une
 * prediction du jeu humain. Ils servent a detecter les degenerescences
 * (spam rentable, garbage qui ne circule jamais), pas a fixer la difficulte.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { createGame, step } from '../src/core/engine.js';
import type { GameState, PlayerId } from '../src/core/types.js';
import { Dictionary } from '../src/dict/dictionary.js';
import { chooseBotAction } from '../src/ai/bot.js';
import { hasPlayableWord } from '../src/core/words.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const dictionary = Dictionary.fromText(
  readFileSync(resolve(HERE, '../src/dict/words-fr.txt'), 'utf8'),
);

const PLAYERS: readonly PlayerId[] = ['P0', 'P1'];
const MAX_TICKS = 6000;

const args = process.argv.slice(2);
const mode = args.find((arg) => Number.isNaN(Number(arg))) ?? 'match';
const games = Number(args.find((arg) => !Number.isNaN(Number(arg)))) || 30;

function percentile(sorted: number[], quantile: number): number {
  return sorted[Math.floor(sorted.length * quantile)] ?? 0;
}

/** Metriques de partie : longueurs de mots, garbage, chaines, jokers. */
function runMatchStats(): void {
  const lengths = new Map<number, number>();
  let words = 0;
  let garbage = 0;
  let chains = 0;
  let maxChain = 1;
  let effects = 0;
  let wildcards = 0;
  let ticks = 0;

  for (let seed = 1; seed <= games; seed += 1) {
    let state: GameState = createGame(seed * 7919, seed * 104729);
    let gameTicks = 0;

    while (state.status === 'running' && gameTicks < MAX_TICKS) {
      for (const player of PLAYERS) {
        const result = step(state, chooseBotAction(state, player, dictionary), dictionary);
        state = result.state;
        for (const event of result.events) {
          if (event.type === 'WORD_MATCHED') {
            words += 1;
            lengths.set(event.word.length, (lengths.get(event.word.length) ?? 0) + 1);
          }
          if (event.type === 'GARBAGE_SENT') garbage += event.rows;
          if (event.type === 'CHAIN_STEP' && event.depth > 1) {
            chains += 1;
            maxChain = Math.max(maxChain, event.depth);
          }
          if (event.type === 'EFFECT_TRIGGERED') effects += 1;
          if (event.type === 'WILDCARD_GRANTED') wildcards += 1;
        }
      }
      gameTicks += 1;
    }
    ticks += gameTicks;
  }

  const distribution = [...lengths.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([length, count]) => `${length}L:${count} (${((100 * count) / words).toFixed(1)}%)`)
    .join('  ');

  console.log(`[LEXA][SIM] MATCHES       games=${games} ticksAvg=${Math.round(ticks / games)}`);
  console.log(`[LEXA][SIM] WORDS         total=${words} perGame=${(words / games).toFixed(1)}`);
  console.log(`[LEXA][SIM] LENGTHS       ${distribution}`);
  console.log(`[LEXA][SIM] GARBAGE       rows=${garbage} perGame=${(garbage / games).toFixed(1)}`);
  console.log(`[LEXA][SIM] CHAINS        above1=${chains} maxDepth=${maxChain}`);
  console.log(`[LEXA][SIM] EFFECTS       triggered=${effects}`);
  console.log(`[LEXA][SIM] WILDCARDS     granted=${wildcards} perGame=${(wildcards / games).toFixed(2)}`);
}

/**
 * Distribution des plateaux morts : combien de tours d'affilee le joueur passe
 * sans pouvoir completer un mot. C'est ce qui fixe WILDCARD_DRY_SPELL_TURNS.
 */
function runCalibration(): void {
  const runs: number[] = [];
  let placements = 0;
  let playable = 0;

  for (let seed = 1; seed <= games; seed += 1) {
    let state: GameState = createGame(seed * 7919, seed * 104729);
    let dryRun = 0;
    let ticks = 0;
    let lastLetter: string | null = null;

    while (state.status === 'running' && ticks < MAX_TICKS) {
      const falling = state.players.P0.falling;
      if (falling && falling.letter !== lastLetter) {
        lastLetter = falling.letter;
        placements += 1;
        if (hasPlayableWord(state.players.P0.grid, falling.letter, dictionary)) {
          playable += 1;
          if (dryRun > 0) runs.push(dryRun);
          dryRun = 0;
        } else {
          dryRun += 1;
        }
      }
      for (const player of PLAYERS) {
        state = step(state, chooseBotAction(state, player, dictionary), dictionary).state;
      }
      ticks += 1;
    }
    if (dryRun > 0) runs.push(dryRun);
  }

  runs.sort((a, b) => a - b);
  const mean = runs.reduce((sum, value) => sum + value, 0) / runs.length;

  console.log(
    `[LEXA][SIM] PLACEMENTS    total=${placements} playable=${playable} ratio=${((100 * playable) / placements).toFixed(1)}%`,
  );
  console.log(
    `[LEXA][SIM] DRYSPELL      runs=${runs.length} mean=${mean.toFixed(1)} max=${runs[runs.length - 1]}`,
  );
  console.log(
    `[LEXA][SIM] PERCENTILES   p50=${percentile(runs, 0.5)} p75=${percentile(runs, 0.75)} p90=${percentile(runs, 0.9)} p95=${percentile(runs, 0.95)} p99=${percentile(runs, 0.99)}`,
  );
  console.log(
    `[LEXA][SIM] HINT          WILDCARD_DRY_SPELL_TURNS devrait etre proche de p95 (${percentile(runs, 0.95)})`,
  );
}

if (mode === 'calibrate') runCalibration();
else runMatchStats();
