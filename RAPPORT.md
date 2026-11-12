# Compte rendu — KABYLE SOLIDE et portage de « Mario Ahmed Aberkan »

Version 0.1.0 — novembre 2026.

## 1. Résumé

- Le jeu Java d’origine a été porté en TypeScript **à l’identique** : sur 13 scénarios
  (≈179 000 tours de jeu, environ 9 minutes), l’état complet, chaque appel de dessin et chaque son
  sont identiques, tour par tour, à ceux du **code Java original exécuté** par un harnais.
- Les 28 PNG et 6 WAV sont les fichiers originaux, **identiques octet pour octet** (SHA-256) au
  dépôt, du dossier `src/` jusqu’au navigateur. Dans le navigateur, l’image du jeu est identique
  **au pixel près** à celle rendue par Java (6 images comparées, zones de texte exclues).
- Le site KABYLE SOLIDE (Vite + TypeScript + Three.js) est fonctionnel : accueil 3D, page
  `/jeux/mario-ahmed-aberkan`, plein écran, commandes tactiles, prêt pour Vercel.
- 24 tests unitaires et de fidélité, 40 tests dans un vrai navigateur : **tous passent**.

## 2. Stack technique

| Élément        | Choix                                   | Pourquoi                                                                                    |
| -------------- | --------------------------------------- | ------------------------------------------------------------------------------------------- |
| Outil de build | Vite 8.3.6 (Rolldown)                   | rapide, build statique, multi-pages, déploiement Vercel natif                               |
| Langage        | TypeScript 7.0.2, mode strict           | typage du moteur et du site, sans étape de compilation pour les outils (Node exécute le TS) |
| 3D             | Three.js r187 (0.187.0)                 | seule dépendance d’exécution ; chargée en différé, uniquement sur l’accueil                 |
| Jeu            | Canvas 2D + moteur maison porté du Java | pas de moteur tiers (Phaser) : la physique d’origine est reproduite telle quelle            |
| Son            | Web Audio API                           | sons superposables, non bloquants, fichiers WAV d’origine                                   |
| Tests          | Vitest 5.1.0, Playwright 1.63.0         | fidélité au Java en Node, vérifications réelles dans Chromium                               |
| Interface      | HTML/CSS/TS sans framework              | peu de dépendances ; architecture modulaire prête à évoluer                                 |

Le site est multi-pages : chaque route est un vrai fichier HTML (`/`, `/jeux/mario-ahmed-aberkan`,
`404.html`), ce qui évite toute erreur de route au déploiement. En-tête et pied de page sont écrits
une fois (`src/site/fragments`) et insérés au build.

## 3. Méthode de portage

1. **Analyse** des 15 classes Java (`Main`, `Scene`, `Chrono`, `Clavier`, `Personnage`, `Mario`,
   `Champ`, `Tortue`, `Objet`, `Bloc`, `TuyauRouge`, `Piece`, `Score`, `CompteARebours`, `Audio`).
2. **Mesure du jeu réel** : le jeu original (classes non modifiées) a été lancé sous un écran
   virtuel (Xvfb, JDK 21) avec un lanceur instrumenté :
   - `paintComponent()` — qui exécute toute la logique — est appelé **316,5 fois/s** (période
     3,16 ms : `Thread.sleep(3)` dure en réalité 3,12 ms, plus `repaint()`) ;
   - les ennemis avancent d’1 px toutes les **15,12 ms** (thread propre à chaque ennemi) ;
   - le compte à rebours décompte toutes les **1000,15 ms** ;
   - couleur du texte **#333333** (thème Metal/Ocean), fond du panneau #EEEEEE.
3. **Portage ligne à ligne** : mêmes classes, mêmes noms, même ordre d’exécution (y compris les
   effets de bord de `saute()`, `marche()`, `meurt()` et `bouge()` pendant le dessin). Les 4 sortes
   de threads Java sont remplacées par une horloge déterministe en microsecondes qui exécute les
   mêmes actions aux cadences mesurées.
4. **Harnais Java de référence** (`outils/harnais-java`) : le code original est compilé et exécuté
   avec cette même horloge (seuls les `Thread.start()` sont retirés et `Audio.playSound` journalise
   au lieu de jouer). Il produit pour chaque tour une ligne canonique : état complet, liste exacte
   des `drawImage`/`drawString` (image, coordonnées, police, couleur) et sons.
