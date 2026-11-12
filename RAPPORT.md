# Compte rendu — KABYLE SOLIDE et « Mario Ahmed Aberkan »

Version 0.2.0 — novembre 2026. Jeu d’origine :
[MustaphaAitHamou/Project_Dhmed](https://github.com/MustaphaAitHamou/Project_Dhmed) (« Super Ahmed
Averkan Bros », commit `ebbd8da`).

## 1. Résumé

- Le jeu intégré est désormais celui de **Project_Dhmed**. La version précédente, tirée d’un autre
  dépôt Java (MarioJava), a été entièrement retirée (code, références de test et ressources).
- La page du jeu propose **deux versions**, au choix (le choix est mémorisé) :
  - **Moderne** (par défaut) : plus fluide, plus moderne, plus « jouissif » — simulation à 120 Hz
    affichée à la fréquence de l’écran, inertie, saut modulable, tolérances de saut, écrasements
    avec rebond et combos, impacts, secousses, particules, caméra qui anticipe, parallaxe, musique
    en boucle, interface de jeu, séquence de victoire, pause, manette, records. **Même niveau, mêmes
    images (non modifiées), mêmes sons aux mêmes moments, mêmes règles** que le jeu Java.
  - **Classique** : le jeu Java reproduit **à l’identique**. Sur 13 scénarios (178 716 tours de jeu,
    soit 9 min 25 s), l’état complet, chaque appel de dessin et chaque son (y compris les arrêts de
    son) sont identiques, tour par tour, à ceux du **code Java original exécuté** ; l’image est
    identique à celle de Java sur 6 captures (écart maximal 1/255 sur les bords semi-transparents).
- Les **28 PNG et 8 WAV** sont les fichiers originaux de `src/`, **identiques octet pour octet**
  (SHA-256) jusque dans le navigateur.
- **42 tests** unitaires et de fidélité, **53 tests** dans un vrai navigateur sur le build de
  production : **tous réussis**.
- Rien n’a été déployé en production.

## 2. Stack technique

| Élément        | Choix                           | Pourquoi                                                                                    |
| -------------- | ------------------------------- | ------------------------------------------------------------------------------------------- |
| Outil de build | Vite 8.3.6 (Rolldown)           | rapide, build statique, multi-pages, déploiement Vercel natif                               |
| Langage        | TypeScript 7.0.2, mode strict   | typage du moteur et du site, sans étape de compilation pour les outils (Node exécute le TS) |
| 3D             | Three.js r187 (0.187.0)         | seule dépendance d’exécution ; chargée en différé, uniquement sur l’accueil                 |
| Jeu            | Canvas 2D + deux moteurs maison | Classique : physique d’origine reproduite ; Moderne : physique continue écrite sur mesure   |
| Son            | Web Audio API                   | sons superposables et non bloquants, musique en boucle avec fondus, fichiers WAV d’origine  |
| Tests          | Vitest 5.1.0, Playwright 1.63.0 | fidélité au Java en Node, vérifications réelles dans Chromium                               |
| Interface      | HTML/CSS/TS sans framework      | peu de dépendances ; architecture modulaire prête à évoluer                                 |

Le site est multi-pages : chaque route est un vrai fichier HTML (`/`, `/jeux/mario-ahmed-aberkan`,
`404.html`). En-tête et pied de page sont écrits une fois (`src/site/fragments`) et insérés au build.

## 3. Le jeu d’origine : Project_Dhmed

15 classes Java (1 417 lignes, paquet `com.mosmos`). Le code est celui de MarioJava (même niveau,
même physique, mêmes cadences), avec son propre contenu — différences relevées en comparant les
deux dépôts :

