/**
 * Moteur du mode Moderne : même niveau (engine/niveau.ts, recopié du Java), mêmes règles
 * (10 pièces + arrivée avant 100 s, contact latéral mortel, écrasement par-dessus), mêmes sons,
 * mais une physique continue et des effets modernes.
 *
 * L'état est fait de données simples (aucune classe) : il se copie avec structuredClone(),
 * ce qui permet de rejouer, comparer et rechercher des parcours dans les tests.
 */
import { BLOCS, CHAMPS, MARIO, PIECES, TORTUES, TUYAUX_ROUGES } from '../engine/niveau.ts';
import type { CheminSon } from '../engine/types.ts';
import { DUREES, ENNEMIS, JOUEUR, MAT_X, NIVEAU_LARGEUR, PHYSIQUE, PORTE_X, SCORE, SOL, VUE } from './reglages.ts';

export interface Entree {
  gauche: boolean;
  droite: boolean;
  /** Saut maintenu */
  saut: boolean;
  /** Saut enfoncé depuis le pas précédent */
  sautAppuye: boolean;
}

export interface SonsModernes {
  jouer(son: CheminSon): void;
  musique(lancer: boolean): void;
}

export type PhaseMonde = 'intro' | 'jeu' | 'victoire' | 'defaite';
export type Evenement = 'saut' | 'atterrissage' | 'piece' | 'ecrasement' | 'bosse' | 'mort' | 'victoire' | 'manque';

export interface Joueur {
  x: number;
  y: number;
  px: number;
  py: number;
  vx: number;
  vy: number;
  auSol: boolean;
  direction: 1 | -1;
  coyote: number;
  tampon: number;
  sautTenu: boolean;
  phaseMarche: number;
  etat: 'normal' | 'mort' | 'victoire' | 'entre';
  tempsEtat: number;
  combo: number;
}

export interface Solide {
  type: 'tuyau' | 'bloc';
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
  /** temps restant de l'animation « cogné par-dessous » */
  bosse: number;
}

export interface Ennemi {
  type: 'champ' | 'tortue';
  x: number;
  y: number;
  px: number;
  largeur: number;
  hauteur: number;
  vx: number;
  vivant: boolean;
  tempsMort: number;
  phase: number;
}

export interface PieceModerne {
  x: number;
  y: number;
  prise: boolean;
  tempsPrise: number;
}

export interface Particule {
  x: number;
  y: number;
  vx: number;
  vy: number;
  vie: number;
  vieMax: number;
  taille: number;
  couleur: string;
  gravite: number;
  forme: 'rond' | 'etincelle';
}

export interface Bulle {
  x: number;
  y: number;
  texte: string;
  vie: number;
  vieMax: number;
  couleur: string;
}

export interface Camera {
  x: number;
  px: number;
  avance: number;
  /** intensité des secousses (0 à 1), décroît avec le temps */
  trauma: number;
  sx: number;
  sy: number;
}

export interface Stats {
  pieces: number;
  ecrases: number;
  score: number;
  meilleurCombo: number;
  /** temps mis pour finir (s), à la victoire */
  tempsFinal: number | null;
  bonus: number;
}

export interface EtatMonde {
  t: number;
  phase: PhaseMonde;
  tempsPhase: number;
  /** temps restant (s) : CompteARebours du Java */
  chrono: number;
  /** micro-gel de l'action (impact), en secondes */
  gel: number;
  cause: 'ennemi' | 'temps' | null;
  joueur: Joueur;
  solides: Solide[];
  ennemis: Ennemi[];
  pieces: PieceModerne[];
  particules: Particule[];
  bulles: Bulle[];
  camera: Camera;
  stats: Stats;
  message: { texte: string; vie: number } | null;
  feux: number;
  sonPerteJoue: boolean;
  /** état du générateur pseudo-aléatoire (effets visuels uniquement) */
  alea: number;
  /** événements du dernier pas (interface, tests) */
  evenements: Evenement[];
}

