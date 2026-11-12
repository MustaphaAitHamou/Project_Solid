import type { Scene } from './Scene.ts';
import type { NomImage } from './types.ts';

/** Portage de com.mosmos.objets.Objet. */
export class Objet {
  private largeur: number;
  private hauteur: number;
  private x: number;
  private y: number;
  protected imgObjet: NomImage;
  /** Remplace la référence statique Main.scene du Java. */
  protected readonly scene: Scene;

  constructor(scene: Scene, x: number, y: number, largeur: number, hauteur: number, img: NomImage) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.largeur = largeur;
    this.hauteur = hauteur;
    this.imgObjet = img;
  }

  getLargeur(): number {
    return this.largeur;
  }
  getHauteur(): number {
    return this.hauteur;
  }
  getX(): number {
    return this.x;
  }
  getY(): number {
    return this.y;
  }
  getImgObjet(): NomImage {
    return this.imgObjet;
  }

  setX(x: number): void {
    this.x = x;
  }
  setY(y: number): void {
    this.y = y;
  }

  deplacement(): void {
    if (this.scene.getxPos() >= 0) {
      this.x = this.x - this.scene.getDx();
    }
  }
}
