/**
 * Catalogue des jeux du site : source unique utilisée par l'accueil (cartes) et la navigation.
 * Pour ajouter un jeu : une entrée ici + une page HTML dans jeux/<slug>/index.html
 * (à déclarer dans PAGES de vite.config.ts).
 */
export interface FicheJeu {
  slug: string;
  titre: string;
  description: string;
  url: string;
  /** Vignette composée uniquement de ressources originales du jeu */
  vignette: { fond: string; sprite: string; largeurSprite: number; hauteurSprite: number };
  commandes: string;
}

const ORIGINAUX = '/originaux/mario-ahmed-aberkan/images';

export const CATALOGUE: FicheJeu[] = [
  {
    slug: 'mario-ahmed-aberkan',
    titre: 'Mario Ahmed Aberkan',
    description:
      'Le jeu de plateforme d’origine, porté de Java vers le Web à l’identique : mêmes images, mêmes sons, même niveau.',
    url: '/jeux/mario-ahmed-aberkan',
    vignette: {
      fond: `${ORIGINAUX}/fondEcran.png`,
      sprite: `${ORIGINAUX}/marioArretDroite.png`,
      largeurSprite: 28,
      hauteurSprite: 50,
    },
    commandes: '← → Espace',
  },
];
