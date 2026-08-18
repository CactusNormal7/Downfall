# Lexa

Jeu de chute de lettres en ASCII : formez des mots français horizontaux, les
mots longs punissent l'adversaire. Puyo Puyo Tetris croisé avec du vocabulaire.

**État : V0 solo.** Le multijoueur est *simulé*, pas absent — voir §3.

## Démarrer

```bash
npm install
npm run dict:build   # génère src/dict/words-fr.txt (déjà commité)
npm run dev          # http://localhost:5173
npm test             # 37 tests
npm run typecheck
npm run simulate     # banc de calibration (voir §4)
```

Commandes en jeu : `←` `→` déplacer, `↓` descente rapide, `Espace` pose
immédiate, `Entrée` rejouer.

> **Attention équilibrage.** Les mots de 2 lettres et les 8 directions sont
> activés à la demande. Ils changent profondément la nature du jeu — mesures et
> conséquences en §4. Tout se désactive dans `src/config.ts`
> (`MIN_WORD_LENGTH`, `WORD_DIRECTIONS`).

## 1. Ce qui marche

- Grille **12 × 18**, file d'attente de 3 lettres, chute et verrouillage.
- Détection de mots **≥ 2 lettres dans les 8 sens de lecture** — horizontal,
  vertical, les 4 diagonales, et chacun à l'envers — contre 318 252 mots français.
- Gravité + **chaînes** : un clear peut en déclencher un autre, avec multiplicateur.
- Scoring non linéaire (§4).
- **Garbage** : les mots longs envoient des lignes de bruit chez l'adversaire.
- **Adversaire simulé** qui joue vraiment, marque, et reçoit le garbage.
- **Joker `?`** distribué en secours quand le joueur est en panne de mot.
- **Mots à effet** : `BOOM` et `BOMBE` explosent, `FORER` perce une colonne,
  `ORAGE` envoie du bruit en bonus.
- Topping out et condition de victoire.

Hors périmètre V0 : vrai réseau, comptes, persistance.

## 2. Architecture

```
src/core/   moteur pur et déterministe — zéro DOM, zéro I/O, zéro log
src/dict/   dictionnaire (Set) + normalisation des accents
src/net/    interface Transport + implémentation locale
src/ai/     adversaire simulé
src/ui/     rendu DOM ASCII, entrées clavier, logs
```

Dépendance à sens unique : `ui → engine → core`. Le moteur ne connaît ni l'UI
ni le réseau. Il expose une seule fonction :

```ts
step(state, action, dictionary) -> { state, events }
```

Le moteur ne logge pas et ne dessine pas : il **décrit** ce qui s'est passé via
des événements. La couche au-dessus les logge, les anime, ou les envoie sur le
réseau. C'est ce qui rend le moteur testable sans navigateur et rejouable.

## 3. Le multijoueur est simulé, pas absent

C'est la contrainte structurante du dépôt. Le code est écrit **comme si** le
réseau existait :

