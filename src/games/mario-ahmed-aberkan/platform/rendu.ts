import { COULEUR_FOND_PANNEAU, HAUTEUR_JEU, LARGEUR_JEU } from '../config.ts';
import type { ListeDessin, NomImage } from '../engine/index.ts';
import type { RessourceImage } from './chargement.ts';

const POLICES = '"Arial", "Liberation Sans", Arimo, Helvetica, sans-serif';
const FACTEUR_MAX = 6;

function contexte2d(canvas: HTMLCanvasElement, opaque: boolean): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d', { alpha: !opaque });
  if (!ctx) throw new Error('Canvas 2D indisponible');
  return ctx;
}

/**
 * Rendu de la liste d'affichage produite par Scene.paintComponent().
 *
 * 1. Les images originales sont dessinées à l'échelle 1:1 sur une image logique de 700×350 px,
 *    aux coordonnées entières du Java : chaque pixel est celui du PNG d'origine.
 * 2. Cette image est agrandie d'un facteur ENTIER k au plus proche voisin (pixels nets et tous de
 *    même taille, donc aucun scintillement pendant le défilement) dans le canvas affiché :
 *    - si la taille affichée est un multiple exact de 700×350 : k = ce multiple, rien d'autre ;
 *    - sinon k = facteur entier supérieur, et le navigateur réduit légèrement l'image à sa taille
 *      d'affichage avec un filtrage lissé (« sharp bilinear ») ;
 *    - écran plus petit que 700 px : k = 1, réduction lissée par le navigateur.
 *    Le rapport 2:1 est toujours conservé : aucune déformation.
 * 3. Les textes (score, temps, message de fin) sont tracés à la résolution k, avec la police,
 *    la taille et la position du Java multipliées par k.
 */
export class RenduCanvas {
  private readonly ecran: HTMLCanvasElement;
  private readonly ctxEcran: CanvasRenderingContext2D;
  private readonly logique: HTMLCanvasElement;
  private readonly ctxLogique: CanvasRenderingContext2D;
  private k = 1;
  private facteur = 1;
  private readonly images: Map<NomImage, RessourceImage>;

  constructor(ecran: HTMLCanvasElement, images: Map<NomImage, RessourceImage>) {
    this.ecran = ecran;
    this.images = images;
    this.ctxEcran = contexte2d(ecran, true);
    this.logique = document.createElement('canvas');
    this.logique.width = LARGEUR_JEU;
    this.logique.height = HAUTEUR_JEU;
    this.ctxLogique = contexte2d(this.logique, true);
    this.ctxLogique.imageSmoothingEnabled = false;
    this.dimensionner(LARGEUR_JEU, HAUTEUR_JEU);
  }

  /** Image logique 700×350 (pour les tests : comparaison pixel à pixel avec le Java). */
  get imageLogique(): HTMLCanvasElement {
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
    const arrondi = Math.round(this.facteur);
    if (this.facteur <= 1) this.k = 1;
    else if (Math.abs(this.facteur - arrondi) < 0.01) this.k = arrondi;
    else this.k = Math.min(FACTEUR_MAX, Math.ceil(this.facteur));
    if (this.ecran.width !== LARGEUR_JEU * this.k) {
      this.ecran.width = LARGEUR_JEU * this.k;
      this.ecran.height = HAUTEUR_JEU * this.k;
    }
  }

  dessiner(liste: ListeDessin): void {
    const c = this.ctxLogique;
    // super.paintComponent(g) : fond du JPanel
    c.fillStyle = COULEUR_FOND_PANNEAU;
    c.fillRect(0, 0, LARGEUR_JEU, HAUTEUR_JEU);
    for (let i = 0; i < liste.longueur; i++) {
      const op = liste.operation(i);
      if (op.type !== 'image') continue;
      const img = this.images.get(op.image);
      if (!img) throw new Error(`Image non chargée : ${op.image}`);
      // les images entièrement hors écran ne sont pas dessinées (sans effet visuel)
      if (op.x >= LARGEUR_JEU || op.y >= HAUTEUR_JEU || op.x + img.largeur <= 0 || op.y + img.hauteur <= 0) continue;
      c.drawImage(img.source, op.x, op.y, img.largeur, img.hauteur);
    }

    // Agrandissement entier au plus proche voisin
    const e = this.ctxEcran;
    const k = this.k;
    e.imageSmoothingEnabled = false;
    e.drawImage(this.logique, 0, 0, LARGEUR_JEU * k, HAUTEUR_JEU * k);

    // Textes (drawString) : après les images, comme en Java
    for (let i = 0; i < liste.longueur; i++) {
      const op = liste.operation(i);
      if (op.type !== 'texte') continue;
      e.font = `${op.police.style === 1 ? 'bold ' : ''}${op.police.taille * k}px ${POLICES}`;
      e.fillStyle = op.couleur;
      e.textBaseline = 'alphabetic';
      e.fillText(op.texte, op.x * k, op.y * k);
    }
  }
}
