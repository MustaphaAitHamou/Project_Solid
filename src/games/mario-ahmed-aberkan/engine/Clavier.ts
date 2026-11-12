import type { Corrections } from '../config.ts';
import type { Scene } from './Scene.ts';
import type { Touche } from './types.ts';

/** Portage de com.mosmos.jeu.Clavier (KeyListener). */
export class Clavier {
  private readonly scene: Scene;
  private readonly corrections: Corrections;

  constructor(scene: Scene, corrections: Corrections) {
    this.scene = scene;
    this.corrections = corrections;
  }

  keyPressed(code: Touche): void {
    const scene = this.scene;
    if (scene.mario.isVivant() === true) {
      if (code === 'DROITE') {
        // Annule le décalage de 1 créé par deplacementFond
        if (scene.getxPos() === -1) {
          scene.setxPos(0);
          scene.setxFond1(-50);
          scene.setxFond2(750);
        }
        scene.mario.setMarche(true);
        scene.mario.setVersDroite(true);
        scene.setDx(1);
      } else if (code === 'GAUCHE') {
        if (scene.getxPos() === 4431) {
          if (this.corrections.retourDepuisLaFinDuNiveau) {
            // Correction (voir config.ts) : annule le décalage de 1 créé par deplacementFond
            scene.setxPos(4430);
            scene.setxFond1(scene.getxFond1() + 1);
            scene.setxFond2(scene.getxFond2() + 1);
          } else {
            // Code Java d'origine, reproduit tel quel
            scene.setxPos(4430);
            scene.setxPos(-50);
            scene.setxPos(750);
          }
        }
        scene.mario.setMarche(true);
        scene.mario.setVersDroite(false);
        scene.setDx(-1);
      }

      if (code === 'ESPACE') {
        scene.mario.setSaut(true);
        scene.audio.playSound('/audio/saut.wav');
      }
    }
  }

  /** En Java, relâcher n'importe quelle touche arrête Mario. */
  keyReleased(_code: Touche): void {
    this.scene.mario.setMarche(false);
    this.scene.setDx(0);
  }
}