| Élément                     | MarioJava (retiré)                              | Project_Dhmed (intégré)                                                                                    |
| --------------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Titre de la fenêtre         | « Jeu Mario »                                   | « Super Ahmed Averkan Bros »                                                                               |
| Personnages                 | 17 images                                       | 17 autres images, mêmes noms (Mario, champignons, tortues) ; Mario en 28×50 dans toutes les poses          |
| Décor, objets, pièces       | 11 images                                       | les mêmes 11 fichiers (identiques octet pour octet)                                                        |
| Son d’une pièce             | `piece.wav`                                     | `issordiyen.wav`                                                                                           |
| Champignon / tortue écrasés | `ecrasePersonnage.wav` (les deux)               | `cheikhLdjama3.wav` / `A3rav.wav`                                                                          |
| Musique                     | aucune                                          | `themeSong.wav` (63 s), lancée au premier tour                                                             |
| Fin de partie               | « Vous avez gagné !! » / « Vous avez perdu... » | « arwu cḍaḥ !! » / « Tqarseḍ akk ziɣ »                                                                     |
| Crédit (en haut de l’écran) | —                                               | « Par Aknanir nAth Yettura pour ig: @dz_kabylifornie » (Arial gras 10)                                     |
| Sons inchangés              | `saut.wav`, `boum.wav`                          | les mêmes fichiers ; `partieGagnee.wav` et `partiePerdue.wav` gardent leur nom mais sont d’autres fichiers |
| Audio                       | `playSound`                                     | + `stopSound` (pour arrêter la musique)                                                                    |

Le dossier `bin/` du dépôt contient une ancienne compilation avec les ressources de MarioJava
(`piece.wav`, `ecrasePersonnage.wav`, anciens sprites) : seul `src/` fait foi.

## 4. Version Classique : méthode de portage

1. **Mesure du jeu réel** (sous écran virtuel Xvfb, JDK 21, classes non modifiées) :
   `paintComponent()` — qui exécute toute la logique — est appelé **316,5 fois/s** (période 3,16 ms),
   les ennemis avancent d’1 px toutes les **15,12 ms**, le compte à rebours décompte toutes les
   **1000,15 ms** ; texte en **#333333**, fond du panneau #EEEEEE.
2. **Portage ligne à ligne** : mêmes classes, mêmes noms, même ordre d’exécution (y compris les
   effets de bord pendant le dessin). Les threads Java sont remplacés par une horloge déterministe
   en microsecondes qui exécute les mêmes actions aux cadences mesurées.
3. **Harnais Java de référence** (`outils/harnais-java`) : le code original de Project_Dhmed est
   compilé (sources converties en UTF-8, car le dépôt mélange UTF-8 et Windows-1252) et exécuté avec
   la même horloge ; seuls les `Thread.start()` sont retirés et `Audio.playSound`/`stopSound`
   journalisent au lieu de jouer. Il produit, pour chaque tour, l’état complet, la liste exacte des
   `drawImage`/`drawString` (image, coordonnées, police, couleur) et les sons, ainsi que des captures
   de l’image rendue par Java.
4. **Comparaison** : le moteur TypeScript doit produire exactement les mêmes lignes. Les scénarios
   viennent d’un joueur automatique (entrées clavier brutes, répétition automatique du système
   comprise) et d’un planificateur qui a trouvé un parcours gagnant (10 pièces, arrivée en 14,9 s),
   gagnant aussi sur le Java original.

## 5. Version Moderne : ce qui la rend plus fluide, plus moderne, plus jouissive

Tout le contenu vient du jeu d’origine : positions du niveau (recopiées du constructeur Java), les
28 images, les 8 sons, les règles (10 pièces + arrivée avant 100 s ; contact latéral mortel ;
écrasement par-dessus). Seules les sensations changent ; tous les réglages sont dans
`src/games/mario-ahmed-aberkan/moderne/reglages.ts`.

**Fluidité**

- Simulation à pas fixe de **120 Hz**, indépendante de l’écran, et affichage **interpolé** entre deux
  pas à la fréquence de l’écran (60, 120 ou 144 Hz) : mouvement continu, sans saccade.
- Positions au sous-pixel, arrondies au pixel physique de l’écran : défilement doux, sprites nets.
- Caméra amortie qui **anticipe** dans la direction de la course ; **parallaxe** : le ciel du décor
  défile à 45 % de la vitesse du sol (la même image `fondEcran.png`, dessinée en deux bandes).
- Les gros sons (musique, jingles de fin) se chargent en arrière-plan : la partie démarre sans attendre.

**Contrôles modernes**