const TOTAL_PIECES = PIECES.length;
const MAX_PARTICULES = 260;
const COULEURS_FEU = ['#ffd54a', '#ff6b6b', '#4f8df5', '#3fb27f', '#ffffff', '#ff9f43'];

// ---------------------------------------------------------------- création

export function creerMonde(graine = 1): EtatMonde {
  const [mx] = MARIO;
  const joueur: Joueur = {
    x: mx,
    y: SOL - JOUEUR.hauteur,
    px: mx,
    py: SOL - JOUEUR.hauteur,
    vx: 0,
    vy: 0,
    auSol: true,
    direction: 1,
    coyote: 0,
    tampon: 0,
    sautTenu: false,
    phaseMarche: 0,
    etat: 'normal',
    tempsEtat: 0,
    combo: 0,
  };
  const camX = cibleCamera(joueur, 60);
  return {
    t: 0,
    phase: 'intro',
    tempsPhase: 0,
    chrono: DUREES.partie,
    gel: 0,
    cause: null,
    joueur,
    solides: [
      ...TUYAUX_ROUGES.map(([x, y]) => ({ type: 'tuyau' as const, x, y, largeur: 43, hauteur: 65, bosse: 0 })),
      ...BLOCS.map(([x, y]) => ({ type: 'bloc' as const, x, y, largeur: 30, hauteur: 30, bosse: 0 })),
    ],
    ennemis: [
      ...CHAMPS.map(([x, y]) => ({
        type: 'champ' as const,
        x,
        y,
        px: x,
        ...ENNEMIS.champ,
        vx: ENNEMIS.vitesse,
        vivant: true,
        tempsMort: 0,
        phase: 0,
      })),
      ...TORTUES.map(([x, y]) => ({
        type: 'tortue' as const,
        x,
        y,
        px: x,
        ...ENNEMIS.tortue,
        vx: ENNEMIS.vitesse,
        vivant: true,
        tempsMort: 0,
        phase: 0,
      })),
    ],
    pieces: PIECES.map(([x, y]) => ({ x, y, prise: false, tempsPrise: 0 })),
    particules: [],
    bulles: [],
    camera: { x: camX, px: camX, avance: 60, trauma: 0, sx: 0, sy: 0 },
    stats: { pieces: 0, ecrases: 0, score: 0, meilleurCombo: 0, tempsFinal: null, bonus: 0 },
    message: null,
    feux: 0,
    sonPerteJoue: false,
    alea: graine >>> 0,
    evenements: [],
  };
}

// ---------------------------------------------------------------- pas de simulation

/** Fait avancer le monde d'un pas de `dt` secondes. */
export function etape(m: EtatMonde, e: Entree, dt: number, sons: SonsModernes): void {
  m.evenements.length = 0;
  m.t += dt;
  const j = m.joueur;
  j.px = j.x;
  j.py = j.y;
  for (const en of m.ennemis) en.px = en.x;
  m.camera.px = m.camera.x;

  majEffets(m, dt);
  if (m.gel > 0) {
    // micro-gel : l'action s'arrête un instant, les effets continuent (un appui sur Saut est mémorisé)
    m.gel = Math.max(0, m.gel - dt);
    if (e.sautAppuye) j.tampon = PHYSIQUE.tamponSaut;
    majCamera(m, dt);
    return;
  }
  m.tempsPhase += dt;

  switch (m.phase) {
    case 'intro':
      majEnnemis(m, dt);
      if (m.tempsPhase >= DUREES.intro) {
        passer(m, 'jeu');
        sons.musique(true);
      }
      break;
    case 'jeu':
      m.chrono = Math.max(0, m.chrono - dt);
      majJoueur(m, e, dt, sons);
      majEnnemis(m, dt);
      interactions(m, e, sons);
      if (m.phase === 'jeu' && m.chrono <= 0) perdre(m, 'temps', sons);
      if (m.phase === 'jeu') verifierArrivee(m, sons);
      break;
    case 'victoire':
      majVictoire(m, dt);
      majEnnemis(m, dt);
      break;
    case 'defaite':
      majDefaite(m, dt, sons);
      majEnnemis(m, dt);
      break;
  }
  majCamera(m, dt);
}

