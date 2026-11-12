/**
 * Outils des tests de fidélité : exécution d'un scénario d'entrées clavier et production,
 * pour chaque tour de paintComponent(), d'une ligne canonique identique à celle du harnais Java
 * (outils/harnais-java) : état complet + appels de dessin + sons.
 */
import { AUCUNE_CORRECTION, type Corrections } from '../../src/games/mario-ahmed-aberkan/config.ts';
import { Partie, type Touche } from '../../src/games/mario-ahmed-aberkan/engine/index.ts';
import type { Personnage } from '../../src/games/mario-ahmed-aberkan/engine/Personnage.ts';

export interface Scenario {
  ticks: number;
  captures: number[];
  /** entrées brutes (KeyListener Java) appliquées juste avant le tour indiqué */
  entrees: Map<number, { action: 'appui' | 'relache'; touche: Touche }[]>;
}

export function lireScenario(texte: string): Scenario {
  const sc: Scenario = { ticks: 0, captures: [], entrees: new Map() };
  for (const brut of texte.split(/\r?\n/)) {
    const ligne = brut.trim();
    if (!ligne || ligne.startsWith('#')) continue;
    const p = ligne.split(/\s+/);
    if (p[0] === 'ticks') sc.ticks = Number(p[1]);
    else if (p[0] === 'capture') sc.captures.push(...p.slice(1).map(Number));
    else {
      const tick = Number(p[0]);
      const liste = sc.entrees.get(tick) ?? [];
      liste.push({ action: p[1] as 'appui' | 'relache', touche: p[2] as Touche });
      sc.entrees.set(tick, liste);
    }
  }
  return sc;
}

const b = (v: boolean): string => (v ? '1' : '0');
const perso = (p: Personnage): string =>
  `${p.getX()},${p.getY()},${b(p.isVersDroite())},${b(p.isVivant())},${b(p.isMarche())},${p.getCompteur()}`;

export function ligneCanonique(partie: Partie, sons: readonly string[]): string {
  const s = partie.scene;
  const m = s.mario;
  const dessins: string[] = [];
  const textes: string[] = [];
  for (const op of partie.image) {
    if (op.type === 'image') dessins.push(`${op.image}@${op.x},${op.y}`);
    else
      textes.push(
        `${op.texte}@${op.x},${op.y},${op.police.nom},${op.police.style},${op.police.taille},${op.couleur.slice(1)}`,
      );
  }
  return [
    partie.getTours(),
    `${s.getxPos()},${s.getDx()},${s.getxFond1()},${s.getxFond2()},${s.getySol()},${s.getHautPlafond()},${b(s.isOk())}`,
    `M${m.getX()},${m.getY()},${b(m.isSaut())},${m.getCompteurSaut()},${b(m.isMarche())},${b(m.isVersDroite())},${b(m.isVivant())},${m.getCompteur()},${m.getCompteurMort()}`,
    'C' + s.getChamps().map(perso).join(';'),
    'T' + s.getTortues().map(perso).join(';'),
    'P' +
      s
        .getPieces()
        .map((p) => `${p.getX()},${p.getY()},${p.getCompteur()}`)
        .join(';'),
    s.getScore().getNbPieces(),
    s.getCompteARebours().getCompteurTemps(),
    sons.join('+'),
    dessins.join(';'),
    textes.join(';'),
  ].join('|');
}

/** Exécute un scénario avec les entrées brutes de Clavier.java (comme le harnais Java). */
export function executerScenario(
  scenario: Scenario,
  corrections: Corrections = AUCUNE_CORRECTION,
  surLigne?: (ligne: string, tick: number) => void,
): string[] {
  const sons: string[] = [];
  const partie = new Partie({ audio: { playSound: (son) => sons.push(son) }, corrections });
  const lignes: string[] = [];
  for (let tick = 1; tick <= scenario.ticks; tick++) {
    const debut = sons.length;
    partie.executerTour(() => {
      for (const e of scenario.entrees.get(tick) ?? []) {
        if (e.action === 'appui') partie.clavier.keyPressed(e.touche);
        else partie.clavier.keyReleased(e.touche);
      }
    });
    const ligne = ligneCanonique(partie, sons.slice(debut));
    surLigne?.(ligne, tick);
    lignes.push(ligne);
  }
  return lignes;
}
