import { Objet } from './Objet.ts';
import type { Scene } from './Scene.ts';
import type { NomImage } from './types.ts';

/** Portage de com.mosmos.objets.Bloc : objet fixe de 30×30. */
export class Bloc extends Objet {
  constructor(scene: Scene, x: number, y: number) {
    super(scene, x, y, 30, 30, 'bloc');
  }
}

/** Portage de com.mosmos.objets.TuyauRouge : objet fixe de 43×65. */
export class TuyauRouge extends Objet {
  constructor(scene: Scene, x: number, y: number) {
    super(scene, x, y, 43, 65, 'tuyauRouge');
  }
}

/**
 * Portage de com.mosmos.objets.Piece (30×30).
 * En Java, Piece implémente Runnable mais son thread n'est jamais démarré :
 * l'animation n'avance que par bouge(), appelé pendant le dessin (Scene.paintComponent).
 */
export class Piece extends Objet {
  private compteur = 0;

  constructor(scene: Scene, x: number, y: number) {
    super(scene, x, y, 30, 30, 'piece1');
  }

  getCompteur(): number {
    return this.compteur;
  }

  /** Mouvement de la pièce : piece1 pendant 99 tours, piece2 pendant 101 tours. */
  bouge(): NomImage {
    let str: NomImage;
    this.compteur++;
    if (Math.trunc(this.compteur / 100) === 0) {
      str = 'piece1';
    } else {
      str = 'piece2';
    }
    if (this.compteur === 200) {
      this.compteur = 0;
    }
    return str;
  }
}