- Inertie (accélération et freinage, petit dérapage au demi-tour), vitesse maximale 330 px/s
  (Java : 316 px/s, sans inertie).
- **Saut modulable** : bouton maintenu ≈ 165 px (Java : 160 px), appui bref ≈ 70 px ; gravité plus
  forte à la descente, court temps suspendu au sommet.
- Tolérances : saut encore possible 0,09 s après avoir quitté un rebord (« coyote time »), appui
  mémorisé 0,13 s avant d’atterrir, glissement automatique quand la tête frôle le coin d’un bloc.
- Clavier QWERTY et AZERTY (← → / Q D / A D, Espace / ↑ / Z), **manette** (stick ou croix, A/B,
  Start), commandes tactiles multi-touch sur écran tactile.

**Plaisir de jeu (« game feel »)**

- Écraser un ennemi : rebond (plus haut si Saut est maintenu), **combos** (×2, ×3… sans toucher le
  sol), micro-gel d’impact de 60 ms, secousse de l’écran, étincelles, points flottants.
- Blocs qui sursautent quand on les cogne, poussière au saut, au dérapage et à l’atterrissage, pièces qui
  flottent et s’envolent quand on les prend, champignons écrasés et carapaces qui disparaissent en
  fondu, explosion puis chute de Mario à la défaite.
- **Séquence de victoire** : Mario glisse le long du mât, marche jusqu’à la porte du château, feu
  d’artifice ; écran de fin avec temps, pièces, ennemis écrasés, meilleur combo, bonus de temps,
  score et badge « Nouveau record ! ».
- Interface en jeu : chrono, compteur de pièces, score, barre de progression, introduction
  « Prêt ? Partez ! », message « Il manque N pièces ! » au drapeau.
- Musique `themeSong.wav` **en boucle** avec fondus, arrêtée à la victoire ou à la défaite ;
  `partieGagnee.wav` à la victoire ; `boum.wav` puis `partiePerdue.wav` 0,32 s plus tard (comme en
  Java) à la défaite.
- Pause (Échap/P, automatique quand l’onglet est masqué), son coupable (M), records (meilleur temps
  et meilleur score) conservés dans le navigateur.

Les effets (particules, étincelles, feu d’artifice, textes) sont **ajoutés** par le code et ne
remplacent aucune ressource : chaque sprite est dessiné tel quel, à sa taille d’origine, sans filtre
ni recoloration (seule son opacité baisse pendant les disparitions en fondu).

## 6. Différences entre la version Java et la version Web

### 6.1 Corrections de bugs techniques (version Classique, désactivables)

Regroupées dans `src/games/mario-ahmed-aberkan/config.ts`. Avec `AUCUNE_CORRECTION`, le moteur
reproduit le Java à l’identique, bugs compris (c’est ce mode qui est comparé au Java).

| Bug du Java                                                                                                                                                                          | Effet en Java (vérifié en l’exécutant)                                                                                      | Correction Web                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Clavier : relâcher **n’importe quelle** touche arrête Mario, et la reprise dépend de la répétition automatique du système, qui s’interrompt dès qu’on appuie sur Espace              | impossible de garder → enfoncée et de sauter en avançant                                                                    | tant qu’une flèche est maintenue, son appui est renouvelé avant chaque tour (`Clavier.java` lui-même est inchangé)       |
| `Clavier.java`, flèche gauche à `xPos == 4431` : `setxPos(4430); setxPos(-50); setxPos(750);` au lieu de `setxPos/setxFond1/setxFond2`                                               | xPos passe à 750 : château et drapeau disparaissent, la victoire est repoussée d’environ 3900 px                            | xPos revient à 4430 et le fond est recalé d’un pixel, selon l’intention du commentaire « Annule le décalage de 1 »       |
| Le thread du compte à rebours ne s’arrête jamais                                                                                                                                     | le temps devient négatif ; 100 s après le lancement, « arwu cḍaḥ !! » devient « Tqarseḍ akk ziɣ »                           | le compte à rebours s’arrête dès que la partie est gagnée ou perdue                                                      |
| `Scene.finDePartie()` : le même indicateur `ok` sert à lancer la musique et à jouer le son de victoire ; `Audio.stopSound()` crée un nouveau `Clip` au lieu d’arrêter celui qui joue | la musique consomme l’indicateur au 1er tour : `partieGagnee.wav` n’est **jamais** joué, et la musique n’est jamais arrêtée | la musique a son propre indicateur : elle s’arrête en fin de partie (victoire ou défaite) et le son de victoire est joué |

