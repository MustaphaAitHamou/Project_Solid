import { COULEUR_FOND_PANNEAU, HAUTEUR_JEU, LARGEUR_JEU } from '../config.ts';
import type { ListeDessin, NomImage } from '../engine/index.ts';
import type { RessourceImage } from './chargement.ts';

export const POLICES = '"Arial", "Liberation Sans", Arimo, Helvetica, sans-serif';
const FACTEUR_MAX = 6;

export function contexte2d(canvas: HTMLCanvasElement, opaque: boolean): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d', { alpha: !opaque });
  if (!ctx) throw new Error('Canvas 2D indisponible');
  return ctx;
}

/**
 * Facteur entier de rendu pour une largeur affichée (en pixels physiques) : multiple exact de
 * 700×350 si possible, sinon entier supérieur (le navigateur réduit alors légèrement l'image
 * avec un filtrage lissé : pixels nets et réguliers, sans scintillement pendant le défilement).
 */
export function facteurEntier(largeurPx: number): number {
  const f = Math.max(largeurPx, 1) / LARGEUR_JEU;
  const arrondi = Math.round(f);
  if (f <= 1) return 1;
  if (Math.abs(f - arrondi) < 0.01) return arrondi;
  return Math.min(FACTEUR_MAX, Math.ceil(f));
}

/**
 * Rendu du mode classique : la liste d'affichage produite par Scene.paintComponent() est
 * peinte DANS L'ORDRE des appels Java (images et textes mêlés : la ligne de crédit, dessinée
 * avant les sprites, passe par exemple sous Mario quand il s'envole).
 *
 * Chaque image originale est agrandie d'un facteur entier k au plus proche voisin, aux
 * coordonnées entières du Java multipliées par k : un pixel du PNG devient un carré de k×k
 * pixels, sans déformation (rapport 2:1 conservé). Les textes sont tracés à la résolution k avec
 * la police, la taille, la position et la couleur du Java.
 */
export class RenduCanvas {
  private readonly ecran: HTMLCanvasElement;
  private readonly ctxEcran: CanvasRenderingContext2D;
  private readonly logique: HTMLCanvasElement;
  private readonly ctxLogique: CanvasRenderingContext2D;
  private k = 1;
  private facteur = 1;
  private derniere: ListeDessin | null = null;
  private readonly images: Map<NomImage, RessourceImage>;

  constructor(ecran: HTMLCanvasElement, images: Map<NomImage, RessourceImage>) {
    this.ecran = ecran;
    this.images = images;
    this.ctxEcran = contexte2d(ecran, true);
    this.logique = document.createElement('canvas');
    this.logique.width = LARGEUR_JEU;
    this.logique.height = HAUTEUR_JEU;
    this.ctxLogique = contexte2d(this.logique, true);
    this.dimensionner(LARGEUR_JEU, HAUTEUR_JEU);
  }

  /**
   * Image logique 700×350 de la dernière liste dessinée, à l'échelle 1 et sans les textes
   * (tests : comparaison pixel à pixel avec le rendu du jeu Java).
   */
  get imageLogique(): HTMLCanvasElement {
    if (this.derniere) this.peindre(this.ctxLogique, this.derniere, 1, false);
    return this.logique;
  }

  /** Pixels physiques de l'écran par pixel du jeu. */
  get facteurAffichage(): number {
    return this.facteur;
  }

  /** Facteur entier de la résolution interne du canvas affiché. */
  get facteurInterne(): number {
    return this.k;
  }

  /** Adapte la résolution interne à la taille affichée, exprimée en pixels physiques. */
  dimensionner(largeurPx: number, _hauteurPx: number): void {
    this.facteur = Math.max(largeurPx, 1) / LARGEUR_JEU;
    this.k = facteurEntier(largeurPx);
    if (this.ecran.width !== LARGEUR_JEU * this.k) {
      this.ecran.width = LARGEUR_JEU * this.k;
      this.ecran.height = HAUTEUR_JEU * this.k;
    }
  }

  dessiner(liste: ListeDessin): void {
    this.derniere = liste;
    this.peindre(this.ctxEcran, liste, this.k, true);
  }

  private peindre(c: CanvasRenderingContext2D, liste: ListeDessin, k: number, avecTextes: boolean): void {
    // le contexte est partagé avec le rendu moderne : état remis à zéro
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.imageSmoothingEnabled = false;
    c.globalAlpha = 1;
    c.textAlign = 'left';
    // super.paintComponent(g) : fond du JPanel
    c.fillStyle = COULEUR_FOND_PANNEAU;
    c.fillRect(0, 0, LARGEUR_JEU * k, HAUTEUR_JEU * k);
    c.textBaseline = 'alphabetic';
    for (let i = 0; i < liste.longueur; i++) {
      const op = liste.operation(i);
      if (op.type === 'image') {
        const img = this.images.get(op.image);
        if (!img) throw new Error(`Image non chargée : ${op.image}`);
        // les images entièrement hors écran ne sont pas dessinées (sans effet visuel)
        if (op.x >= LARGEUR_JEU || op.y >= HAUTEUR_JEU || op.x + img.largeur <= 0 || op.y + img.hauteur <= 0) continue;
        c.drawImage(img.source, op.x * k, op.y * k, img.largeur * k, img.hauteur * k);
      } else if (avecTextes) {
        c.font = `${op.police.style === 1 ? 'bold ' : ''}${op.police.taille * k}px ${POLICES}`;
        c.fillStyle = op.couleur;
        c.fillText(op.texte, op.x * k, op.y * k);
      }
    }
  }
}