5. **Comparaison** : le moteur TypeScript doit produire exactement les mêmes lignes. Les scénarios
   proviennent d’un joueur automatique (entrées clavier brutes, répétition automatique du système
   comprise) et d’un **planificateur** qui a trouvé un parcours gagnant (10 pièces, arrivée en
   14,9 s) — **rejoué sur le Java original, il gagne aussi**.

## 4. Différences entre la version Java et la version Web

### 4.1 Corrections de bugs techniques (désactivables)

Elles sont regroupées dans `src/games/mario-ahmed-aberkan/config.ts`. Avec `AUCUNE_CORRECTION`, le
moteur reproduit le Java à l’identique, bugs compris (c’est ce mode qui est comparé au Java).

| Bug du Java                                                                                                                                                             | Effet en Java                                                                                                                    | Correction Web                                                                                                     |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Clavier : relâcher **n’importe quelle** touche arrête Mario, et la reprise dépend de la répétition automatique du système, qui s’interrompt dès qu’on appuie sur Espace | impossible de garder → enfoncée et de sauter en avançant : Mario s’arrête net au relâchement d’Espace                            | tant qu’une flèche est maintenue, son appui est renouvelé avant chaque tour (`Clavier.java` lui-même est inchangé) |
| `Clavier.java`, flèche gauche à `xPos == 4431` : `setxPos(4430); setxPos(-50); setxPos(750);` au lieu de `setxPos/setxFond1/setxFond2`                                  | xPos passe à 750 : le château et le drapeau disparaissent, la victoire est repoussée d’environ 3900 px (vérifié sur le Java)     | xPos revient à 4430 et le fond est recalé d’un pixel, selon l’intention du commentaire « Annule le décalage de 1 » |
| Le thread du compte à rebours ne s’arrête jamais                                                                                                                        | le temps devient négatif ; 100 s après le lancement, « Vous avez gagné !! » devient « Vous avez perdu... » (vérifié sur le Java) | le compte à rebours s’arrête dès que la partie est gagnée ou perdue                                                |

### 4.2 Adaptations au navigateur

- **Cadence** : la logique avance à 316,5 tours/s (mesure du jeu original), indépendamment de
  l’écran (60, 120 ou 144 Hz) ; l’affichage se fait à la fréquence de l’écran. En Java, la vitesse
  dépendait de la machine (durée réelle de `Thread.sleep`) ; elle est réglable dans `config.ts`.
- **Surface affichée : 700 × 350** au lieu du JPanel de 700 × 360. Le décor `fondEcran.png` fait
  350 px de haut : les 10 lignes du bas n’ont jamais été dessinées par le jeu (bande grise du
  panneau) et étaient de toute façon masquées par la barre de titre de la fenêtre. Rapport 2:1
  conservé, agrandissement au plus proche voisin par facteur entier puis lissage léger (pixels nets,
  sans scintillement), aucune déformation.
- **Textes** : mêmes chaînes (y compris « 0pièce(s) trouvée(s) sur 10 », sans espace, comme en
  Java), même police (Arial, ou une police aux mêmes métriques), même taille, même position, même
  couleur, mais tracés à la résolution de l’écran (plus nets que l’Arial agrandi du Java).
- **Démarrage** : la partie (et donc le compte à rebours) commence au clic sur « Commencer » — le
  navigateur n’autorise le son qu’après une interaction. En Java, elle commençait au lancement.
- **Pause** quand l’onglet est masqué (en Java, fenêtre réduite : les ennemis et le temps
  continuaient alors que Mario et les collisions s’arrêtaient).
- **Perte de focus** : les touches sont relâchées (en Java, Mario continuait de marcher seul).
- **Espace maintenu** : un seul saut et un seul son (en Java, la répétition automatique du système
  relançait le son ~30 fois par seconde et enchaînait les sauts). Un nouvel appui en l’air rejoue
  le son sans sauter, comme en Java.
- **Sons non bloquants** : en Java, chaque son ouvrait un `Clip` de façon synchrone dans le thread
  de dessin, ce qui provoquait de petits gels ; ici les sons sont décodés à l’avance.
