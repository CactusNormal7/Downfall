# CLAUDE.md — Lexa

Guide de travail pour Claude Code sur ce dépôt. À lire avant toute modification.

## 1. Le projet en une phrase

**Lexa** est un jeu de chute de lettres en ASCII où former des mots français fait
disparaître des blocs et envoie du « bruit » (garbage) dans la grille adverse.
Puyo Puyo Tetris croisé avec du vocabulaire.

Langue du jeu : **français**. Langue du code (identifiants, commentaires) : **anglais**.
Langue des textes affichés au joueur et de la communication avec l'utilisateur : **français**.

## 2. État actuel et périmètre

Phase courante : **V0 solo**, pas de réseau.

Ce qui doit exister à la fin de la V0 :

- Boucle de chute d'une lettre dans une grille 8 × 14.
- File d'attente de 3 lettres suivantes visible.
- Détection et suppression des mots **horizontaux** de 3 lettres minimum.
- Gravité + chaînes (un clear peut en déclencher un autre) avec multiplicateur.
- Scoring non linéaire.
- Défaite par topping out.
- Amorces (« brides ») de fonctionnalités avancées : garbage, mots à effet, wildcard.

Hors périmètre V0 (ne pas implémenter sans demande explicite) :
serveur réel, WebSocket, comptes, matchmaking, persistance, mots verticaux, diagonales.

## 3. Règle centrale : le multijoueur est *simulé*, pas absent

C'est la contrainte d'architecture la plus importante du dépôt.

Le code doit être **écrit comme si le multijoueur existait** :

- Le moteur de jeu est **pur et déterministe** : `(state, action) -> newState`.
  Aucun accès au DOM, à `Date.now()`, à `Math.random()` non seedé, ni au rendu
  depuis le moteur. Le RNG est un générateur seedé passé dans l'état.
- Toute interaction joue par **actions/événements sérialisables** (objets JSON
  plats), jamais par appel direct de méthode entre systèmes. Ce sont les mêmes
  objets qui transiteront sur le réseau plus tard.
- Il existe **deux joueurs** dans le modèle de données dès la V0 : `players[0]`
  (humain) et `players[1]` (adversaire fictif / bot passif). Le garbage part
  réellement vers l'adversaire, il est juste routé localement.
- La couche transport est derrière une **interface** (`Transport`) dont
  l'implémentation V0 est locale/en mémoire. Le jour du vrai réseau, on écrit une
  seconde implémentation, on ne réécrit pas le jeu.

Aux endroits où le réseau réel devrait s'insérer, on ne laisse **pas** de code mort :
on laisse un commentaire marqueur **et** un log traçable.

### Convention de marquage

```js
// [NET] Ici partira un message WS vers le serveur autoritaire.
// Contrat attendu : { type: 'GARBAGE_SEND', from, to, rows, seed }
netLog('GARBAGE_SEND', { from, to, rows });
```

- Tag `[NET]` dans le commentaire : point d'insertion réseau futur.
- Tag `[V2]` : fonctionnalité repoussée volontairement (verticales, purge de garbage…).
- Tag `[BALANCE]` : constante à recalibrer en playtest, jamais une valeur « définitive ».

### Convention de logs

Un module de log unique, catégorisé, activable par catégorie. Chaque log est
« catchable » : préfixe fixe, en majuscules, greppable.

```
[LEXA][NET]    GARBAGE_SEND   from=P0 to=P1 rows=2 word=CHAT score=180
[LEXA][WORD]   MATCH          word=CHAT row=9 cols=2-5 len=4
[LEXA][CHAIN]  STEP           depth=2 multiplier=1.5
[LEXA][SPAWN]  LETTER         letter=E queue=[A,S,T] seed=8827311
[LEXA][EFFECT] TRIGGER        word=BOOM effect=explosion radius=1
[LEXA][STATE]  TOPOUT         player=P0 tick=1432
```

Règles : une ligne = un événement, catégorie entre crochets, puis un verbe en
majuscules, puis des paires `clé=valeur`. Pas de phrases. Ça doit se grepper
(`grep '\[NET\]'`) et se rejouer.

Le moteur ne logge pas directement : il **émet des événements**, et la couche
au-dessus les logge. Ainsi les logs sont gratuits en test et rejouables.

## 4. Architecture cible