function passer(m: EtatMonde, phase: PhaseMonde): void {
  m.phase = phase;
  m.tempsPhase = 0;
}

// ---------------------------------------------------------------- Mario

function majJoueur(m: EtatMonde, e: Entree, dt: number, sons: SonsModernes): void {
  const j = m.joueur;
  const P = PHYSIQUE;
  const dir = (e.droite ? 1 : 0) - (e.gauche ? 1 : 0);

  // Horizontal : accélération, freinage, dérapage au demi-tour
  if (dir !== 0) {
    j.direction = dir as 1 | -1;
    const demiTour = j.vx !== 0 && Math.sign(j.vx) !== dir;
    const accel = demiTour ? P.freinDemiTour : j.auSol ? P.accelSol : P.accelAir;
    j.vx += dir * accel * dt;
    if (Math.abs(j.vx) > P.vitesseMax) j.vx = Math.sign(j.vx) * P.vitesseMax;
    if (demiTour && j.auSol && Math.abs(j.vx) > 120 && hasard(m) < 0.35) poussiere(m, j.x + 14, SOL, 1);
  } else {
    const d = (j.auSol ? P.decelSol : P.decelAir) * dt;
    j.vx = Math.abs(j.vx) <= d ? 0 : j.vx - Math.sign(j.vx) * d;
  }

  // Saut : appui mémorisé (tampon) + saut permis juste après un rebord (coyote)
  j.tampon = e.sautAppuye ? P.tamponSaut : Math.max(0, j.tampon - dt);
  j.coyote = j.auSol ? P.coyote : Math.max(0, j.coyote - dt);
  if (j.tampon > 0 && j.coyote > 0) {
    j.vy = -P.vitesseSaut;
    j.auSol = false;
    j.coyote = 0;
    j.tampon = 0;
    j.sautTenu = true;
    sons.jouer('/audio/saut.wav');
    poussiere(m, j.x + 14, j.y + JOUEUR.hauteur, 5);
    m.evenements.push('saut');
  }
  if (!e.saut) j.sautTenu = false;

  // Gravité : plus forte si Saut est relâché (saut court) et à la descente, plus douce au sommet
  let g = j.vy < 0 ? (j.sautTenu ? P.gravite : P.graviteRelache) : P.graviteChute;
  if (j.sautTenu && Math.abs(j.vy) < P.sommetSeuil) g *= P.sommetFacteur;
  j.vy = Math.min(j.vy + g * dt, P.chuteMax);

  const etaitAuSol = j.auSol;
  const vyAvant = j.vy;
  deplacerX(m, j.vx * dt);
  deplacerY(m, j.vy * dt);
  if (j.auSol && !etaitAuSol) {
    if (vyAvant > 420) poussiere(m, j.x + 14, j.y + JOUEUR.hauteur, 6);
    j.combo = 0;
    m.evenements.push('atterrissage');
  }
  if (j.auSol && Math.abs(j.vx) > 10) j.phaseMarche += (dt * Math.abs(j.vx)) / P.vitesseMax;
  else if (j.auSol) j.phaseMarche = 0;
}

function chevaucheSolide(j: Joueur, s: Solide): boolean {
  const B = JOUEUR.boite;
  return (
    j.x + B.dx < s.x + s.largeur &&
    j.x + B.dx + B.largeur > s.x &&
    j.y + B.dy < s.y + s.hauteur &&
    j.y + B.dy + B.hauteur > s.y
  );
}