- **Pas de boucle infinie** : en Java, le thread d’un ennemi mort tournait à vide à 100 % d’un cœur
  processeur (boucle sans pause).
- **Ajouts de l’interface Web** (hors logique du jeu) : boutons Commencer / Recommencer / Rejouer,
  plein écran, commandes tactiles ; les flèches ↑/↓ ne font pas défiler la page pendant la partie.

### 4.3 Particularités du Java volontairement conservées

Elles font partie des sensations du jeu d’origine : Mario démarre 2 px plus bas (y = 245) jusqu’au
premier objet proche ; il tombe instantanément au sol en quittant un bloc ; un « plafond » peut
persister après un saut sous un bloc (saut suivant écourté) ; après la mort, le décor continue de
défiler tant que la touche reste enfoncée ; Mario reste jouable après la victoire et peut encore
être tué ; un ennemi mort peut changer d’orientation ; la boucle de collision des tortues commence
à `j = 1` ; après une pièce ramassée, la suivante n’est testée qu’au tour d’après.

## 5. Inventaire des ressources et vérification SHA-256

28 PNG (`src/images`) et 6 WAV (`src/audio`). Aucun fichier n’est converti, redimensionné, recoloré
ou remplacé. Les images sont décodées sans conversion d’espace colorimétrique ; leurs pixels sont
tous opaques ou transparents (aucune transparence partielle), d’où un rendu exact au pixel près.
Les sons sont lus depuis les octets PCM d’origine (8 ou 16 bits), sans ré-échantillonnage préalable.

Vérifications effectuées, toutes réussies :

| Comparaison                                                                | Résultat                                         |
| -------------------------------------------------------------------------- | ------------------------------------------------ |
| `src/` ↔ `bin/` du dépôt Java                                              | 34/34 identiques (aucun fichier propre à `bin/`) |
| dépôt Java ↔ `public/originaux` du projet                                  | 34/34 identiques                                 |
| manifeste ↔ `dist/` (à chaque `npm run build`)                             | 34/34 identiques                                 |
| octets servis en HTTP ↔ manifeste (test E2E)                               | 34/34 identiques                                 |
| SHA-256 calculé **dans le navigateur** sur les fichiers chargés par le jeu | 34/34 identiques                                 |
| dimensions décodées ↔ en-tête IHDR des PNG                                 | 28/28 identiques                                 |
| 2000 premiers échantillons décodés ↔ données PCM des WAV                   | 6/6 identiques                                   |

Empreintes (identiques dans `src/`, `bin/`, `public/originaux`, `dist/` et dans le navigateur) :

