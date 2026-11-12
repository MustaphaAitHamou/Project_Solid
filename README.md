# KABYLE SOLIDE

Site Web de KABYLE SOLIDE (accueil en 3D avec Three.js) et portage Web fidèle du jeu Java
**Mario Ahmed Aberkan** ([MustaphaAitHamou/MarioJava](https://github.com/MustaphaAitHamou/MarioJava)).

- Accueil : `/` — scène Three.js, accès au jeu.
- Jeu : `/jeux/mario-ahmed-aberkan` — rendu 2D d’origine, mêmes images, mêmes sons, même niveau.

Le compte rendu complet (différences avec le Java, vérification des ressources, tests) est dans
[RAPPORT.md](RAPPORT.md).

## Démarrer

Prérequis : Node.js 20.19 ou plus récent (testé avec Node 22).

```bash
npm install
```

```bash
npm run dev
```

Ouvre <http://localhost:5173>. Le jeu est sur <http://localhost:5173/jeux/mario-ahmed-aberkan>.

| Commande                | Rôle                                                                                                 |
| ----------------------- | ---------------------------------------------------------------------------------------------------- |
| `npm install`           | installe les dépendances                                                                             |
| `npm run dev`           | serveur de développement                                                                             |
| `npm run build`         | vérification des types, build de production dans `dist/`, contrôle SHA-256 des ressources originales |
| `npm run preview`       | sert le build de production sur <http://localhost:4173>                                              |
| `npm test`              | tests de fidélité au Java (tour par tour) et tests du moteur                                         |
| `npm run test:e2e`      | tests dans un vrai navigateur (lancer `npx playwright install chromium` une fois avant)              |
| `npm run verify:assets` | compare les ressources servies au manifeste (SHA-256)                                                |
| `npm run check`         | vérification des types TypeScript                                                                    |

## Déployer sur Vercel

Tout est prêt dans `vercel.json` (Vite, sortie `dist/`, URL sans `.html` ni barre oblique finale,
page 404, cache des ressources). Il suffit d’importer le dépôt dans Vercel, ou en ligne de commande :

```bash
npx vercel
```

Cette commande crée un déploiement de prévisualisation. La mise en production se fait ensuite
explicitement, quand vous le décidez :

```bash
npx vercel --prod
```

Aucun serveur Java ni installation n’est nécessaire côté visiteur : le site est entièrement statique.

## Architecture

```
index.html                         accueil
jeux/mario-ahmed-aberkan/index.html page du jeu
404.html                           page introuvable
public/originaux/mario-ahmed-aberkan/
  images/  audio/                  les 28 PNG et 6 WAV d’origine, copiés octet pour octet
src/
  games/mario-ahmed-aberkan/       le jeu (indépendant du site et de Three.js)
    engine/                        portage du moteur Java, TypeScript pur sans DOM
      Scene.ts Personnage.ts Mario.ts ennemis.ts (Champ, Tortue) Objet.ts objets.ts
      (Bloc, TuyauRouge, Piece) affichage.ts (Score, CompteARebours) Clavier.ts
      niveau.ts                    positions du niveau, recopiées du constructeur Java
      Partie.ts                    horloge déterministe qui remplace les threads Java
    platform/                      navigateur : chargement, rendu canvas, audio, clavier, tactile
    config.ts                      cadences mesurées du jeu Java, corrections documentées
    assets/manifeste.json          inventaire des ressources (dimensions, SHA-256)
    JeuMarioAhmedAberkan.ts        composant monté dans la page
  site/
    catalogue.ts                   liste des jeux (source unique de l’accueil)
    fragments/                     en-tête et pied de page partagés (insérés au build)
    pages/                         scripts de chaque page
    styles/                        styles du site (design provisoire)
    three/SceneAccueil.ts          scène 3D de l’accueil
  shared/plein-ecran.ts            plein écran (API + repli iPhone)
tests/
  fidelite/                        scénarios d’entrées + empreintes des traces du jeu Java
  moteur/                          tests des corrections et de l’horloge
  e2e/                             tests navigateur (Playwright) + captures du rendu Java
outils/
  harnais-java/                    exécute le code Java original et produit les références
  fidelite/                        générateur de scénarios, recherche d’un parcours gagnant
scripts/                           manifeste et vérification SHA-256 des ressources
```

Principes :

- **Le moteur reproduit le Java ligne à ligne** (mêmes classes, mêmes noms de méthodes, même ordre
  d’exécution dans `paintComponent()`). Les surcharges Java `contact(Objet)` / `contact(Personnage)`
  deviennent `contactObjet()` / `contactPersonnage()`.
- **Les threads Java** (rafraîchissement 3 ms, ennemis 15 ms, compte à rebours 1 s) sont remplacés
  par une horloge à pas fixe en microsecondes, réglée sur les cadences mesurées du jeu original :
  la vitesse ne dépend pas de la fréquence de l’écran.
- **Le jeu ne dépend pas du site** : il peut être monté dans n’importe quelle page. La page du jeu
  ne charge pas Three.js ; l’accueil le charge en différé.
- **Aucune ressource n’est transformée** : les PNG et WAV sont servis tels quels depuis
  `public/originaux`, décodés dans le navigateur sans conversion de couleur, et vérifiés (SHA-256)
  à chaque build.

### Ajouter un jeu

1. Créer `src/games/<slug>/` (le moteur et son composant).
2. Créer la page `jeux/<slug>/index.html` (copier celle de Mario) et la déclarer dans `PAGES`
   (`vite.config.ts`).
3. Ajouter la fiche dans `src/site/catalogue.ts` : la carte apparaît sur l’accueil.

## Fidélité au jeu Java

`npm test` rejoue 13 scénarios d’entrées clavier (≈179 000 tours, environ 9 minutes de jeu :
marches, sauts, blocs, pièces, ennemis écrasés, morts, victoire, temps écoulé, fin de niveau) et
compare chaque tour aux traces produites par le **code Java original** : état complet, chaque appel
`drawImage`/`drawString` et chaque son doivent être identiques.

Pour régénérer ces références (JDK 11+ requis), à partir d’une copie du dépôt Java :

```bash
node outils/harnais-java/executer.mjs ../MarioJava
```

Le moteur peut aussi tourner exactement comme le Java, bugs compris : `AUCUNE_CORRECTION` dans
`src/games/mario-ahmed-aberkan/config.ts` (voir [RAPPORT.md](RAPPORT.md)).