### 6.2 Adaptations au navigateur (les deux versions)

- **Cadence** : la version Classique avance à 316,5 tours/s (mesure du jeu original) quelle que soit
  la fréquence de l’écran ; en Java, la vitesse dépendait de la machine. La version Moderne simule à
  120 Hz avec interpolation.
- **Surface affichée : 700 × 350** au lieu du JPanel de 700 × 360 : le décor fait 350 px de haut, les
  10 lignes du bas n’ont jamais été dessinées (bande grise) et étaient masquées par la barre de titre.
  Rapport 2:1 conservé, agrandissement au plus proche voisin par facteur entier (pixels nets), aucune
  déformation.
- **Textes** de la version Classique : mêmes chaînes (y compris « 0pièce(s) trouvée(s) sur 10 »,
  sans espace, comme en Java), mêmes polices, tailles, positions et couleur, tracés à la résolution
  de l’écran.
- **Démarrage** au clic sur « Jouer » (le navigateur n’autorise le son qu’après une interaction) ;
  en Java, la partie commençait au lancement de la fenêtre.
- **Musique** : en Classique, jouée une fois comme en Java (63 s) ; en Moderne, en boucle (volume
  0,5) avec fondus.
- **Pause** quand l’onglet est masqué ; touches relâchées à la perte de focus (en Java, Mario
  continuait de marcher seul).
- **Espace maintenu** : un seul saut et un seul son (en Java, la répétition automatique relançait le
  son ~30 fois par seconde).
- **Sons non bloquants** : en Java, chaque son ouvrait un `Clip` de façon synchrone dans le thread de
  dessin (petits gels) ; ici les sons sont décodés à l’avance et se superposent.
- **Ajouts d’interface** (hors logique) : écran d’accueil du jeu, choix Moderne/Classique, pause,
  son, plein écran, Recommencer/Rejouer, commandes tactiles ; les touches du jeu ne font pas défiler
  la page.

### 6.3 Particularités du Java conservées en Classique, absentes en Moderne

Mario démarre 2 px plus bas (y = 245) jusqu’au premier objet proche ; il tombe instantanément en
quittant un bloc ; un « plafond » peut persister après un saut sous un bloc (saut suivant écourté) ;
après la mort, le décor défile tant que la touche reste enfoncée ; Mario reste jouable après la
victoire ; la tortue garde une zone de collision de 43 px de large pour un sprite de 28 px ; la
boucle de collision des tortues commence à `j = 1`. La version Moderne n’a pas ces défauts.

## 7. Inventaire des ressources et vérification SHA-256

28 PNG (`src/images`) et 8 WAV (`src/audio`) — 16,9 Mo au total, dont 16,6 Mo de WAV. Aucun fichier
n’est converti, redimensionné, recoloré ou remplacé. Les images sont décodées sans conversion
d’espace colorimétrique et dessinées à leur taille d’origine ; les sons sont lus depuis les octets
PCM d’origine. Les fichiers du dépôt `public/originaux` de la version précédente ont été supprimés.

| Vérification                                                               | Résultat         |
| -------------------------------------------------------------------------- | ---------------- |
| `src/` du dépôt Project_Dhmed ↔ `public/originaux` du projet               | 36/36 identiques |
| manifeste ↔ `dist/` (à chaque `npm run build`)                             | 36/36 identiques |
| octets servis en HTTP ↔ manifeste (test navigateur)                        | 36/36 identiques |
| SHA-256 calculé **dans le navigateur** sur les fichiers chargés par le jeu | 36/36 identiques |
| dimensions décodées ↔ en-tête des PNG                                      | 28/28 identiques |
| 2000 premiers échantillons décodés ↔ données PCM des WAV                   | 8/8 identiques   |

Empreintes (identiques dans `src/`, `public/originaux`, `dist/` et dans le navigateur) :