```
src/
  core/          # moteur pur, zéro I/O, zéro DOM — testable en isolation
    rng.js       # PRNG seedé (mulberry32 / xorshift), reproductible
    bag.js       # distribution des lettres pondérée Scrabble FR
    grid.js      # grille, gravité, insertion, topping out
    words.js     # détection de mots sur la grille (horizontal V0)
    scoring.js   # scoring non linéaire + chaînes
    effects.js   # mots à effet (BOOM, GEL…)
    engine.js    # reduce(state, action) -> { state, events[] }
  dict/          # dictionnaire FR + structure de lookup (trie / Set)
  net/
    transport.js # interface Transport
    local.js     # implémentation V0 : boucle locale, latence simulable
  ui/            # rendu ASCII + entrées clavier — la seule couche « sale »
  main.js
tests/
```

Dépendance à sens unique : `ui -> engine -> core`. Jamais l'inverse.
`core` ne connaît ni `ui` ni `net`.

## 5. Règles de gameplay à respecter (source de vérité)

- Grille : **8 colonnes × 14 lignes**.
- File d'attente : **3 lettres** visibles.
- Mot valide : **≥ 3 lettres**, horizontal uniquement en V0. `[V2]` vertical.
  Diagonales : jamais prévues.
- Scoring (base X, `[BALANCE]`) : 3 lettres = X · 1 ; 4 = X · 2,5 ; 5 = X · 5 ;
  6+ = X · 9. Courbe volontairement agressive pour tuer le spam de mots courts —
  c'est le **risque de design n° 1**, ne pas l'adoucir sans playtest.
- Chaînes : multiplicateur cumulatif par clear consécutif dans la même chute.
- Garbage : lettres-bruit rendues en symboles non alphabétiques `¤ § ¬ ‡`, elles
  ne participent à aucun mot. Nombre de lignes proportionnel au score du mot.
- Wildcard `?` : filet de sécurité si aucun mot n'est formable depuis N tours.
  `[BALANCE]` sur N et sur le coût.
- Accents : **normalisés** (é → E) pour la grille et le lookup. Décision par
  défaut, révisable ; si elle change, elle change dans `dict/` uniquement.
- Mots à effet : certains mots déclenchent une action liée à leur sens
  (`BOOM` → explosion locale). Table de données, pas de `if` en dur dans le moteur.

## 6. Conventions de code

- Constantes de gameplay **centralisées** dans un seul fichier de config, jamais
  en dur dans la logique. Un playtest = éditer un fichier.
- Pas de valeur magique non nommée dans `core/`.
- Fonctions pures par défaut ; mutation locale autorisée si elle reste contenue
  dans une fonction et documentée.
- Nommage : `camelCase` pour les variables et fonctions, `SCREAMING_SNAKE` pour
  les constantes, `PascalCase` pour les types/classes.
- Commentaires : expliquer le **pourquoi**, jamais le quoi. Densité faible sauf
  sur les marqueurs `[NET]` / `[V2]` / `[BALANCE]` qui, eux, sont obligatoires.

## 7. Tests

- `core/` doit être testable sans navigateur. Toute règle de gameplay
  (détection de mot, scoring, chaîne, gravité, topout) a un test.
- Les tests utilisent des grilles écrites en **ASCII littéral** dans le fichier de
  test — la grille est lisible à l'œil, c'est tout l'intérêt du parti pris ASCII.
- Déterminisme : même seed + même suite d'actions = même état final. C'est un test.

## 8. Git

- Branche de travail : `claude/lexa-word-tetris-game-j0oo0h`.
- Commits en français, impératif, une intention par commit.
- Ne jamais pousser sur une autre branche sans accord explicite.
- Pas de pull request sans demande explicite de l'utilisateur.

## 9. Décisions ouvertes (ne pas trancher seul)

- Verticales en V2 : oui/non définitif.
- Wildcard : nombre d'usages par partie et coût.
- Mode sprint (limite de temps) en plus du mode survie.
- Stack technique : **à choisir avec l'utilisateur** — voir la proposition en cours.

## 10. Ce qu'il ne faut pas faire

- Ne pas implémenter de vrai réseau tant que la V0 solo n'est pas jugée fun.
- Ne pas faire de recherche linéaire dans le dictionnaire (trie ou Set, point).
- Ne pas coupler le moteur au rendu, même « juste pour tester ».
- Ne pas lisser la courbe de score pour « rendre le jeu plus gentil » sans playtest.
- Ne pas supprimer un marqueur `[NET]` en implémentant autre chose à côté.
