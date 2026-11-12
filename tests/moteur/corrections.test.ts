/**
 * Tests du mode par défaut (CORRECTIONS_PAR_DEFAUT) : chaque correction documentée dans config.ts
 * est vérifiée, et comparée au comportement Java strict (AUCUNE_CORRECTION) qu'elle remplace.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  AUCUNE_CORRECTION,
  CORRECTIONS_PAR_DEFAUT,
  type Corrections,
} from '../../src/games/mario-ahmed-aberkan/config.ts';
import { Partie } from '../../src/games/mario-ahmed-aberkan/engine/index.ts';
import { lireScenario, type Scenario } from '../fidelite/trace.ts';

const scenario = (nom: string): Scenario =>
  lireScenario(readFileSync(join(import.meta.dirname, '../fidelite/scenarios', `${nom}.txt`), 'utf8'));

function tours(p: Partie, n: number): void {
  for (let i = 0; i < n; i++) p.executerTour();
}

/** Rejoue des entrées KeyListener brutes, tour par tour. */
function rejouer(sc: Scenario, corrections: Corrections, jusquAu = sc.ticks): Partie {
  const p = new Partie({ corrections });
  for (let tick = 1; tick <= jusquAu; tick++) {
    p.executerTour(() => {
      for (const e of sc.entrees.get(tick) ?? []) {
        if (e.action === 'appui') p.clavier.keyPressed(e.touche);
        else p.clavier.keyReleased(e.touche);
      }
    });
  }
  return p;
}

describe('Correction « maintien des touches »', () => {
  it('flèche droite maintenue + appui bref sur Espace : Mario saute par-dessus le tuyau', () => {
    for (const [corrections, attendu] of [
      [CORRECTIONS_PAR_DEFAUT, 'franchit'],
      [AUCUNE_CORRECTION, 'bloqué'],
    ] as const) {
      const p = new Partie({ corrections });
      p.toucheEnfoncee('DROITE');
      tours(p, 400); // bloqué par le premier tuyau
      expect(p.scene.getxPos()).toBe(272);
      p.toucheEnfoncee('ESPACE');
      tours(p, 10);
      p.toucheRelachee('ESPACE'); // la flèche droite reste enfoncée
      tours(p, 300);
      if (attendu === 'franchit') expect(p.scene.getxPos()).toBeGreaterThan(272 + 43);
      else expect(p.scene.getxPos()).toBe(272); // Java : relâcher Espace arrête Mario
    }
  });

  it('sauter en courant : le relâchement d’Espace n’arrête plus la course', () => {
    const deplacement = (corrections: Corrections): number => {
      const p = new Partie({ corrections });
      p.toucheEnfoncee('DROITE');
      tours(p, 50);
      p.toucheEnfoncee('ESPACE');
      tours(p, 5);
      p.toucheRelachee('ESPACE');
      const x0 = p.scene.getxPos();
      tours(p, 100);
      return p.scene.getxPos() - x0;
    };
    // Corrigé : Mario continue d'avancer (freiné quelques tours par le côté du bloc 1, comme en Java)
    expect(deplacement(CORRECTIONS_PAR_DEFAUT)).toBeGreaterThan(85);
    // Java strict : relâcher Espace arrête net le déplacement
    expect(deplacement(AUCUNE_CORRECTION)).toBe(0);
  });

  it('relâcher la flèche arrête Mario ; les deux flèches : la dernière enfoncée gagne', () => {
    const p = new Partie();
    p.toucheEnfoncee('DROITE');
    tours(p, 50);
    p.toucheRelachee('DROITE');
    const x0 = p.scene.getxPos();
    tours(p, 30);
    expect(p.scene.getxPos()).toBe(x0);
    p.toucheEnfoncee('DROITE');
    p.toucheEnfoncee('GAUCHE');
    tours(p, 20);
    expect(p.scene.getxPos()).toBe(x0 - 20);
    p.toucheRelachee('GAUCHE'); // la droite est toujours tenue
    tours(p, 20);
    expect(p.scene.getxPos()).toBe(x0);
  });

  it('les répétitions d’appui ne relancent ni le saut ni son son', () => {
    const sons: string[] = [];
    const p = new Partie({ audio: { playSound: (s) => sons.push(s) } });
    p.toucheEnfoncee('ESPACE');
    p.toucheEnfoncee('ESPACE');
    p.toucheEnfoncee('ESPACE');
    tours(p, 400);
    expect(sons).toEqual(['/audio/saut.wav']);
    expect(p.scene.mario.isSaut()).toBe(false);
  });
});

