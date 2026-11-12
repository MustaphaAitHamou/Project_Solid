import type { Objet } from './Objet.ts';
import type { Scene } from './Scene.ts';
import type { NomImage, NomPersonnage } from './types.ts';

/**
 * Portage de com.mosmos.personnage.Personnage.
 *
 * Java surcharge contactAvant/contactArriere/contactDessous/proche selon le type statique
 * de l'argument (Objet ou Personnage), avec des règles DIFFÉRENTES. TypeScript n'ayant pas
 * de surcharge, chaque variante porte un nom explicite : ...Objet() / ...Personnage().
 */
export class Personnage {
  private largeur: number;
  private hauteur: number;
  private x: number;
  private y: number;
  /** Java : `protected boolean marche` (renommé : un champ ne peut pas porter le nom de la méthode marche()). */
  protected enMarche: boolean;
  protected versDroite: boolean;
  public compteur: number;
  protected vivant: boolean;
  /** Remplace la référence statique Main.scene du Java. */
  protected readonly scene: Scene;

  constructor(scene: Scene, x: number, y: number, largeur: number, hauteur: number) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.largeur = largeur;
    this.hauteur = hauteur;
    this.compteur = 0;
    this.enMarche = false;
    this.versDroite = true;
    this.vivant = true;
  }

  // **** GETTERS ****
  getX(): number {
    return this.x;
  }
  getY(): number {
    return this.y;
  }
  getLargeur(): number {
    return this.largeur;
  }
  getHauteur(): number {
    return this.hauteur;
  }
  isMarche(): boolean {
    return this.enMarche;
  }
  isVersDroite(): boolean {
    return this.versDroite;
  }
  getCompteur(): number {
    return this.compteur;
  }
  isVivant(): boolean {
    return this.vivant;
  }

  // **** SETTERS ****
  setX(x: number): void {
    this.x = x;
  }
  setY(y: number): void {
    this.y = y;
  }
  setMarche(marche: boolean): void {
    this.enMarche = marche;
  }
  setVersDroite(versDroite: boolean): void {
    this.versDroite = versDroite;
  }
  setCompteur(compteur: number): void {
    this.compteur = compteur;
  }
  setVivant(vivant: boolean): void {
    this.vivant = vivant;
  }

  // **** METHODES ****
  /** Image de marche : « Arret » pendant frequence-1 tours, puis « Marche » jusqu'à 2×frequence. */
  marche(nom: NomPersonnage, frequence: number): NomImage {
    let str: NomImage;
    if (this.enMarche === false) {
      if (this.versDroite === true) str = `${nom}ArretDroite`;
      else str = `${nom}ArretGauche`;
    } else {
      this.compteur++;
      // Division entière Java : quotient de compteur par frequence
      if (Math.trunc(this.compteur / frequence) === 0) {
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

  deplacement(): void {
    if (this.scene.getxPos() >= 0) this.x = this.x - this.scene.getDx();
  }

  // Détection contact à droite (variante Objet)
  protected contactAvantObjet(objet: Objet): boolean {
    if (
      this.x + this.largeur < objet.getX() ||
      this.x + this.largeur > objet.getX() + 5 ||
      this.y + this.hauteur <= objet.getY() ||
      this.y >= objet.getY() + objet.getHauteur()
    ) {
      return false;
    }
    return true;
  }

  // Détection contact à gauche (variante Objet)
  protected contactArriereObjet(objet: Objet): boolean {
    if (
      this.x > objet.getX() + objet.getLargeur() ||
      this.x + this.largeur < objet.getX() + objet.getLargeur() - 5 ||
      this.y + this.hauteur <= objet.getY() ||
      this.y >= objet.getY() + objet.getHauteur()
    ) {
      return false;
    }
    return true;
  }

  // Détection contact en dessous (variante Objet)
  protected contactDessousObjet(objet: Objet): boolean {
    if (
      this.x + this.largeur < objet.getX() + 5 ||
      this.x > objet.getX() + objet.getLargeur() - 5 ||
      this.y + this.hauteur < objet.getY() ||
      this.y + this.hauteur > objet.getY() + 5
    ) {
      return false;
    }
    return true;
  }

  // Détection contact au-dessus (variante Objet)
  protected contactDessusObjet(objet: Objet): boolean {
    if (
      this.x + this.largeur < objet.getX() + 5 ||
      this.x > objet.getX() + objet.getLargeur() - 5 ||
      this.y < objet.getY() + objet.getHauteur() ||
      this.y > objet.getY() + objet.getHauteur() + 5
    ) {
      return false;
    }
    return true;
  }

  procheObjet(objet: Objet): boolean {
    if (
      (this.x > objet.getX() - 10 && this.x < objet.getX() + objet.getLargeur() + 10) ||
      (this.x + this.largeur > objet.getX() - 10 && this.x + this.largeur < objet.getX() + objet.getLargeur() + 10)
    ) {
      return true;
    }
    return false;
  }

  // Variante Personnage : ne détecte un contact avant que si l'on est tourné vers la droite
  protected contactAvantPersonnage(personnage: Personnage): boolean {
    if (this.isVersDroite() === true) {
      if (
        this.x + this.largeur < personnage.getX() ||
        this.x + this.largeur > personnage.getX() + 5 ||
        this.y + this.hauteur <= personnage.getY() ||
        this.y >= personnage.getY() + personnage.getHauteur()
      ) {
        return false;
      }
      return true;
    }
    return false;
  }

  protected contactArrierePersonnage(personnage: Personnage): boolean {
    if (
      this.x > personnage.getX() + personnage.getLargeur() ||
      this.x + this.largeur < personnage.getX() + personnage.getLargeur() - 5 ||
      this.y + this.hauteur <= personnage.getY() ||
      this.y >= personnage.getY() + personnage.getHauteur()
    ) {
      return false;
    }
    return true;
  }

  protected contactDessousPersonnage(personnage: Personnage): boolean {
    if (
      this.x + this.largeur < personnage.getX() ||
      this.x > personnage.getX() + personnage.getLargeur() ||
      this.y + this.hauteur < personnage.getY() ||
      this.y + this.hauteur > personnage.getY()
    ) {
      return false;
    }
    return true;
  }

  prochePersonnage(personnage: Personnage): boolean {
    if (
      (this.x > personnage.getX() - 10 && this.x < personnage.getX() + personnage.getLargeur() + 10) ||
      (this.x + this.largeur > personnage.getX() - 10 &&
        this.x + this.largeur < personnage.getX() + personnage.getLargeur() + 10)
    ) {
      return true;
    }
    return false;
  }
}
