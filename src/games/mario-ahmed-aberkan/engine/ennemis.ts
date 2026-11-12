import type { Objet } from './Objet.ts';
import { Personnage } from './Personnage.ts';
import type { Scene } from './Scene.ts';
import type { NomImage } from './types.ts';

/**
 * Comportement commun de Champ.java et Tortue.java (les deux classes Java sont identiques
 * à la taille et aux images près).
 *
 * En Java, chaque ennemi possède son propre Thread : `sleep(20)` puis, tant qu'il est vivant,
 * `bouge(); sleep(15);`. Ici, c'est l'horloge de Partie qui appelle bouge() aux mêmes instants.
 */
abstract class Ennemi extends Personnage {
  /** pas de déplacement (dxChamp / dxTortue) */
  protected dxEnnemi: number;

  constructor(scene: Scene, x: number, y: number, largeur: number, hauteur: number) {
    super(scene, x, y, largeur, hauteur);
    this.setVersDroite(true);
    this.setMarche(true);
    this.dxEnnemi = 1;
  }

  /** Déplacement autonome (appelé toutes les 15 ms par l'horloge, comme le thread Java). */
  bouge(): void {
    if (this.isVersDroite() === true) this.dxEnnemi = 1;
    else this.dxEnnemi = -1;
    this.setX(this.getX() + this.dxEnnemi);
  }

  /** Java : contact(Objet objet) — demi-tour contre un objet. */
  contactObjet(objet: Objet): void {
    if (this.contactAvantObjet(objet) === true && this.isVersDroite() === true) {
      this.setVersDroite(false);
      this.dxEnnemi = -1;
    } else if (this.contactArriereObjet(objet) === true && this.isVersDroite() === false) {
      this.setVersDroite(true);
      this.dxEnnemi = 1;
    }
  }

  /** Java : contact(Personnage personnage) — demi-tour contre un autre ennemi. */
  contactPersonnage(personnage: Personnage): void {
    if (this.contactAvantPersonnage(personnage) === true && this.isVersDroite() === true) {
      this.setVersDroite(false);
      this.dxEnnemi = -1;
    } else if (this.contactArrierePersonnage(personnage) === true && this.isVersDroite() === false) {
      this.setVersDroite(true);
      this.dxEnnemi = 1;
    }
  }

  abstract meurt(): NomImage;
}

/** Portage de com.mosmos.personnage.Champ (27×30). */
export class Champ extends Ennemi {
  constructor(scene: Scene, x: number, y: number) {
    super(scene, x, y, 27, 30);
  }

  meurt(): NomImage {
    this.dxEnnemi = 0;
    if (this.isVersDroite() === true) return 'champEcraseDroite';
    return 'champEcraseGauche';
  }
}

/** Portage de com.mosmos.personnage.Tortue (43×50). */
export class Tortue extends Ennemi {
  constructor(scene: Scene, x: number, y: number) {
    super(scene, x, y, 43, 50);
  }

  meurt(): NomImage {
    return 'tortueFermee';
  }
}