| Fichier (src/ de Project_Dhmed)   | Format                               |   Octets | SHA-256                                                            |
| --------------------------------- | ------------------------------------ | -------: | ------------------------------------------------------------------ |
| src/images/bloc.png               | 30×30 px                             |     2579 | `922fd6921c427f3f5d4215a3686eb99e66d910137f53f4bd79d2d0b78474324c` |
| src/images/boom.png               | 63×50 px                             |     2256 | `1c8c23693a23786ae20e8faf75ca497459992febac2afc4d6959110d60741ab2` |
| src/images/champArretDroite.png   | 27×30 px                             |     2240 | `616b1f24c5bb7002d6cac356472327f28c8cfaeeff4399f2549876678f5d9c9b` |
| src/images/champArretGauche.png   | 27×30 px                             |     2240 | `081c25286b55bd3f35a0816edc5cb084148631856f7eb8ed3381c34d15c2c516` |
| src/images/champEcraseDroite.png  | 65×10 px                             |     1114 | `69e431ace8aa50b615f0bae6e0455939dc73857582cbbffe6063c06cfcd790e5` |
| src/images/champEcraseGauche.png  | 65×10 px                             |     1132 | `335044c4841ab05dc5a94769498e3028100dec06eb62e4e8f3d815e7b8c6c67c` |
| src/images/champMarcheDroite.png  | 27×30 px                             |     2356 | `c23fa87a9a5a3f6c52775af26a3e179a4c8cfbd2b1545e28c5b858ea1611b21d` |
| src/images/champMarcheGauche.png  | 27×30 px                             |     2331 | `a3aadb1a32fcfd621156aa678c9b82457fb3c0d6332a469b759bfc193b70dad1` |
| src/images/chateau1.png           | 172×200 px                           |    16034 | `59b76f92fc5f4f079f8ef6b8251b5493d734c9ee73d9fdd3f8e215e3f939a1d1` |
| src/images/chateauFin.png         | 124×150 px                           |     7404 | `aa4027402ae6b75610011feac3d5eddbb66ead66e2c53401870a4f8bb8e2d0cb` |
| src/images/depart.png             | 50×60 px                             |     1754 | `292d68323194b8c6348ba9493ac40b5e4ef63dcb78eff3a1117d8ac275d4a7f0` |
| src/images/drapeau.png            | 49×180 px                            |     1946 | `183e98e371d30bef8e45661850e72f9f379248eea1bee5da4cd19c3b0cd8d863` |
| src/images/fondEcran.png          | 800×350 px                           |   199166 | `699288376992a7b1374204c90c7ded5cae39433cf0eadbbb14899824d1aca374` |
| src/images/marioArretDroite.png   | 28×50 px                             |     3899 | `8ea0b2cf82d2d6f0ad6088359a6bba42bb240f7eacec9d064067b207832d52b7` |
| src/images/marioArretGauche.png   | 28×50 px                             |     3873 | `02f93ae75a799b041189d6fe34cf33c7396857e38d1ea796e36bb26886c6a5e0` |
| src/images/marioMarcheDroite.png  | 28×50 px                             |     4060 | `dec1081b0ce5248d6065883f80454c3887091d19a2b9c0a4c54a3fd9143a2354` |
| src/images/marioMarcheGauche.png  | 28×50 px                             |     4148 | `23fc62010cc8dae158f62ca7fd9d4419f59728aac557b11e1d36a9bfd9146a87` |
| src/images/marioMeurt.png         | 28×50 px                             |     3501 | `4d32b8fea55c22c636a5ac9f00e447636d105d057d9548e0e2b936de963d061b` |
| src/images/marioSautDroite.png    | 28×50 px                             |     4244 | `896ad404297fccef61a9ddf18b4ba854455798a670e9a03f867126c0e939416f` |
| src/images/marioSautGauche.png    | 28×50 px                             |     4245 | `c44a8525f6a8aea4eb607bd605dc30985050d906d93ed732d4798f42ca912875` |
| src/images/piece1.png             | 25×30 px                             |     1367 | `8e6781fdba72b2c34297b75ff26273edf46c6a3fd0899f21321931997fefb1a7` |
| src/images/piece2.png             | 23×27 px                             |     1246 | `9fb44702f9e65397faf647a43e713ae0d90b3e8506a928c9c8c4b19fe380a0ac` |
| src/images/tortueArretDroite.png  | 28×50 px                             |     2851 | `84a20039a617417ccfa07a7be7d3113de7cbf710a0aa7d4b8dc60040c71bda68` |
| src/images/tortueArretGauche.png  | 28×50 px                             |     2898 | `31a5b8cca5667130703e6129219e4a8fa5abe5bab4d33034d47f87f655a3cd51` |
| src/images/tortueFermee.png       | 25×23 px                             |     1302 | `5883d05cc2dfa11e5a7a9bd4efb1b0e6198c18f080edd6e766881a69b06cf83f` |
| src/images/tortueMarcheDroite.png | 28×50 px                             |     3039 | `ca144f99bc1956c1455b61ada1b9369bca3448cb9f7eda43f12020842a0c9a23` |
| src/images/tortueMarcheGauche.png | 28×50 px                             |     3053 | `ddb869685faaf3189f16906f0cadaec4e5f0d38c41507b02a76e380df77fca95` |
| src/images/tuyauRouge.png         | 43×65 px                             |     1991 | `fb0c7546d1fdf776f4d5f2ad27d316648b7eb698a47f19f176a2e27d19834df5` |
| src/audio/A3rav.wav               | 2 canaux, 48000 Hz, 16 bits, 2,33 s  |   446706 | `1e30ce3f92f229dce04e83371ba56723ca44c84bcba8fd5d4fc8e5402e33e2c7` |
| src/audio/boum.wav                | 1 canal, 44100 Hz, 16 bits, 0,70 s   |    61996 | `46727eb2d89bbafd42cc8f43611041d12a219a28bc0e3b154d417dfd45e709ee` |
| src/audio/cheikhLdjama3.wav       | 2 canaux, 48000 Hz, 16 bits, 0,92 s  |   176386 | `d5a324fd68b985f305847975aa2e5b445bc595009f750101fff78f24e73e71ef` |
| src/audio/issordiyen.wav          | 2 canaux, 48000 Hz, 16 bits, 0,92 s  |   176386 | `1ca023c86a6b388738fcd5bb66b290c82a429a85694b38c4d810ab92caff6426` |
| src/audio/partieGagnee.wav        | 2 canaux, 48000 Hz, 16 bits, 15,11 s |  2900292 | `ea7204d9a360d7881f6b6601d0c88e0853577edc477598b18529f4d39c292d88` |
| src/audio/partiePerdue.wav        | 2 canaux, 44100 Hz, 16 bits, 3,95 s  |   696398 | `60baa49b59f3c0e3214f1039718e1de7911313aa19a4987a31d6c61b72e1fed9` |
| src/audio/saut.wav                | 1 canal, 11025 Hz, 8 bits, 0,24 s    |     2725 | `81979d1da763c20985abdb996851c205603f28eed6ab0fd6f96c543c65dbcbb5` |
| src/audio/themeSong.wav           | 2 canaux, 48000 Hz, 16 bits, 63,08 s | 12112078 | `33319e2217a3eeb0290f5ac90caedce61d85ad1d60e89b52ef04eb12ca2ee337` |