| Décision | Pourquoi maintenant et pas plus tard |
|---|---|
| Moteur pur et déterministe (PRNG seedé dans l'état) | Un serveur autoritaire doit pouvoir rejouer la partie d'un client depuis `(seed, actions)` et retomber sur le même état. |
| Actions et événements en JSON plat | Ce sont littéralement les messages qui passeront sur le socket. |
| Deux joueurs dans le modèle dès la V0 | Le garbage part **réellement** vers `P1` ; il est juste routé localement. |
| `LocalTransport` derrière l'interface `Transport` | Il sérialise chaque message (`JSON.stringify`) et sait simuler une latence. Si une action cesse d'être sérialisable, ça casse **tout de suite**, pas le jour du branchement. |
| `src/net/protocol.ts` écrit avant d'avoir un serveur | Déclarer le protocole en premier empêche de bricoler des raccourcis locaux qu'il faudrait défaire. |

Les points d'insertion réseau sont marqués et **traçables**, jamais silencieux :

- `[NET]` en commentaire = ici partira un vrai message.
- `[V2]` = fonctionnalité repoussée volontairement.
- `[BALANCE]` = constante à recalibrer en playtest.

```bash
grep -rn '\[NET\]' src/   # tous les points de branchement réseau
```

### Logs

Format imposé : `[LEXA][CATÉGORIE] VERBE clé=valeur`. Une ligne = un événement,
greppable, rejouable.

```
[LEXA][DICT] LOADED         words=85567
[LEXA][NET] SEND           type=JOIN bytes=59 latency=0
[LEXA][NET] GARBAGE_SEND   from=P0 to=P1 rows=2 word=MAISON
[LEXA][WORD] MATCH          player=P0 word=CHAT len=4 row=9 cols=2-5 score=250 chain=1
[LEXA][CHAIN] STEP           player=P0 depth=2 multiplier=1.5
[LEXA][STATE] TOPOUT         player=P0
```

Catégories activables une par une dans `src/ui/log.ts` (`SPAWN` et `INPUT` sont
coupées par défaut : trop bavardes).

Pour brancher le vrai réseau : écrire `WebSocketTransport` implémentant
`Transport`, le substituer dans `src/main.ts`, et remplacer le bloc bot par les
actions reçues du serveur. Le moteur ne bouge pas.

## 4. Équilibrage : ce que les mesures disent

Le brief identifie l'équilibrage comme le risque n°1 et exige « un vrai travail
statistique, pas une estimation à l'œil ». D'où `npm run simulate`.

### La courbe de score a été corrigée

La courbe proposée (3L=×1, 4L=×2,5, 5L=×5, 6+=×9) contenait un **point
dégénéré** : `2 × 2,5 = 5`, donc deux mots de 4 lettres valaient *exactement*
un mot de 5. À parité de score, le joueur prend toujours le coup le plus
facile — le spam redevenait optimal à cet endroit précis.

Invariant retenu, verrouillé par un test : **`2 × m(n) < m(n+1)`**. Deux mots de
n lettres doivent toujours rapporter strictement moins qu'un seul mot de n+1.

| Longueur | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10+ |
|---|---|---|---|---|---|---|---|---|---|
| Multiplicateur | ×0,4 | ×1 | ×2,5 | ×6 | ×16 | ×39 | ×98 | ×244 | ×610 |

Le multiplicateur plafonne à 10 lettres : aligner 11 cellules exactes relève de
l'accident, l'anti-spam n'a plus d'objet, et une exponentielle non bornée
produirait des scores illisibles.

### Ce que les mots de 2 lettres et les 8 directions ont changé

Ces deux règles ont été activées à la demande. Voici ce qu'elles font, mesuré
sur 12 parties bot contre bot :

| | Avant (3 lettres, horizontal) | Après (2 lettres, 8 sens) |
|---|---|---|
| Durée d'une partie | ~390 ticks | **~8 800 ticks** (23×) |
| Mots par partie | 20 | **1 876** |
| Part de mots de 2 lettres | — | **74,5 %** |
| Part de mots ≥ 5 lettres | 1,0 % | **0,03 %** |
| Garbage envoyé par partie | 0,2 ligne | **0,4 ligne** |
| Chaîne maximale observée | 1 | 2 |
| Jokers distribués par partie | 1,67 | **0** |

Le chiffre qui explique tout : **37,8 % de deux lettres tirées au hasard forment
un mot français de 2 lettres** (67 mots de 2 lettres, testés dans les deux sens).
Multiplié par 4 axes de lecture, une lettre posée à côté d'une autre a une
probabilité très élevée de faire disparaître quelque chose immédiatement.

Conséquences concrètes :

1. **La grille ne monte quasiment plus.** On efface presque aussi vite qu'on
   pose. Les parties se terminent — vérifié, elles ne sont pas infinies — mais
   il leur faut 23× plus longtemps.
2. **La boucle PvP est en sommeil.** Le garbage se déclenche sur le score d'un
   clear ; or les clears sont devenus minuscules (un mot de 2 lettres = 40 pts,
   très en dessous du seuil de 600). Résultat : 0,4 ligne envoyée par partie.
   C'est la conséquence la plus gênante, parce que le garbage est le seul lien
   entre les deux joueurs.
3. **Le filet anti-plateau-mort est mort de sa belle mort.** Le joueur n'est
   plus jamais en panne de mot, donc le joker n'est plus jamais distribué.
4. **Les mots longs ont disparu.** Ils ne rapportent plus rien *en pratique* :
   la courbe les récompense toujours, mais un joueur glouton n'en construit
   jamais, puisque tout se nettoie sous ses pieds avant qu'il ait le temps.

### Les leviers, si l'on veut retrouver de la pression

Aucun n'est appliqué : la configuration livrée est exactement celle demandée.
Tout se règle dans `src/config.ts`.

- **Accumuler le garbage au lieu de le seuiller par clear.** C'est le correctif
  le plus ciblé : avec beaucoup de petits clears, un seuil par clear rend
  toujours 0. Un compteur de score qui déborde en lignes ferait circuler le
  garbage sans toucher aux règles de mots. *(Changement de logique, pas de
  constante — à valider avant de l'écrire.)*
- **Accélérer la chute** (`FALL_INTERVAL_MS`) pour reposer la pression sur la
  vitesse plutôt que sur le remplissage.
- **Restreindre les 2 lettres** : `MIN_WORD_LENGTH = 3` restaure le
  comportement précédent en une ligne.
- **Réduire les axes** : retirer des entrées de `WORD_DIRECTIONS`.

### Ce que la simulation ne prouve pas

Le bot est glouton à un coup : il ne construit jamais un mot long à l'avance, et
il prend systématiquement le clear immédiat. Un humain peut délibérément ignorer
un mot de 2 lettres pour construire plus grand — la courbe l'y encourage
fortement. Les chiffres ci-dessus sont donc le **comportement le plus dégénéré
possible**, pas une prédiction du jeu humain. Ils disent où est le risque, pas
ce que sera la partie.

### Performance

Le scan sur 4 axes coûte **5 ms sur une grille 12 × 18 pleine**, soit 30 % d'une
frame à 60 fps — mais il ne tourne qu'au verrouillage d'une lettre, pas à chaque
frame. `findWordsThrough` (0,19 ms), utilisé par le bot et le détecteur de
plateau mort, est 27× plus rapide parce qu'il ne regarde que les mots passant
par la cellule posée.

Si le scan complet devient un problème (chaîne profonde = plusieurs scans
d'affilée), c'est là que le **trie** évoqué dans `src/dict/dictionary.ts`
gagnerait enfin sa place : il permettrait d'abandonner un segment dès qu'aucun
mot ne commence par son préfixe, au lieu d'énumérer tous les sous-segments.

## 5. Décisions prises (et pourquoi)

- **Accents normalisés** (é → E). En ASCII monospace, le joueur ne peut pas
  distinguer un E d'un É dans la grille ; et il faudrait 6 glyphes de plus dans
  le sac. Réversible : la décision vit dans `src/dict/normalize.ts` seul.
- **Mot le plus long, sans chevauchement, arbitré globalement.** Sinon `CHATS`
  rapporterait aussi `CHAT` et `HAT` ; et depuis les diagonales, une même
  cellule appartient à 4 axes, donc un placement unique pourrait être facturé
  une dizaine de fois. C'est ce qui rendrait la courbe anti-spam contournable.
- **4 vecteurs scannés, chacun testé à l'envers**, plutôt que 8 vecteurs. Les
  deux approches couvrent les mêmes 8 sens de lecture, mais scanner 8 vecteurs
  examinerait deux fois exactement les mêmes groupes de cellules.
- **Symboles d'unités écartés du dictionnaire.** Dicollecte liste `CM`, `KG`,
  `PH`… comme entrées de 2 lettres. Ce ne sont pas des mots : la liste de rejet
  est explicite dans `scripts/build-dict.ts`, courte et vérifiable à l'œil.
- **Le garbage coupe les mots.** Les glyphes `¤ § ¬ ‡` interrompent un segment :
  c'est tout leur pouvoir de nuisance.
- **Seeds distinctes par joueur** (brief §5), pas de seed partagée.
- **Set plutôt que trie.** Le Set natif *est* un hashset, O(1), zéro code. Le
  trie ne servira qu'au jour où il faudra répondre « existe-t-il un mot
  commençant par… » (aide au joueur, IA). Volontairement absent plutôt que faux.

## 6. Questions ouvertes

- **Faut-il rendre la pression au jeu ?** C'est la question n°1 : la grille ne
  monte quasiment plus et le garbage ne circule plus (§4). Le mode sprint
  (limite de temps) devient un candidat sérieux, puisque la survie ne suffit
  plus à conclure une partie.
- Le joueur a-t-il le temps de planifier un mot long, ou le nettoyage permanent
  l'en empêche-t-il ?
- Le joker n'est plus jamais distribué : le supprimer, ou changer son
  déclencheur ?
- Coût et nombre de jokers par partie, si on le garde.

## 7. Suite

1. Playtest humain de la V0 pour trancher §6.
2. Élargir la table des mots à effet une fois le feel validé.
3. V1 PvP : `WebSocketTransport` + serveur autoritaire réutilisant `core/`.

## Licence des données

Dictionnaire dérivé de [`an-array-of-french-words`](https://www.npmjs.com/package/an-array-of-french-words)
(MIT), lui-même issu de Dicollecte. 318 252 mots de 2 à 18 lettres, 3,4 Mo
(730 Ko gzippés) — le chargement asynchrone du dictionnaire est le prochain
chantier de perf si le temps de démarrage devient gênant. L'ODS n'est pas utilisé : il est propriétaire
et non redistribuable.
