import type { Direction, Touche } from '../engine/types.ts';
import { creerMonde, etape, type Entree, type EtatMonde, type SonsModernes } from './monde.ts';
import { PAS } from './reglages.ts';

const SONS_MUETS: SonsModernes = { jouer() {}, musique() {} };

/**
 * Une partie du mode Moderne : le monde + une horloge à pas fixe (120 Hz). L'affichage, à la
 * fréquence de l'écran, interpole entre les deux derniers pas (`alpha`) : mouvement fluide à
 * 60, 120 ou 144 Hz, comportement identique quelle que soit la machine.
 */
export class PartieModerne {
  readonly monde: EtatMonde;
  private readonly sons: SonsModernes;
  private reste = 0;
  private pas = 0;
  private readonly entree: Entree = { gauche: false, droite: false, saut: false, sautAppuye: false };
  private readonly directions: Direction[] = [];

  constructor(sons: SonsModernes = SONS_MUETS, graine = 1) {
    this.sons = sons;
    this.monde = creerMonde(graine);
  }

  /** Avance de `dureeMs` millisecondes de temps réel. Renvoie le nombre de pas exécutés. */
  avancer(dureeMs: number): number {
    this.reste += Math.max(0, dureeMs) / 1000;
    let n = 0;
    while (this.reste >= PAS) {
      this.executerPas();
      this.reste -= PAS;
      n++;
    }
    return n;
  }

  /** Exécute un pas de simulation (tests et rejeu déterministe). */
  executerPas(): void {
    this.majDirection();
    etape(this.monde, this.entree, PAS, this.sons);
    this.entree.sautAppuye = false;
    this.pas++;
  }

  get nbPas(): number {
    return this.pas;
  }

  /** Position entre les deux derniers pas (0 à 1), pour l'interpolation de l'affichage. */
  get alpha(): number {
    return Math.min(1, this.reste / PAS);
  }

  toucheEnfoncee(t: Touche): void {
    if (t === 'ESPACE') {
      if (!this.entree.saut) this.entree.sautAppuye = true;
      this.entree.saut = true;
    } else if (!this.directions.includes(t)) {
      this.directions.push(t);
    }
  }

  toucheRelachee(t: Touche): void {
    if (t === 'ESPACE') this.entree.saut = false;
    else {
      const i = this.directions.indexOf(t);
      if (i >= 0) this.directions.splice(i, 1);
    }
  }

  relacherTout(): void {
    this.directions.length = 0;
    this.entree.saut = false;
  }

  getTouchesMaintenues(): Touche[] {
    return this.entree.saut ? [...this.directions, 'ESPACE'] : [...this.directions];
  }

  /** La dernière flèche enfoncée l'emporte (comme le mode classique corrigé). */
  private majDirection(): void {
    const d = this.directions[this.directions.length - 1];
    this.entree.gauche = d === 'GAUCHE';
    this.entree.droite = d === 'DROITE';
  }
}
