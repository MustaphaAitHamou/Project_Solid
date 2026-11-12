import { COULEUR_TEXTE } from '../config.ts';
import type { Graphiques, NomImage, Police } from './types.ts';

/** Opération de dessin enregistrée (forme unique pour rester rapide : ~45 opérations × 316 tours/s). */
export interface OperationDessin {
  /** 'image' : drawImage(img, x, y) ; 'texte' : drawString(str, x, y) */
  type: 'image' | 'texte';
  image: NomImage;
  texte: string;
  x: number;
  y: number;
  police: Police;
  couleur: string;
}

/** Police par défaut du JPanel (Dialog 12) avant tout setFont(). */
const POLICE_COMPOSANT: Police = { nom: 'Dialog', style: 0, taille: 12 };

/**
 * Implémentation de Graphiques qui enregistre les appels de dessin d'un tour de paintComponent().
 * Les objets sont réutilisés d'un tour à l'autre pour ne pas solliciter le ramasse-miettes.
 */
export class ListeDessin implements Graphiques {
  private readonly reserve: OperationDessin[] = [];
  private nb = 0;
  private police: Police = POLICE_COMPOSANT;
  private couleur = COULEUR_TEXTE;

  get longueur(): number {
    return this.nb;
  }

  operation(i: number): OperationDessin {
    return this.reserve[i];
  }

  *[Symbol.iterator](): IterableIterator<OperationDessin> {
    for (let i = 0; i < this.nb; i++) yield this.reserve[i];
  }

  vider(): void {
    this.nb = 0;
    this.police = POLICE_COMPOSANT;
    this.couleur = COULEUR_TEXTE;
  }

  private suivante(): OperationDessin {
    let op = this.reserve[this.nb];
    if (!op) {
      op = { type: 'image', image: 'fondEcran', texte: '', x: 0, y: 0, police: POLICE_COMPOSANT, couleur: '' };
      this.reserve.push(op);
    }
    this.nb++;
    return op;
  }

  drawImage(img: NomImage, x: number, y: number): void {
    const op = this.suivante();
    op.type = 'image';
    op.image = img;
    op.x = x;
    op.y = y;
  }

  setFont(police: Police): void {
    this.police = police;
  }

  drawString(str: string, x: number, y: number): void {
    const op = this.suivante();
    op.type = 'texte';
    op.texte = str;
    op.x = x;
    op.y = y;
    op.police = this.police;
    op.couleur = this.couleur;
  }
}
