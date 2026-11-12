/**
 * Recherche automatique d'un parcours gagnant (10 pièces + arrivée) en mode Moderne, par
 * recherche en faisceau sur le moteur déterministe. Prouve que le niveau d'origine reste
 * terminable avec la physique moderne ; le parcours sert aux tests unitaires et E2E.
 *
 * Usage : node outils/moderne/planifier-victoire.ts
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  creerMonde,
  etape,
  type Entree,
  type EtatMonde,
  type SonsModernes,
} from '../../src/games/mario-ahmed-aberkan/moderne/monde.ts';
import { MAT_X, PAS } from '../../src/games/mario-ahmed-aberkan/moderne/reglages.ts';

/** Un segment du parcours : `pas` pas de simulation avec les mêmes touches. */
export interface Segment {
  pas: number;
  gauche: boolean;
  droite: boolean;
  /** Saut maintenu pendant le segment */
  saut: boolean;
}

const PAS_PAR_DECISION = 12; // 0,1 s
const LARGEUR = 140;
const PAS_MAX = 120 * 60;
const muets: SonsModernes = { jouer() {}, musique() {} };

interface Noeud {
  monde: EtatMonde;
  saut: boolean;
  segments: Segment[];
  score: number;
}

const ACTIONS: Omit<Segment, 'pas'>[] = [];
for (const [gauche, droite] of [
  [false, true],
  [false, false],
  [true, false],
])
  for (const saut of [false, true]) ACTIONS.push({ gauche, droite, saut });

/** Applique un segment ; le saut est « appuyé » au premier pas s'il n'était pas déjà tenu. */
export function jouerSegment(m: EtatMonde, s: Segment, sautPrecedent: boolean, sons: SonsModernes = muets): void {
  for (let i = 0; i < s.pas; i++) {
    const e: Entree = {
      gauche: s.gauche,
      droite: s.droite,
      saut: s.saut,
      sautAppuye: s.saut && !sautPrecedent && i === 0,
    };
    etape(m, e, PAS, sons);
  }
}

function evaluer(m: EtatMonde): number {
  if (m.phase === 'defaite') return -Infinity;
  const j = m.joueur;
  const restantes = m.pieces.filter((p) => !p.prise);
  let distance: number;
  if (restantes.length > 0) {
    const cible = restantes.reduce((a, b) => (b.x < a.x ? b : a));
    distance = Math.abs(j.x + 14 - (cible.x + 15)) + 3 * Math.abs(j.y + 25 - (cible.y + 15));
  } else distance = Math.max(0, MAT_X - (j.x + 24));
  return m.stats.pieces * 100_000 - distance - m.t * 2;
}

function planifier(): Segment[] {
  let faisceau: Noeud[] = [{ monde: creerMonde(1), saut: false, segments: [], score: 0 }];
  // intro (0,8 s) : aucune touche
  jouerSegment(faisceau[0].monde, { pas: 96, gauche: false, droite: false, saut: false }, false);
  faisceau[0].segments.push({ pas: 96, gauche: false, droite: false, saut: false });
  for (let d = 0; d * PAS_PAR_DECISION < PAS_MAX; d++) {
    const enfants: Noeud[] = [];
    for (const n of faisceau) {
      for (const a of ACTIONS) {
        const monde = structuredClone(n.monde);
        const seg: Segment = { pas: PAS_PAR_DECISION, ...a };
        jouerSegment(monde, seg, n.saut);
        monde.particules.length = 0;
        monde.bulles.length = 0;
        const score = evaluer(monde);
        if (score === -Infinity) continue;
        const enfant: Noeud = { monde, saut: a.saut, segments: [...n.segments, seg], score };
        if (monde.phase === 'victoire') return enfant.segments;
        enfants.push(enfant);
      }
    }
    enfants.sort((a, b) => b.score - a.score);
    const vus = new Set<string>();
    faisceau = [];
    for (const e of enfants) {
      const j = e.monde.joueur;
      const cle = `${Math.round(j.x / 3)}|${Math.round(j.y / 3)}|${Math.sign(j.vy)}|${e.monde.stats.pieces}|${e.saut}`;
      if (vus.has(cle)) continue;
      vus.add(cle);
      faisceau.push(e);
      if (faisceau.length >= LARGEUR) break;
    }
    if (faisceau.length === 0) throw new Error('Aucun parcours survivant');
    if (d % 20 === 0) {
      const m = faisceau[0].monde;
      console.log(`t=${m.t.toFixed(1)} s  x=${m.joueur.x.toFixed(0)}  pièces=${m.stats.pieces}`);
    }
  }
  throw new Error('Pas de victoire trouvée');
}

if (import.meta.main) {
  const segments = planifier();
  const total = segments.reduce((s, x) => s + x.pas, 0);
  console.log(`Victoire en ${(total * PAS).toFixed(2)} s (${segments.length} segments)`);
  // fusion des segments identiques consécutifs
  const compact: Segment[] = [];
  for (const s of segments) {
    const p = compact[compact.length - 1];
    if (
      p &&
      p.gauche === s.gauche &&
      p.droite === s.droite &&
      p.saut === s.saut &&
      s.pas === PAS_PAR_DECISION &&
      !s.saut
    )
      p.pas += s.pas;
    else compact.push({ ...s });
  }
  writeFileSync(
    join(import.meta.dirname, '../../tests/moderne/parcours-victoire.json'),
    JSON.stringify(
      { description: 'Parcours gagnant du mode Moderne (outils/moderne/planifier-victoire.ts)', segments: compact },
      null,
      1,
    ) + '\n',
  );
}
