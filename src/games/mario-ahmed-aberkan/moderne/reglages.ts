/**
 * Réglages du mode Moderne. Même niveau, mêmes images, mêmes sons et mêmes règles que le jeu
 * Java ; seules les sensations changent (physique continue, inertie, saut modulable, caméra
 * fluide, effets). Les valeurs de référence du Java sont rappelées en commentaire.
 */

/** Pas de simulation (s) : 120 Hz, indépendant de l'écran ; l'affichage interpole entre deux pas. */
export const PAS = 1 / 120;

/** Vue : 700 × 350 px du jeu, comme le JPanel Java (le décor fait 350 px de haut). */
export const VUE = { largeur: 700, hauteur: 350 } as const;
/** Sol : Java `ySol = 293` (dessous de Mario). */
export const SOL = 293;
/** Niveau : du château de départ (x 10) au château d'arrivée (x 5000 + 124 px). */
export const NIVEAU_LARGEUR = 5124;

/** Mario : sprite 28 × 50 ; boîte de collision un peu plus étroite, plus tolérante. */
export const JOUEUR = {
  largeur: 28,
  hauteur: 50,
  boite: { dx: 4, dy: 6, largeur: 20, hauteur: 44 },
} as const;

export const PHYSIQUE = {
  /** Java : 1 px par tour à 316,5 tours/s ≈ 316 px/s, sans inertie */
  vitesseMax: 330,
  accelSol: 2600,
  decelSol: 3200,
  accelAir: 1900,
  decelAir: 900,
  /** freinage quand on change de sens (petit dérapage) */
  freinDemiTour: 4600,
  /** Java : montée de 4 px × 40 tours = 160 px en 0,64 s ; ici ≈ 165 px bouton maintenu, ≈ 70 px en appui bref */
  vitesseSaut: 915,
  gravite: 2500,
  graviteRelache: 6000,
  graviteChute: 3300,
  /** au sommet du saut (|vy| < seuil, bouton maintenu), gravité réduite : petit temps suspendu */
  sommetSeuil: 90,
  sommetFacteur: 0.55,
  chuteMax: 1150,
  /** saut encore permis peu après avoir quitté un rebord */
  coyote: 0.09,
  /** appui sur Saut mémorisé juste avant d'atterrir */
  tamponSaut: 0.13,
  /** rebond après avoir écrasé un ennemi (plus haut si Saut est maintenu) */
  rebond: 560,
  rebondTenu: 840,
  /** glissement automatique quand la tête frôle le coin d'un bloc */
  correctionCoin: 7,
} as const;

export const ENNEMIS = {
  /** Java : 1 px toutes les 15,12 ms ≈ 66 px/s */
  vitesse: 66,
  champ: { largeur: 27, hauteur: 30 },
  /** (en Java, la tortue garde une boîte de 43 px de large pour un sprite de 28 px) */
  tortue: { largeur: 28, hauteur: 50 },
  /** marge de tolérance de la zone qui blesse Mario */
  marge: 3,
  /** tolérance (px) pour réussir un écrasement par-dessus */
  toleranceEcrasement: 12,
} as const;

/** Durées (s) */
export const DUREES = {
  /** Java : CompteARebours démarre à 100 */
  partie: 100,
  intro: 0.8,
  /** Java : explosion (boom.png) pendant 100 tours ≈ 0,32 s, puis partiePerdue.wav */
  explosion: 0.32,
  disparitionChampEcrase: 0.9,
  disparitionCarapace: 1.8,
  gelEcrasement: 0.06,
  gelMort: 0.14,
  bosseBloc: 0.16,
} as const;

/** Fin du niveau : mât du drapeau (drapeau.png en x 4650, mât aux colonnes 31 à 33). */
export const MAT_X = 4681;
/** Porte du château d'arrivée (chateauFin.png en x 5000, porte centrée sur la colonne 54). */
export const PORTE_X = 5054;

export const SCORE = { piece: 100, ecrasement: 200, bonusParSeconde: 50 } as const;

/** Parallaxe du ciel (collines, nuages) par rapport au premier plan. */
export const PARALLAXE_CIEL = 0.45;