function deplacerX(m: EtatMonde, dx: number): void {
  const j = m.joueur;
  const B = JOUEUR.boite;
  j.x += dx;
  if (j.x + B.dx < 0) {
    j.x = -B.dx;
    j.vx = 0;
  }
  if (j.x + B.dx + B.largeur > NIVEAU_LARGEUR) {
    j.x = NIVEAU_LARGEUR - B.dx - B.largeur;
    j.vx = 0;
  }
  for (const s of m.solides) {
    if (!chevaucheSolide(j, s)) continue;
    if (dx > 0) j.x = s.x - B.dx - B.largeur;
    else if (dx < 0) j.x = s.x + s.largeur - B.dx;
    j.vx = 0;
  }
}

function deplacerY(m: EtatMonde, dy: number): void {
  const j = m.joueur;
  const B = JOUEUR.boite;
  j.y += dy;
  j.auSol = false;
  for (const s of m.solides) {
    if (!chevaucheSolide(j, s)) continue;
    if (dy > 0) {
      j.y = s.y - B.dy - B.hauteur;
      j.vy = 0;
      j.auSol = true;
    } else if (dy < 0) {
      // Correction de coin : la tête frôle l'arête d'un bloc → glisse sur le côté
      const parGauche = j.x + B.dx + B.largeur - s.x;
      const parDroite = s.x + s.largeur - (j.x + B.dx);
      if (parGauche <= PHYSIQUE.correctionCoin) {
        j.x -= parGauche;
        continue;
      }
      if (parDroite <= PHYSIQUE.correctionCoin) {
        j.x += parDroite;
        continue;
      }
      j.y = s.y + s.hauteur - B.dy;
      j.vy = 0;
      j.sautTenu = false;
      if (s.type === 'bloc') {
        s.bosse = DUREES.bosseBloc;
        etincelles(m, j.x + 14, s.y + s.hauteur, 5, '#ffe7a3');
        m.evenements.push('bosse');
      }
    }
  }
  if (j.y + JOUEUR.hauteur >= SOL) {
    j.y = SOL - JOUEUR.hauteur;
    j.vy = 0;
    j.auSol = true;
  }
}

// ---------------------------------------------------------------- ennemis

function majEnnemis(m: EtatMonde, dt: number): void {
  for (const en of m.ennemis) {
    en.phase += dt;
    if (!en.vivant) {
      en.tempsMort += dt;
      continue;
    }
    en.x += en.vx * dt;
    // demi-tour contre les tuyaux (comme Champ.contact / Tortue.contact en Java)
    for (const s of m.solides) {
      if (s.type !== 'tuyau') continue;
      if (en.x < s.x + s.largeur && en.x + en.largeur > s.x && en.y + en.hauteur > s.y) {
        if (en.vx > 0) en.x = s.x - en.largeur;
        else en.x = s.x + s.largeur;
        en.vx = -en.vx;
      }
    }
    if (en.x < 0) {
      en.x = 0;
      en.vx = Math.abs(en.vx);
    } else if (en.x + en.largeur > NIVEAU_LARGEUR) {
      en.x = NIVEAU_LARGEUR - en.largeur;
      en.vx = -Math.abs(en.vx);
    }
  }
  // demi-tour quand deux ennemis se rencontrent
  for (let a = 0; a < m.ennemis.length; a++) {
    const A = m.ennemis[a];
    if (!A.vivant) continue;
    for (let b = a + 1; b < m.ennemis.length; b++) {
      const Bn = m.ennemis[b];
      if (!Bn.vivant) continue;
      const recouvrement = Math.min(A.x + A.largeur, Bn.x + Bn.largeur) - Math.max(A.x, Bn.x);
      if (recouvrement <= 0) continue;
      const aGauche = A.x + A.largeur / 2 <= Bn.x + Bn.largeur / 2;
      const gauche = aGauche ? A : Bn;
      const droite = aGauche ? Bn : A;
      gauche.x -= recouvrement / 2;
      droite.x += recouvrement / 2;
      gauche.vx = -Math.abs(gauche.vx);
      droite.vx = Math.abs(droite.vx);
    }
  }
}

