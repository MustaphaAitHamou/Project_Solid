import type { Objet } from './Objet.ts';
import type { Piece } from './objets.ts';
import { Personnage } from './Personnage.ts';
import type { Scene } from './Scene.ts';
import type { NomImage, NomPersonnage } from './types.ts';

/** Portage de com.mosmos.personnage.Mario (28×50). */
export class Mario extends Personnage {
  /** vrai si Mario saute */
  private saut: boolean;
  /** durée du saut et hauteur du saut */
  private compteurSaut: number;
  private compteurMort: number;

  constructor(scene: Scene, x: number, y: number) {
    super(scene, x, y, 28, 50);
    this.saut = false;
    this.compteurSaut = 0;
    this.compteurMort = 0;
  }

  isSaut(): boolean {
    return this.saut;
  }
  setSaut(saut: boolean): void {
    this.saut = saut;
  }
  getCompteurSaut(): number {
    return this.compteurSaut;
  }
  getCompteurMort(): number {
    return this.compteurMort;
  }

  /** Surcharge Java : Mario reste à l'arrêt hors de la zone de défilement (xPos <= 0 ou > 4430). */
  override marche(nom: NomPersonnage, frequence: number): NomImage {
    let str: NomImage;
    if (this.enMarche === false || this.scene.getxPos() <= 0 || this.scene.getxPos() > 4430) {
      if (this.versDroite === true) str = `${nom}ArretDroite`;
      else str = `${nom}ArretGauche`;
    } else {
      this.compteur++;
      if (Math.trunc(this.compteur / frequence) === 0) {
        // quotient de la division euclidienne de compteur par frequence
        if (this.versDroite === true) str = `${nom}ArretDroite`;
        else str = `${nom}ArretGauche`;
      } else {
        if (this.versDroite === true) str = `${nom}MarcheDroite`;
        else str = `${nom}MarcheGauche`;
      }
      if (this.compteur === 2 * frequence) this.compteur = 0;
    }
    return str;
  }

  /** Saut : montée de 4 px par tour pendant 40 tours (ou jusqu'au plafond), retombée de 1 px par tour. */
  saute(): NomImage {
    let str: NomImage;
    this.compteurSaut++;
    // Montée du saut
    if (this.compteurSaut <= 40) {
      if (this.getY() > this.scene.getHautPlafond()) this.setY(this.getY() - 4);
      else this.compteurSaut = 41;
      if (this.isVersDroite() === true) str = 'marioSautDroite';
      else str = 'marioSautGauche';
      // Retombée du saut
    } else if (this.getY() + this.getHauteur() < this.scene.getySol()) {
      this.setY(this.getY() + 1);
      if (this.isVersDroite() === true) str = 'marioSautDroite';
      else str = 'marioSautGauche';
      // Saut terminé
    } else {
      if (this.isVersDroite() === true) str = 'marioArretDroite';
      else str = 'marioArretGauche';
      this.saut = false;
      this.compteurSaut = 0;
    }
    return str;
  }

  /** Java : contact(Objet objet). L'ordre des tests (et des modifications de y) est conservé. */
  contactObjet(objet: Objet): void {
    // contact horizontal
    if (
      (this.contactAvantObjet(objet) === true && this.isVersDroite() === true) ||
      (this.contactArriereObjet(objet) === true && this.isVersDroite() === false)
    ) {
      this.scene.setDx(0);
      this.setMarche(false);
    }
    // contact avec un objet en dessous
    if (this.contactDessousObjet(objet) === true && this.saut === true) {
      // Mario saute sur un objet
      this.scene.setySol(objet.getY());
    } else if (this.contactDessousObjet(objet) === false) {
      // Mario tombe sur le sol initial
      this.scene.setySol(293); // altitude du sol initial
      if (this.saut === false) this.setY(243); // altitude initiale de Mario
    }
    // contact avec un objet au-dessus
    if (this.contactDessusObjet(objet) === true) {
      this.scene.setHautPlafond(objet.getY() + objet.getHauteur()); // le plafond devient le dessous de l'objet
    } else if (this.contactDessusObjet(objet) === false && this.saut === false) {
      this.scene.setHautPlafond(0); // altitude du plafond initial (ciel)
    }
  }

  /** Le contact avec une pièce n'a aucune répercussion sur Mario. */
  contactPiece(piece: Piece): boolean {
    if (
      this.contactArriereObjet(piece) === true ||
      this.contactAvantObjet(piece) === true ||
      this.contactDessousObjet(piece) === true ||
      this.contactDessusObjet(piece) === true
    ) {
      return true;
    }
    return false;
  }

  /** Java : contact(Personnage personnage). Contact latéral = mort de Mario ; par-dessus = ennemi écrasé. */
  contactPersonnage(personnage: Personnage): void {
    if (this.contactAvantPersonnage(personnage) === true || this.contactArrierePersonnage(personnage) === true) {
      this.setMarche(false);
      this.setVivant(false);
    } else if (this.contactDessousPersonnage(personnage) === true) {
      personnage.setMarche(false);
      personnage.setVivant(false);
    }
  }

  /** Mort : explosion (boom) pendant 100 tours, puis Mario s'envole d'1 px par tour. */
  meurt(): NomImage {
    let str: NomImage = 'boom';
    if (this.compteurMort === 0) {
      this.scene.audio.playSound('/audio/boum.wav');
    }
    if (this.compteurMort === 100) {
      this.scene.audio.playSound('/audio/partiePerdue.wav');
    }
    this.compteurMort++;
    if (this.compteurMort > 100) {
      str = 'marioMeurt';
      this.setY(this.getY() - 1);
    }
    return str;
  }
}