## 8. Fonctionnalités opérationnelles

- Accueil KABYLE SOLIDE : scène Three.js (les cinq solides de Platon), parallaxe au pointeur, pause
  hors écran et onglet masqué, image fixe si l’utilisateur préfère réduire les animations, repli
  sans WebGL ; bouton « Jouer » ; carte du jeu générée depuis le catalogue.
- Page `/jeux/mario-ahmed-aberkan` : titre, jeu, écran d’accueil du jeu (Jouer, choix de la
  version, record, commandes, crédit), bouton Commencer/Recommencer, bascule Moderne/Classique,
  plein écran (API standard, préfixe WebKit, mode simulé sur iPhone), retour à l’accueil.
- Jeu (deux versions) : déplacements, sauts, blocs, tuyaux, pièces animées, champignons et tortues
  (déplacement autonome, demi-tours, écrasement), mort, compte à rebours, victoire et défaite,
  musique et 7 sons aux moments prévus par le code Java ; pause, son, écran de fin, Rejouer.
- Clavier fiable (écoute globale, sans défilement de page ni activation de bouton) ; manette ;
  commandes tactiles affichées seulement sur écran tactile et pendant la partie ; paysage mobile
  optimisé (en-tête masqué, jeu sur toute la hauteur).

## 9. Tests réellement exécutés

