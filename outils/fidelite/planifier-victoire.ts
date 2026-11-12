/**
 * Recherche automatique d'un parcours gagnant (10 pièces + arrivée) par recherche en faisceau
 * sur le moteur déterministe, en mode Java strict (AUCUNE_CORRECTION) et avec des entrées
 * KeyListener brutes. Le résultat est un scénario rejouable à l'identique par le harnais Java
 * (preuve que le jeu original se termine avec ces entrées) et par le navigateur (test E2E).
 *
 * Usage : node outils/fidelite/planifier-victoire.ts
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { AUCUNE_CORRECTION } from '../../src/games/mario-ahmed-aberkan/config.ts';
import { Partie, type SauvegardePartie, type Touche } from '../../src/games/mario-ahmed-aberkan/engine/index.ts';

const INTERVALLE = 12; // tours entre deux décisions
const LARGEUR_FAISCEAU = 90;
const TOURS_MAX = 30_000;

type Mouvement = 'D' | 'G' | '-';
interface Action {
  mvt: Mouvement;
  saut: boolean;
}
const ACTIONS: Action[] = [
  { mvt: 'D', saut: false },
  { mvt: 'D', saut: true },
  { mvt: '-', saut: false },
  { mvt: '-', saut: true },
  { mvt: 'G', saut: false },
  { mvt: 'G', saut: true },
];
const TOUCHE: Record<Exclude<Mouvement, '-'>, Touche> = { D: 'DROITE', G: 'GAUCHE' };

interface Noeud {
  etat: SauvegardePartie;
  mvt: Mouvement;
  tour: number;
  evenements: string[];
  score: number;
}

const partie = new Partie({ corrections: AUCUNE_CORRECTION });

/** Entrées brutes correspondant à une action, comme un joueur avec répétition automatique. */
function evenements(courant: Mouvement, a: Action): [string, Touche][] {
  const ev: [string, Touche][] = [];
  if (a.mvt !== courant) {
    if (courant !== '-') ev.push(['relache', TOUCHE[courant]]);
    if (a.mvt !== '-') ev.push(['appui', TOUCHE[a.mvt]]);
  } else if (a.mvt !== '-') {
    ev.push(['appui', TOUCHE[a.mvt]]); // répétition automatique
  }
  if (a.saut) ev.push(['appui', 'ESPACE']);
  return ev;
}

/** Heuristique : pièces ramassées, puis distance à la prochaine pièce (ou à l'arrivée). */
function evaluer(): number {
  const s = partie.scene;
  const m = s.mario;
  if (!m.isVivant()) return -Infinity;
  const xPos = s.getxPos();
  const pieces = s.getScore().getNbPieces();
  const xMonde = m.getX() + Math.max(xPos, 0);
  let distance: number;
  if (pieces < 10) {
    // pièce restante la plus à gauche (coordonnées du niveau)
    let cible = { x: Infinity, y: 0 };
    for (const p of s.getPieces()) {
      const x = p.getX() + Math.max(xPos, 0);
      if (x < cible.x) cible = { x, y: p.getY() };
    }
    distance = Math.abs(xMonde + 14 - (cible.x + 15)) + 1.5 * Math.abs(m.getY() + 25 - (cible.y + 15));
  } else {
    distance = Math.max(0, 4410 - xPos);
  }
  return pieces * 100_000 - distance - partie.getTours() * 0.02;
}

/** Générateur pseudo-aléatoire déterministe (bruit de diversification du faisceau). */
let graine = 12345;
function hasard(): number {
  graine = (graine + 0x6d2b79f5) >>> 0;
  let t = graine;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

let faisceau: Noeud[] = [{ etat: partie.sauvegarder(), mvt: '-', tour: 0, evenements: [], score: 0 }];
let gagnant: Noeud | null = null;
/** Faisceaux successifs, pour revenir en arrière si toutes les branches meurent. */
const historique: Noeud[][] = [];
let largeur = LARGEUR_FAISCEAU;
let bruit = 0;
let retours = 0;

for (let decision = 0; !gagnant && decision * INTERVALLE < TOURS_MAX; decision++) {
  historique[decision] = faisceau;
  const enfants: Noeud[] = [];
  for (const noeud of faisceau) {
    for (const a of ACTIONS) {
      partie.restaurer(noeud.etat);
      const ev = evenements(noeud.mvt, a);
      const tour0 = partie.getTours() + 1;
      partie.executerTour(() => {
        for (const [action, t] of ev) {
          if (action === 'appui') partie.clavier.keyPressed(t);
          else partie.clavier.keyReleased(t);
        }
      });
      for (let i = 1; i < INTERVALLE; i++) partie.executerTour();
      const score = evaluer();
      if (score === -Infinity) continue;
      const enfant: Noeud = {
        etat: partie.sauvegarder(),
        mvt: a.mvt,
        tour: partie.getTours(),
        evenements: [...noeud.evenements, ...ev.map(([action, t]) => `${tour0} ${action} ${t}`)],
        score: score + bruit * hasard(),
      };
      if (partie.scene.getResultat() === 'gagnee') {
        gagnant = enfant;
        break;
      }
      enfants.push(enfant);
    }
    if (gagnant) break;
  }
  // Diversité : un seul nœud par situation (position, hauteur, saut, pièces)
  enfants.sort((a, b) => b.score - a.score);
  const vus = new Set<string>();
  faisceau = [];
  for (const e of enfants) {
    const s = e.etat.scene;
    const m = e.etat.mario;
    const cle = `${s.xPos}|${m.y}|${m.saut}|${e.etat.score.nbPieces}|${e.mvt}`;
    if (vus.has(cle)) continue;
    vus.add(cle);
    faisceau.push(e);
    if (faisceau.length >= largeur) break;
  }
  if (faisceau.length === 0) {
    // Toutes les branches meurent : retour 40 décisions en arrière, faisceau plus large et bruité
    if (++retours > 25) throw new Error('Aucun parcours survivant');
    const retour = Math.max(0, decision - 40);
    largeur = Math.round(largeur * 1.3);
    bruit += 60;
    console.log(
      `  impasse au tour ${decision * INTERVALLE} : retour au tour ${retour * INTERVALLE}, faisceau ${largeur}`,
    );
    faisceau = historique[retour];
    decision = retour - 1;
    continue;
  }
  if (decision % 50 === 0) {
    const t = faisceau[0];
    console.log(
      `tour ${t.tour} : xPos ${t.etat.scene.xPos}, pièces ${t.etat.score.nbPieces}, faisceau ${faisceau.length}`,
    );
  }
}

if (!gagnant) throw new Error('Pas de victoire trouvée');
const g: Noeud = gagnant;
console.log(
  `Victoire au tour ${g.tour} (${((g.tour * 3.16) / 1000).toFixed(1)} s de jeu), ${g.evenements.length} événements`,
);
const entete = '# Parcours gagnant trouvé par outils/fidelite/planifier-victoire.ts (entrées KeyListener brutes)';
const dossier = join(import.meta.dirname, '../../tests/fidelite/scenarios');
writeFileSync(join(dossier, 'victoire.txt'), [entete, `ticks ${g.tour + 400}`, ...g.evenements].join('\n') + '\n');
// Même parcours, puis attente jusqu'à 110 s : en Java, le message gagné devient « perdu » à 0 s.
writeFileSync(
  join(dossier, 'victoire-puis-attente.txt'),
  [entete + ' puis attente', `ticks 34800`, ...g.evenements].join('\n') + '\n',
);