| Fichier                           | Format                                |  Octets | SHA-256                                                            |
| --------------------------------- | ------------------------------------- | ------: | ------------------------------------------------------------------ |
| src/images/bloc.png               | 30×30 px                              |    2579 | `922fd6921c427f3f5d4215a3686eb99e66d910137f53f4bd79d2d0b78474324c` |
| src/images/boom.png               | 63×50 px                              |    2256 | `1c8c23693a23786ae20e8faf75ca497459992febac2afc4d6959110d60741ab2` |
| src/images/champArretDroite.png   | 27×30 px                              |    1414 | `24f7c855972b0485ac2563a6b6276bffeae6e46c7459cb3137a160f0082209bb` |
| src/images/champArretGauche.png   | 27×30 px                              |    1416 | `7657cf2928e5a44b2a33ab727a3b8ea9d00fda4593d4e54badbafdbe28da9392` |
| src/images/champEcraseDroite.png  | 35×10 px                              |    1147 | `de02549ab53b17db1cc1e020f140e8e53a3a33a46ce4f8920e97a11764e5b3b9` |
| src/images/champEcraseGauche.png  | 35×10 px                              |    1148 | `fea64e17b0e24b8e77b742720cd8119bb39018724c95e00db09ae283b73810fe` |
| src/images/champMarcheDroite.png  | 27×30 px                              |    1509 | `34c77ebde96dc1acc29b1d769e02f0d8df89b65f6156586f6c5a03a8406fb786` |
| src/images/champMarcheGauche.png  | 27×30 px                              |    1511 | `a851b3cb0cd88225bfbb10bb13bd02b058cb8827cb8e37df366da40d46d0b034` |
| src/images/chateau1.png           | 172×200 px                            |   16034 | `59b76f92fc5f4f079f8ef6b8251b5493d734c9ee73d9fdd3f8e215e3f939a1d1` |
| src/images/chateauFin.png         | 124×150 px                            |    7404 | `aa4027402ae6b75610011feac3d5eddbb66ead66e2c53401870a4f8bb8e2d0cb` |
| src/images/depart.png             | 50×60 px                              |    1754 | `292d68323194b8c6348ba9493ac40b5e4ef63dcb78eff3a1117d8ac275d4a7f0` |
| src/images/drapeau.png            | 49×180 px                             |    1946 | `183e98e371d30bef8e45661850e72f9f379248eea1bee5da4cd19c3b0cd8d863` |
| src/images/fondEcran.png          | 800×350 px                            |  199166 | `699288376992a7b1374204c90c7ded5cae39433cf0eadbbb14899824d1aca374` |
| src/images/marioArretDroite.png   | 28×50 px                              |    1696 | `8a7d109bdab800d1ae381a81ee78d776346f9605d16f13d99d90c862281cb35b` |
| src/images/marioArretGauche.png   | 28×50 px                              |    1692 | `6584bd13ae8b613e105268bd83f5f263deeeffb34cb6aacec7034ed25c7925e8` |
| src/images/marioMarcheDroite.png  | 28×50 px                              |    1799 | `1bd3e92a54e9720d1f194b391ee59ded683d3cfc2a21f12eaa9ec5570409591f` |
| src/images/marioMarcheGauche.png  | 28×50 px                              |    1797 | `23333720f14024a91449ecd1adda2a778330a895da677555fc46494fd32caf12` |
| src/images/marioMeurt.png         | 42×50 px                              |    1924 | `e6a2b232afe0d5cbd7541aa58761b6ec703c6eeb38e950369ba32a0f4f90226a` |
| src/images/marioSautDroite.png    | 29×54 px                              |    1968 | `810125181ab5edd4c6e2e85ce08964f7dab5fa84c39a4a1ee0b5a18a988e2b3c` |
| src/images/marioSautGauche.png    | 29×54 px                              |    1970 | `75207dc487efd02e2a1319a8c44252a2a0f7b486c6df5c25fbd01f76b31ed351` |
| src/images/piece1.png             | 25×30 px                              |    1367 | `8e6781fdba72b2c34297b75ff26273edf46c6a3fd0899f21321931997fefb1a7` |
| src/images/piece2.png             | 23×27 px                              |    1246 | `9fb44702f9e65397faf647a43e713ae0d90b3e8506a928c9c8c4b19fe380a0ac` |
| src/images/tortueArretDroite.png  | 43×50 px                              |    1970 | `9c2b68a7f773dee6e98ae695defa019ba3b3d892913d75f365b379ff1a488081` |
| src/images/tortueArretGauche.png  | 43×50 px                              |    1973 | `626978e5e5ce9262ebe4ed8bf0e1f40edc064189e457b75202d138e1f88206ba` |
| src/images/tortueFermee.png       | 25×23 px                              |    1302 | `5883d05cc2dfa11e5a7a9bd4efb1b0e6198c18f080edd6e766881a69b06cf83f` |
| src/images/tortueMarcheDroite.png | 43×50 px                              |    1599 | `7a087413b201f2dc89dc2491efa07cf2b4045acc81942979d2d5c1942b547a93` |
| src/images/tortueMarcheGauche.png | 43×50 px                              |    1600 | `3c23328fac18ea0a67ef462c07f675d6e183f96abefd6a5a057073953ce2550c` |
| src/images/tuyauRouge.png         | 43×65 px                              |    1991 | `fb0c7546d1fdf776f4d5f2ad27d316648b7eb698a47f19f176a2e27d19834df5` |
| src/audio/boum.wav                | 1 canal, 44100 Hz, 16 bits, 0.70 s    |   61996 | `46727eb2d89bbafd42cc8f43611041d12a219a28bc0e3b154d417dfd45e709ee` |
| src/audio/ecrasePersonnage.wav    | 1 canal, 11025 Hz, 8 bits, 0.21 s     |    2360 | `55b55edd3778e7b95d38f37bbe4e7e7614c6ef7f1c89344ac86ab254cdcc48f0` |
| src/audio/partieGagnee.wav        | 2 canalaux, 44100 Hz, 16 bits, 6.49 s | 1145690 | `6f5cb2002c1be913565a5a3cf378107f409ae4faa84059db4e3eb93766a8d652` |
| src/audio/partiePerdue.wav        | 1 canal, 22050 Hz, 16 bits, 6.63 s    |  292616 | `a5efec02810a5acdca19c546f36fbf9f174a5ee8bc8d7869fa90996ccf39df87` |
| src/audio/piece.wav               | 2 canalaux, 44100 Hz, 16 bits, 1.10 s |  193938 | `888beb8291fed5bb7ac076de51f738bfa2819325e1bfe5a01a9cfd6ec97b312d` |
| src/audio/saut.wav                | 1 canal, 11025 Hz, 8 bits, 0.24 s     |    2725 | `81979d1da763c20985abdb996851c205603f28eed6ab0fd6f96c543c65dbcbb5` |