describe('Correction « retour depuis la fin du niveau »', () => {
  const sc = scenario('fin-de-niveau-gauche');

  it('Java strict : flèche gauche à xPos 4431 envoie xPos à 750 (bug d’origine)', () => {
    const p = rejouer(sc, AUCUNE_CORRECTION, 5000);
    expect(p.scene.getxPos()).toBe(749);
  });

  it('corrigé : xPos repart de 4430 et le décor reste cohérent (drapeau, château)', () => {
    const avant = rejouer(sc, CORRECTIONS_PAR_DEFAUT, 4999);
    expect(avant.scene.getxPos()).toBe(4431);
    const p = rejouer(sc, CORRECTIONS_PAR_DEFAUT, 5000);
    expect(p.scene.getxPos()).toBe(4429);
    expect(p.scene.getxFond1()).toBe(avant.scene.getxFond1() + 2);
    const drapeau = [...p.image].find((op) => op.image === 'drapeau');
    expect(drapeau?.x).toBe(4650 - 4429);
  });
});

describe('Correction « compte à rebours figé en fin de partie »', () => {
  it('victoire puis attente : reste « Vous avez gagné !! » (Java : devient « perdu » à 0 s)', () => {
    const sc = scenario('victoire-puis-attente');
    const texteFin = (p: Partie): string | undefined =>
      [...p.image].find((op) => op.type === 'texte' && op.police.taille === 50)?.texte;

    const corrige = rejouer(sc, CORRECTIONS_PAR_DEFAUT);
    expect(texteFin(corrige)).toBe('Vous avez gagné !!');
    expect(corrige.scene.getCompteARebours().getCompteurTemps()).toBe(86);
    expect(corrige.getPremierResultat()).toBe('gagnee');

    const java = rejouer(sc, AUCUNE_CORRECTION);
    expect(texteFin(java)).toBe('Vous avez perdu...');
    expect(java.scene.getCompteARebours().getCompteurTemps()).toBe(-9);
  });

  it('après la mort de Mario, le temps cesse de défiler', () => {
    const sc = scenario('aleatoire-37');
    const p = rejouer(sc, CORRECTIONS_PAR_DEFAUT);
    expect(p.getPremierResultat()).toBe('perdue');
    const temps = p.scene.getCompteARebours().getCompteurTemps();
    tours(p, 2000);
    expect(p.scene.getCompteARebours().getCompteurTemps()).toBe(temps);
    expect(temps).toBeGreaterThan(90);
  });
});

describe('Horloge (cadences mesurées du jeu Java)', () => {
  it('≈316 tours de paintComponent par seconde, indépendamment du découpage du temps', () => {
    const a = new Partie();
    const b = new Partie();
    let na = 0;
    let nb = 0;
    for (let i = 0; i < 60; i++) na += a.avancer(1000 / 60); // écran 60 Hz
    for (let i = 0; i < 144; i++) nb += b.avancer(1000 / 144); // écran 144 Hz
    expect(na).toBe(316);
    expect(nb).toBe(na);
  });

  it('les ennemis font ≈66 pas par seconde, le compte à rebours décompte 1 par seconde', () => {
    const p = new Partie();
    const x0 = p.scene.getChamps()[0].getX();
    p.avancer(1000);
    expect(p.scene.getChamps()[0].getX() - x0).toBe(65); // premier pas à 20 ms, puis toutes les 15,12 ms
    expect(p.scene.getCompteARebours().getCompteurTemps()).toBe(100);
    p.avancer(1);
    expect(p.scene.getCompteARebours().getCompteurTemps()).toBe(99);
  });
});
