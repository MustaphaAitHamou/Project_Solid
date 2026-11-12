# Harnais de référence Java

Exécute le **code Java original** du jeu sur les scénarios de `tests/fidelite/scenarios` et écrit :

- `tests/fidelite/references/<scénario>.empreintes` : empreintes SHA-256 de la trace, par blocs de 100 tours ;
- `tests/fidelite/references/essai.txt.br` : une trace complète (diagnostic détaillé) ;
- `tests/e2e/references/<scénario>-<tour>.png` : captures du rendu Java (lignes `capture` des scénarios).

```bash
node outils/harnais-java/executer.mjs ../MarioJava
```

Prérequis : JDK 11 ou plus récent (`javac` et `java` dans le PATH). Le dépôt Java n’est jamais
modifié : ses sources sont copiées dans un dossier temporaire, où seules deux choses changent :

1. les `Thread.start()` de `Scene` (Chrono), `CompteARebours`, `Champ` et `Tortue` sont retirés :
   `harnais/Harnais.java` exécute ces boucles lui-même, aux cadences mesurées du jeu réel
   (3160 µs, 20120 puis 15120 µs, 1000150 µs) ;
2. `Audio.playSound()` ajoute le son à un journal au lieu de le jouer.

`harnais/GraphiqueJournal.java` (généré par `Generateur.java`) enregistre chaque `drawImage` et
`drawString` de `paintComponent()`. Chaque tour produit une ligne canonique, identique au format
de `tests/fidelite/trace.ts` : état de la scène, de Mario, des ennemis et des pièces, score, temps,
sons, appels de dessin et textes.