## 6. Fonctionnalités opérationnelles

- Accueil KABYLE SOLIDE : scène Three.js (les cinq solides de Platon, en bleu, vert et jaune),
  parallaxe au pointeur, pause hors écran et onglet masqué, image fixe si l’utilisateur préfère
  réduire les animations, repli sans WebGL ; navigation ; bouton « Jouer » ; carte du jeu générée
  depuis le catalogue.
- Page `/jeux/mario-ahmed-aberkan` : titre, jeu, Commencer / Recommencer, Rejouer en fin de partie,
  plein écran (API standard, préfixe WebKit, mode simulé sur iPhone), retour à l’accueil.
- Jeu : déplacements, sauts, blocs, tuyaux, plafonds, pièces animées, champignons et tortues
  (déplacement autonome, demi-tours, écrasement), mort (explosion puis envol), score, compte à
  rebours, victoire et défaite, 6 sons aux mêmes moments qu’en Java.
- Clavier fiable (écoute globale, sans défilement de page ni activation de bouton) ; commandes
  tactiles multi-touch affichées seulement sur écran tactile et pendant la partie ; paysage mobile
  optimisé (en-tête masqué, jeu sur toute la hauteur).

## 7. Tests réellement exécutés

Environnement : conteneur Linux, Node 22.23.4, JDK 21, Chromium (Playwright 1.63, sans GPU :
rendu logiciel).

**Fidélité (Vitest)** — 13 scénarios, 178 716 tours, 0 différence avec le Java. Sensibilité
vérifiée par mutation : modifier la cadence d’animation des pièces fait échouer 13 scénarios sur
13 ; modifier la règle du plafond en fait échouer 6.

**Moteur (Vitest)** — 10 tests : chaque correction comparée au comportement Java strict ;
316 tours/s identiques pour un écran à 60 Hz ou 144 Hz ; ennemis ≈ 66 px/s ; compte à rebours.

**Navigateur (Playwright, build de production)** — 40/40 réussis :