Environnement : conteneur Linux, Node 22.23, JDK 21, Chromium (Playwright 1.63, sans GPU : rendu
logiciel). Commandes : `npm run check`, `npm test`, `npm run build`, `npx playwright test`.

**Fidélité au Java (Vitest, 14 tests)** — 13 scénarios, 178 716 tours, 0 différence avec les traces
du code Java de Project_Dhmed.

**Version Classique (Vitest, 13 tests)** — chaque correction comparée au comportement Java strict
(dont : musique lancée au 1er tour, jamais arrêtée et son de victoire jamais joué en Java ; arrêtée
et son de victoire joué une fois une fois corrigé) ; horloge : 316 tours/s quel que soit l’écran,
ennemis ≈ 66 px/s, compte à rebours.

**Version Moderne (Vitest, 15 tests)** — parcours gagnant (10 pièces, 3 ennemis écrasés, victoire en
14,7 s), déterminisme, défaite au bout de 100 s, hauteurs de saut, vitesse, tuyau bloquant et
franchissable, atterrissage sur un tuyau, bloc cogné, « coyote time », saut mémorisé, pièce,
écrasement d’un champignon et d’une tortue (sons, rebond, points), mort par contact latéral (sons et
délai de 0,32 s), drapeau atteint sans les 10 pièces.

**Navigateur (Playwright, build de production) — 53/53 réussis** (25 pour la version Classique,
13 pour la Moderne, 10 pour le site, 5 sur mobile émulé Pixel 7) :

| #   | Vérification demandée          | Tests                                                                                                                                                                                                      |
| --- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | le site se charge              | titre, contenu, aucune erreur console                                                                                                                                                                      |
| 2   | la scène Three.js fonctionne   | WebGL actif, ≈ 8 % des pixels du héros dessinés par la 3D, animation, pause hors écran                                                                                                                     |
| 3   | navigation vers le jeu         | bouton « Jouer », carte du catalogue, retours ; routes avec/sans `/` final ; 404                                                                                                                           |
| 4   | sprites originaux              | SHA-256 des 36 fichiers dans le navigateur ; **rendu Classique identique au Java** sur 6 images (écart max 1/255, aucun pixel au-delà de 2/255)                                                            |
| 5   | proportions                    | 28 images aux dimensions d’origine ; rapport 2:1 et résolution multiple exacte de 700×350 à 4 tailles de fenêtre                                                                                           |
| 6   | gauche / droite                | clavier réel, flèches et Q/D, dans les deux versions ; tactile ◀ ▶                                                                                                                                         |
| 7   | saut                           | Classique : trajectoire du Java ; Moderne : Espace, ↑ ou Z, saut maintenu ≈ 160 px contre 75 à 79 px en appui bref                                                                                         |
| 8   | collisions                     | arrêt contre le 1er tuyau, franchissement en sautant (deux versions)                                                                                                                                       |
| 9   | ennemis                        | déplacement autonome ≈ 66 px/s, demi-tour, champignon écrasé (`cheikhLdjama3.wav`)                                                                                                                         |
| 10  | pièces                         | compteur, pièce retirée, son `issordiyen.wav`                                                                                                                                                              |
| 11  | score et compte à rebours      | textes affichés, −1 par seconde réelle                                                                                                                                                                     |
| 12  | défilement                     | positions du décor et du château (Classique), caméra qui suit Mario (Moderne)                                                                                                                              |
| 13  | sons                           | contexte audio déverrouillé au clic, 8 sons décodés, échantillons identiques aux WAV, signal réel en sortie (crête ≈ 1,0), sons superposés sans blocage                                                    |
| 14  | défaite                        | par un ennemi (`boum.wav` puis `partiePerdue.wav`, message, écran de fin) et par le temps, dans les deux versions                                                                                          |
| 15  | victoire                       | parcours rejoués : 10 pièces, arrivée, « arwu cḍaḥ !! », musique arrêtée, `partieGagnee.wav` une fois ; écran de fin et record mémorisé (Moderne)                                                          |
| 16  | nouvelle partie sans recharger | état réinitialisé, page non rechargée                                                                                                                                                                      |
| 17  | plusieurs parties              | 5 parties d’affilée, aucune erreur, une seule boucle (cadence intacte)                                                                                                                                     |
| 18  | plein écran                    | jeu agrandi sans déformation, jouable, sortie (deux versions)                                                                                                                                              |
| 19  | pas de défilement involontaire | Espace et flèches sur une page défilable ; Espace avec le focus sur un bouton                                                                                                                              |
| 20  | fluidité                       | Classique : 60,2 images/s et 317 tours/s ; Moderne : 60,2 à 60,4 images/s et 120 pas/s ; mobile : 60,3 images/s et 120 pas/s ; accueil 3D : 55 à 58 (ordinateur, rendu logiciel) et 60,4 (mobile) images/s |