// ---------------------------------------------------------------- pièces, écrasements, mort

function interactions(m: EtatMonde, e: Entree, sons: SonsModernes): void {
  const j = m.joueur;
  if (j.etat !== 'normal') return;
  const B = JOUEUR.boite;

  for (const p of m.pieces) {
    if (p.prise) continue;
    if (j.x < p.x + 30 && j.x + JOUEUR.largeur > p.x && j.y < p.y + 30 && j.y + JOUEUR.hauteur > p.y) {
      p.prise = true;
      p.tempsPrise = 0;
      m.stats.pieces++;
      m.stats.score += SCORE.piece;
      sons.jouer('/audio/issordiyen.wav');
      etincelles(m, p.x + 13, p.y + 15, 12, '#ffd54a');
      bulle(m, p.x + 13, p.y - 4, `+${SCORE.piece}`, '#ffe066');
      m.evenements.push('piece');
    }
  }

  const x1 = j.x + B.dx;
  const x2 = x1 + B.largeur;
  const y1 = j.y + B.dy;
  const y2 = y1 + B.hauteur;
  const piedsAvant = j.py + B.dy + B.hauteur;
  const tombait = j.vy > 0;
  let ecrase = false;
  for (const en of m.ennemis) {
    if (!en.vivant) continue;
    const M = ENNEMIS.marge;
    if (x2 <= en.x + M || x1 >= en.x + en.largeur - M || y2 <= en.y + M || y1 >= en.y + en.hauteur) continue;
    if (ecrase || (tombait && piedsAvant <= en.y + ENNEMIS.toleranceEcrasement)) {
      ecraser(m, en, e, sons);
      ecrase = true;
    } else {
      mourir(m, sons);
      return;
    }
  }
}

function ecraser(m: EtatMonde, en: Ennemi, e: Entree, sons: SonsModernes): void {
  const j = m.joueur;
  en.vivant = false;
  en.tempsMort = 0;
  j.vy = -(e.saut ? PHYSIQUE.rebondTenu : PHYSIQUE.rebond);
  j.sautTenu = e.saut;
  j.auSol = false;
  j.coyote = 0;
  j.combo++;
  m.stats.ecrases++;
  m.stats.meilleurCombo = Math.max(m.stats.meilleurCombo, j.combo);
  const points = SCORE.ecrasement * j.combo;
  m.stats.score += points;
  bulle(m, en.x + en.largeur / 2, en.y - 8, j.combo > 1 ? `+${points}  ×${j.combo}` : `+${points}`, '#ffffff');
  // Java : cheikhLdjama3.wav pour un champignon, A3rav.wav pour une tortue
  sons.jouer(en.type === 'champ' ? '/audio/cheikhLdjama3.wav' : '/audio/A3rav.wav');
  m.gel = DUREES.gelEcrasement;
  secouer(m, 0.32);
  etincelles(m, en.x + en.largeur / 2, en.y + 6, 14, '#ffffff');
  m.evenements.push('ecrasement');
}

function mourir(m: EtatMonde, sons: SonsModernes): void {
  perdre(m, 'ennemi', sons);
}

function perdre(m: EtatMonde, cause: 'ennemi' | 'temps', sons: SonsModernes): void {
  const j = m.joueur;
  j.etat = 'mort';
  j.tempsEtat = 0;
  j.vx = 0;
  j.vy = 0;
  m.cause = cause;
  passer(m, 'defaite');
  sons.musique(false);
  // Java : boum.wav à la mort, partiePerdue.wav 100 tours (≈0,32 s) plus tard
  sons.jouer('/audio/boum.wav');
  m.gel = DUREES.gelMort;
  secouer(m, 0.75);
  explosion(m, j.x + 14, j.y + 25);
  m.evenements.push('mort');
}

