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

## 1. Ce qui marche

- Grille 8 × 14, file d'attente de 3 lettres, chute et verrouillage.
- Détection de mots **horizontaux** ≥ 3 lettres contre 85 567 mots français.
- Gravité + **chaînes** : un clear peut en déclencher un autre, avec multiplicateur.
- Scoring non linéaire (§4).
- **Garbage** : les mots longs envoient des lignes de bruit chez l'adversaire.
- **Adversaire simulé** qui joue vraiment, marque, et reçoit le garbage.
- **Joker `?`** distribué en secours quand le joueur est en panne de mot.
- **Mots à effet** : `BOOM` et `BOMBE` explosent, `FORER` perce une colonne,
  `ORAGE` envoie du bruit en bonus.
- Topping out et condition de victoire.

Hors périmètre V0 : mots verticaux, diagonales, vrai réseau, comptes, persistance.

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

| Longueur | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|
| Multiplicateur | ×1 | ×2,5 | ×6 | ×14 | ×30 | ×65 |

### Le joker a été recalibré sur mesure

Mesure sur 3 141 poses simulées : seulement **8,5 %** des poses permettent de
compléter un mot immédiatement, et la série sèche médiane dure **9 tours**. Le
seuil initial de 12 tours déclenchait donc le joker sur ~25 % des séries : les
3 jokers étaient consommés dans *chaque* partie. Recalé sur le p95 (**30**), on
tombe à 1,7 joker par partie.

### Ce que la simulation ne prouve pas

Le bot est glouton à un coup : il ne construit jamais un mot long à l'avance.
Ses chiffres (89 % de mots de 3 lettres, 0,2 ligne de garbage par partie,
aucune chaîne) sont un **plancher**, pas une prédiction du jeu humain.

Ce qu'ils disent quand même : sans planification, on ne produit que des mots de
3 lettres. La courbe compense correctement en score **par pose** — un mot de 6
lettres rapporte ~233 pts par lettre posée contre ~33 pour un mot de 3, soit 7×
— mais **seul un playtest humain dira si le joueur a le temps de planifier**
sous pression de chute. C'est la question ouverte n°1.

## 5. Décisions prises (et pourquoi)

- **Accents normalisés** (é → E). En ASCII monospace, le joueur ne peut pas
  distinguer un E d'un É dans la grille ; et il faudrait 6 glyphes de plus dans
  le sac. Réversible : la décision vit dans `src/dict/normalize.ts` seul.
- **Mot le plus long, sans chevauchement.** Sinon `CHATS` rapporterait aussi
  `CHAT` et `HAT`, ce qui contournerait toute la courbe anti-spam.
- **Le garbage coupe les mots.** Les glyphes `¤ § ¬ ‡` interrompent un segment :
  c'est tout leur pouvoir de nuisance.
- **Seeds distinctes par joueur** (brief §5), pas de seed partagée.
- **Set plutôt que trie.** Le Set natif *est* un hashset, O(1), zéro code. Le
  trie ne servira qu'au jour où il faudra répondre « existe-t-il un mot
  commençant par… » (aide au joueur, IA). Volontairement absent plutôt que faux.

## 6. Questions ouvertes

- Le joueur a-t-il le temps de planifier un mot long sous pression ? (§4)
- Les chaînes sont-elles atteignables volontairement, ou seulement par chance ?
  Le bot n'en a jamais produit une seule.
- Verticales en V2 : oui ou non définitivement ?
- Coût et nombre de jokers par partie.
- Mode sprint (limite de temps) en plus du mode survie.

## 7. Suite

1. Playtest humain de la V0 pour trancher §6.
2. Élargir la table des mots à effet une fois le feel validé.
3. V1 PvP : `WebSocketTransport` + serveur autoritaire réutilisant `core/`.

## Licence des données

Dictionnaire dérivé de [`an-array-of-french-words`](https://www.npmjs.com/package/an-array-of-french-words)
(MIT), lui-même issu de Dicollecte. L'ODS n'est pas utilisé : il est propriétaire
et non redistribuable.