| #   | Vérification demandée          | Test                                                                                                                                                                 |
| --- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | le site se charge              | titre, contenu, aucune erreur console                                                                                                                                |
| 2   | la scène Three.js fonctionne   | WebGL actif, 7,9 % des pixels du héros dessinés par la 3D, animation, pause hors écran                                                                               |
| 3   | navigation vers le jeu         | bouton « Jouer », carte du catalogue, retours ; routes avec/sans `/` final ; 404                                                                                     |
| 4   | sprites originaux              | SHA-256 dans le navigateur ; **rendu identique au pixel près au Java** sur 6 images (départ, saut, explosion, envol, milieu de niveau, victoire)                     |
| 5   | proportions                    | 28 images aux dimensions d’origine ; rapport 2:1 et résolution multiple exacte de 700×350 à 4 tailles de fenêtre                                                     |
| 6   | gauche / droite                | clavier réel                                                                                                                                                         |
| 7   | saut                           | sommet ≈ y 85 (montée de 4 px × 40 tours ; trajectoire exacte vérifiée par les tests de fidélité), retour au sol, son                                                |
| 8   | collisions                     | arrêt contre le 1er tuyau (xPos 272), franchissement en sautant                                                                                                      |
| 9   | ennemis                        | ≈ 66 px/s, demi-tour contre un tuyau, champignon écrasé                                                                                                              |
| 10  | pièces                         | score 1, pièce retirée, son `piece.wav`                                                                                                                              |
| 11  | score et compte à rebours      | textes affichés, −1 par seconde réelle                                                                                                                               |
| 12  | défilement                     | positions du décor et du château                                                                                                                                     |
| 13  | sons                           | journal des sons, contexte audio déverrouillé, 6 sons décodés, échantillons identiques aux WAV, signal réel en sortie (crête 0,70), 10 sauts rapprochés sans blocage |
| 14  | défaite                        | par un ennemi (sons `boum` puis `partiePerdue`, message, Rejouer) et par le temps                                                                                    |
| 15  | victoire                       | parcours rejoué : 10 pièces, arrivée, « Vous avez gagné !! », `partieGagnee.wav` une fois                                                                            |
| 16  | nouvelle partie sans recharger | état réinitialisé, page non rechargée                                                                                                                                |
| 17  | plusieurs parties              | 5 parties d’affilée, aucune erreur, une seule boucle (cadence intacte)                                                                                               |
| 18  | plein écran                    | élément en plein écran, jeu agrandi sans déformation, jouable, sortie                                                                                                |
| 19  | pas de défilement involontaire | Espace et flèches sur une page défilable ; Espace avec le focus sur un bouton                                                                                        |
| 20  | fluidité                       | jeu : 60,2 images/s et 317 tours/s (ordinateur), 60,3 images/s et 317 tours/s (mobile émulé) ; accueil 3D : 56,5 et 60,5 images/s                                    |

Aussi testés : commandes tactiles (maintien de ▶, ◀, ▶ + Saut en multi-touch), cadrage portrait et
paysage, absence de débordement horizontal de 320 à 1920 px, focus après un clic ailleurs,
relâchement des touches à la perte de focus.

**Build** : `npm run build` (types + Vite + contrôle SHA-256 de `dist/`) réussi. Le routage façon
Vercel (`cleanUrls`, `trailingSlash`, réécriture, 404) a été simulé localement avec
`serve-handler`, la bibliothèque de routage statique de Vercel : `/jeux/mario-ahmed-aberkan` → 200,
avec `/` final → redirection 301, adresse inconnue → page 404 personnalisée.

## 8. Bugs restants et limites

- **Aucun bug connu** à l’issue des tests.
- Tests menés uniquement dans **Chromium** (ordinateur et mobile émulé) : Safari (macOS/iOS),
  Firefox et de vrais téléphones n’ont pas pu être testés ici.
- **Pas de déploiement Vercel réel** (non autorisé) : la configuration n’a été validée que par
  simulation ; les en-têtes de cache ne sont vérifiables qu’une fois déployé.
- **Vitesse de référence** : mesurée sur Linux avec le JDK 21. Le jeu Java tournait un peu plus ou
  moins vite selon la machine (par exemple sous Windows avec un JDK ancien, `Thread.sleep(3)` dure
  souvent plus longtemps). Une ligne à changer dans `config.ts` si la sensation diffère.
- **iPhone** : pas de plein écran natif pour un élément (mode simulé) ; le commutateur
  « silencieux » coupe les sons Web Audio.
- **Plein écran** sur un écran 16:9 : bandes noires en haut et en bas, inévitables sans déformer
  ni couper l’image 2:1.
- **Police** : Arial n’existe pas sur Android et sur certains Linux ; une police aux métriques
  identiques (Liberation Sans, Arimo) ou la police système la remplace.
- **Droits** : les images et sons du jeu semblent issus de l’univers Mario de Nintendo. Avant une
  mise en ligne publique, il est prudent de vérifier les droits d’utilisation.

## 9. Commandes

```bash
npm install              # dépendances
npm run dev              # développement : http://localhost:5173
npm run build            # build de production dans dist/
npm run preview          # prévisualisation du build : http://localhost:4173
npm test                 # fidélité au Java + tests du moteur
npx playwright install chromium && npm run test:e2e   # tests navigateur
npm run verify:assets    # contrôle SHA-256 des ressources
node outils/harnais-java/executer.mjs ../MarioJava    # régénère les références Java (JDK requis)
```