function majDefaite(m: EtatMonde, dt: number, sons: SonsModernes): void {
  const j = m.joueur;
  j.tempsEtat += dt;
  if (!m.sonPerteJoue && j.tempsEtat >= DUREES.explosion) {
    sons.jouer('/audio/partiePerdue.wav');
    m.sonPerteJoue = true;
    j.vy = -680; // petit bond, puis chute hors de l'écran
  }
  if (m.sonPerteJoue && j.y < VUE.hauteur + 120) {
    j.vy = Math.min(j.vy + PHYSIQUE.graviteChute * dt, PHYSIQUE.chuteMax);
    j.y += j.vy * dt;
  }
}

// ---------------------------------------------------------------- arrivée et victoire

function verifierArrivee(m: EtatMonde, sons: SonsModernes): void {
  const j = m.joueur;
  if (j.x + JOUEUR.boite.dx + JOUEUR.boite.largeur < MAT_X) return;
  if (m.stats.pieces >= TOTAL_PIECES) {
    passer(m, 'victoire');
    j.etat = 'victoire';
    j.tempsEtat = 0;
    j.vx = 0;
    j.vy = 0;
    j.direction = 1;
    j.x = MAT_X - 24;
    m.stats.tempsFinal = Math.round((DUREES.partie - m.chrono) * 100) / 100;
    m.stats.bonus = Math.ceil(m.chrono) * SCORE.bonusParSeconde;
    m.stats.score += m.stats.bonus;
    sons.musique(false);
    sons.jouer('/audio/partieGagnee.wav');
    etincelles(m, MAT_X, j.y + 10, 24, '#ffd54a');
    secouer(m, 0.2);
    m.feux = 0.25;
    m.evenements.push('victoire');
  } else if (!m.message || m.message.vie <= 0) {
    const manque = TOTAL_PIECES - m.stats.pieces;
    m.message = { texte: `Il manque ${manque} pièce${manque > 1 ? 's' : ''} !`, vie: 2.4 };
    m.evenements.push('manque');
  }
}

function majVictoire(m: EtatMonde, dt: number): void {
  const j = m.joueur;
  j.tempsEtat += dt;
  if (j.y + JOUEUR.hauteur < SOL) {
    j.y = Math.min(SOL - JOUEUR.hauteur, j.y + 330 * dt); // glisse le long du mât
  } else if (j.x < PORTE_X - JOUEUR.largeur / 2) {
    j.x = Math.min(PORTE_X - JOUEUR.largeur / 2, j.x + 150 * dt); // marche jusqu'à la porte
    j.phaseMarche += dt * 0.5;
  } else if (j.etat === 'victoire') {
    j.etat = 'entre';
    j.tempsEtat = 0;
    etincelles(m, PORTE_X, SOL - 25, 18, '#ffffff');
  }
  m.feux -= dt;
  if (m.feux <= 0 && m.tempsPhase < 5) {
    m.feux = 0.32 + hasard(m) * 0.2;
    feuArtifice(m, 4930 + hasard(m) * 220, 40 + hasard(m) * 80);
  }
}

// ---------------------------------------------------------------- caméra

function cibleCamera(j: Joueur, avance: number): number {
  return Math.max(0, Math.min(NIVEAU_LARGEUR - VUE.largeur, j.x + JOUEUR.largeur / 2 - VUE.largeur / 2 + avance));
}

function majCamera(m: EtatMonde, dt: number): void {
  const c = m.camera;
  const j = m.joueur;
  const avanceVoulue = m.phase === 'jeu' ? j.direction * 60 : 20;
  c.avance += (avanceVoulue - c.avance) * Math.min(1, dt * 2.5);
  c.x += (cibleCamera(j, c.avance) - c.x) * (1 - Math.exp(-dt * 8));
  c.trauma = Math.max(0, c.trauma - dt * 1.8);
  const amplitude = c.trauma * c.trauma * 7;
  c.sx = (hasard(m) * 2 - 1) * amplitude;
  c.sy = (hasard(m) * 2 - 1) * amplitude;
}

