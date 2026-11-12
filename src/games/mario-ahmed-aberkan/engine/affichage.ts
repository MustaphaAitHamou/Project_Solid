/** Portage de com.mosmos.affichage.Score. */
export class Score {
  private readonly NB_TOTAL_PIECES = 10;
  private nbPieces: number;

  constructor() {
    this.nbPieces = 0;
  }

  getNbPieces(): number {
    return this.nbPieces;
  }
  getNB_TOTAL_PIECES(): number {
    return this.NB_TOTAL_PIECES;
  }
  setNbPieces(nbPieces: number): void {
    this.nbPieces = nbPieces;
  }
}

/**
 * Portage de com.mosmos.affichage.CompteARebours.
 * En Java, un thread exécute `sleep(1000); compteurTemps--; str = ...` en boucle infinie :
 * ici, c'est l'horloge de Partie qui appelle tourDeBoucle() à la même cadence.
 */
export class CompteARebours {
  private compteurTemps: number;
  private str: string;

  constructor() {
    this.compteurTemps = 100;
    this.str = 'Temps restant : 100';
  }

  getCompteurTemps(): number {
    return this.compteurTemps;
  }
  getStr(): string {
    return this.str;
  }

  /** Corps de la boucle de CompteARebours.run(), exécuté après chaque Thread.sleep(1000). */
  tourDeBoucle(): void {
    this.compteurTemps--;
    this.str = 'Temps restant : ' + this.compteurTemps;
  }
}