Aussi testés : version Moderne par défaut, pause (Échap fige la partie et coupe le son), son coupé
mémorisé (M), passage Moderne ⇄ Classique depuis la page, manette (stick et bouton A, simulés),
commandes tactiles multi-touch, cadrage portrait et paysage, absence de débordement horizontal de
320 à 1920 px, focus après un clic ailleurs, aucun crochet de test exposé sans paramètre de test.

**Build** : `npm run build` (types + Vite + contrôle SHA-256 de `dist/`) réussi.

## 10. Bugs restants et limites

- **Aucun bug connu** à l’issue des tests.
- Tests menés uniquement dans **Chromium** (ordinateur et mobile émulé) : Safari (macOS/iOS),
  Firefox et de vrais téléphones n’ont pas pu être testés ici ; la manette a été simulée.
- **Poids des sons** : les WAV d’origine font 16,6 Mo, dont `themeSong.wav` 12,1 Mo. Ils ne sont pas
  convertis (règle du projet) ; la musique et les jingles de fin (15,7 Mo) se chargent en arrière-plan
  après le démarrage. Sur une connexion mobile lente, la musique peut donc commencer en retard.
- **Pas de déploiement Vercel** (non autorisé) : la configuration est prête mais n’a pas été
  validée en ligne ; les en-têtes de cache ne sont vérifiables qu’une fois déployé.
- **Vitesse de référence** de la version Classique : mesurée sur Linux avec le JDK 21 ; le jeu Java
  tournait plus ou moins vite selon la machine. Une ligne à changer dans `config.ts` si besoin.
- **iPhone** : pas de plein écran natif pour un élément (mode simulé) ; le commutateur
  « silencieux » coupe les sons Web Audio.
- **Plein écran** sur un écran 16:9 : bandes en haut et en bas, inévitables sans déformer ni couper
  l’image 2:1.
- **Police** : Arial n’existe pas sur Android et sur certains Linux ; une police aux métriques
  identiques (Liberation Sans, Arimo) ou la police système la remplace.
- **Droits** : le jeu reprend l’univers Mario de Nintendo, et les sprites des personnages sont faits
  de photos de visages de personnes réelles. Avant une mise en ligne publique, il est prudent de
  vérifier les droits sur la marque, les images (accord des personnes représentées) et les sons.

## 11. Commandes

```bash
npm install              # dépendances
npm run dev              # développement : http://localhost:5173
npm run build            # build de production dans dist/
npm run preview          # prévisualisation du build : http://localhost:4173
npm test                 # fidélité au Java + tests des deux moteurs
npx playwright install chromium && npm run test:e2e   # tests navigateur
npm run verify:assets    # contrôle SHA-256 des ressources
node outils/harnais-java/executer.mjs ../Project_Dhmed   # régénère les références Java (JDK requis)
node outils/moderne/planifier-victoire.ts                # recalcule le parcours gagnant du mode Moderne
```