function secouer(m: EtatMonde, force: number): void {
  m.camera.trauma = Math.min(1, m.camera.trauma + force);
}

// ---------------------------------------------------------------- effets

function hasard(m: EtatMonde): number {
  m.alea = (m.alea + 0x6d2b79f5) >>> 0;
  let t = m.alea;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function ajouter(m: EtatMonde, p: Particule): void {
  if (m.particules.length >= MAX_PARTICULES) m.particules.shift();
  m.particules.push(p);
}

function poussiere(m: EtatMonde, x: number, y: number, n: number): void {
  for (let i = 0; i < n; i++) {
    const vie = 0.3 + hasard(m) * 0.25;
    ajouter(m, {
      x: x + (hasard(m) - 0.5) * 16,
      y: y - 2,
      vx: (hasard(m) - 0.5) * 110,
      vy: -30 - hasard(m) * 60,
      vie,
      vieMax: vie,
      taille: 2 + hasard(m) * 3,
      couleur: hasard(m) < 0.5 ? '#f3e6cf' : '#ffffff',
      gravite: 120,
      forme: 'rond',
    });
  }
}

function etincelles(m: EtatMonde, x: number, y: number, n: number, couleur: string): void {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + hasard(m) * 0.5;
    const v = 90 + hasard(m) * 140;
    const vie = 0.35 + hasard(m) * 0.3;
    ajouter(m, {
      x,
      y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v - 40,
      vie,
      vieMax: vie,
      taille: 1.5 + hasard(m) * 2,
      couleur,
      gravite: 260,
      forme: 'etincelle',
    });
  }
}

function explosion(m: EtatMonde, x: number, y: number): void {
  for (let i = 0; i < 26; i++) {
    const a = hasard(m) * Math.PI * 2;
    const v = 60 + hasard(m) * 260;
    const vie = 0.4 + hasard(m) * 0.5;
    ajouter(m, {
      x,
      y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      vie,
      vieMax: vie,
      taille: 2 + hasard(m) * 4,
      couleur: ['#ffd54a', '#ff9f43', '#ff6b6b', '#ffffff'][Math.floor(hasard(m) * 4)],
      gravite: 300,
      forme: hasard(m) < 0.5 ? 'rond' : 'etincelle',
    });
  }
}

function feuArtifice(m: EtatMonde, x: number, y: number): void {
  const couleur = COULEURS_FEU[Math.floor(hasard(m) * COULEURS_FEU.length)];
  for (let i = 0; i < 30; i++) {
    const a = (i / 30) * Math.PI * 2;
    const v = 120 + hasard(m) * 60;
    const vie = 0.8 + hasard(m) * 0.4;
    ajouter(m, {
      x,
      y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      vie,
      vieMax: vie,
      taille: 2 + hasard(m) * 1.5,
      couleur,
      gravite: 90,
      forme: 'etincelle',
    });
  }
}

function bulle(m: EtatMonde, x: number, y: number, texte: string, couleur: string): void {
  m.bulles.push({ x, y, texte, vie: 0.9, vieMax: 0.9, couleur });
}

function majEffets(m: EtatMonde, dt: number): void {
  let n = 0;
  for (const p of m.particules) {
    p.vie -= dt;
    if (p.vie <= 0) continue;
    p.vx *= 1 - 1.5 * dt;
    p.vy += p.gravite * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    m.particules[n++] = p;
  }
  m.particules.length = n;
  n = 0;
  for (const b of m.bulles) {
    b.vie -= dt;
    if (b.vie <= 0) continue;
    b.y -= 34 * dt;
    m.bulles[n++] = b;
  }
  m.bulles.length = n;
  if (m.message) {
    m.message.vie -= dt;
    if (m.message.vie <= 0) m.message = null;
  }
  for (const s of m.solides) if (s.bosse > 0) s.bosse = Math.max(0, s.bosse - dt);
  for (const p of m.pieces) if (p.prise) p.tempsPrise += dt;
}

export { TOTAL_PIECES };
