/**
 * Mode Moderne : physique, collisions, règles du jeu d'origine, sons et déterminisme.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { CheminSon } from '../../src/games/mario-ahmed-aberkan/engine/types.ts';
import { PartieModerne } from '../../src/games/mario-ahmed-aberkan/moderne/PartieModerne.ts';
import { PAS, SOL } from '../../src/games/mario-ahmed-aberkan/moderne/reglages.ts';

interface Segment {
  pas: number;
  gauche: boolean;
  droite: boolean;
  saut: boolean;
}
const parcours = (
  JSON.parse(readFileSync(join(import.meta.dirname, 'parcours-victoire.json'), 'utf8')) as { segments: Segment[] }
).segments;

function nouvelle(): { p: PartieModerne; sons: { t: number; son: string }[] } {
  const sons: { t: number; son: string }[] = [];
  const p: PartieModerne = new PartieModerne({
    jouer: (son: CheminSon) => sons.push({ t: p.monde.t, son }),
    musique: (on) => sons.push({ t: p.monde.t, son: on ? 'MUSIQUE+' : 'MUSIQUE-' }),
  });
  return { p, sons };
}
const pas = (p: PartieModerne, n: number): void => {
  for (let i = 0; i < n; i++) p.executerPas();
};
const secondes = (s: number): number => Math.round(s / PAS);
function rejouer(p: PartieModerne, segments: Segment[]): void {
  for (const s of segments) {
    (s.droite ? p.toucheEnfoncee : p.toucheRelachee).call(p, 'DROITE');
    (s.gauche ? p.toucheEnfoncee : p.toucheRelachee).call(p, 'GAUCHE');
    (s.saut ? p.toucheEnfoncee : p.toucheRelachee).call(p, 'ESPACE');
    pas(p, s.pas);
  }
}
/** Partie après l'introduction (« Prêt ? Partez ! »). */
function enJeu(): ReturnType<typeof nouvelle> {
  const r = nouvelle();
  pas(r.p, secondes(0.8) + 1);
  expect(r.p.monde.phase).toBe('jeu');
  return r;
}

describe('Mode Moderne : déroulement', () => {
  it('le parcours gagnant mène à la victoire (10 pièces, musique arrêtée, son de victoire)', () => {
    const { p, sons } = nouvelle();
    rejouer(p, parcours);
    const m = p.monde;
    expect(m.phase).toBe('victoire');
    expect(m.stats.pieces).toBe(10);
    expect(m.stats.tempsFinal).toBeGreaterThan(10);
    expect(m.stats.tempsFinal).toBeLessThan(30);
    const noms = sons.map((s) => s.son);
    expect(noms[0]).toBe('MUSIQUE+');
    expect(noms.filter((s) => s === '/audio/issordiyen.wav')).toHaveLength(10);
    expect(noms.filter((s) => s === '/audio/partieGagnee.wav')).toHaveLength(1);
    expect(noms.indexOf('MUSIQUE-')).toBeLessThan(noms.indexOf('/audio/partieGagnee.wav'));
    // la séquence de fin : Mario rejoint la porte du château
    pas(p, secondes(4));
    expect(m.joueur.etat).toBe('entre');
  });

  it('est déterministe : mêmes entrées, même partie', () => {
    const a = nouvelle().p;
    const b = nouvelle().p;
    rejouer(a, parcours.slice(0, 60));
    rejouer(b, parcours.slice(0, 60));
    expect(JSON.stringify(a.monde)).toBe(JSON.stringify(b.monde));
  });

  it('le temps écoulé fait perdre (100 s)', () => {
    const { p, sons } = nouvelle();
    pas(p, secondes(102)); // 0,8 s d'introduction + 100 s + chronologie de la défaite
    expect(p.monde.phase).toBe('defaite');
    expect(p.monde.cause).toBe('temps');
    expect(sons.map((s) => s.son)).toContain('/audio/partiePerdue.wav');
  });
});

describe('Mode Moderne : physique', () => {
  it('saut maintenu ≈ 165 px (Java : 160), saut bref ≈ 70 px', () => {
    const { p, sons } = enJeu();
    p.toucheEnfoncee('ESPACE');
    let haut = Infinity;
    for (let i = 0; i < secondes(1); i++) {
      p.executerPas();
      haut = Math.min(haut, p.monde.joueur.y);
    }
    p.toucheRelachee('ESPACE');
    expect(SOL - 50 - haut).toBeGreaterThan(160);
    expect(SOL - 50 - haut).toBeLessThan(172);
    expect(sons.filter((s) => s.son === '/audio/saut.wav')).toHaveLength(1);
    p.toucheEnfoncee('ESPACE');
    p.executerPas();
    p.toucheRelachee('ESPACE');
    haut = Infinity;
    for (let i = 0; i < secondes(1); i++) {
      p.executerPas();
      haut = Math.min(haut, p.monde.joueur.y);
    }
    expect(SOL - 50 - haut).toBeGreaterThan(60);
    expect(SOL - 50 - haut).toBeLessThan(80);
  });

  it('accélération vive et vitesse maximale proche du Java (316 px/s)', () => {
    const { p } = enJeu();
    p.toucheEnfoncee('DROITE');
    pas(p, secondes(0.2));
    expect(p.monde.joueur.vx).toBe(330);
    p.toucheRelachee('DROITE');
    pas(p, secondes(0.15));
    expect(p.monde.joueur.vx).toBe(0);
  });

  it('le premier tuyau bloque Mario ; en sautant avec → maintenue, il passe par-dessus', () => {
    const { p } = enJeu();
    for (const e of p.monde.ennemis) e.vivant = false; // test isolé des ennemis
    p.toucheEnfoncee('DROITE');
    pas(p, secondes(1.5));
    const j = p.monde.joueur;
    expect(j.x + 24).toBe(600); // bord gauche du tuyau (x 600)
    p.toucheEnfoncee('ESPACE');
    pas(p, secondes(1.2));
    expect(j.x + 4).toBeGreaterThan(643); // au-delà du tuyau
    expect(j.auSol).toBe(true);
  });

  it('on peut se poser sur un tuyau', () => {
    const { p } = enJeu();
    const j = p.monde.joueur;
    j.x = 608;
    j.y = 100;
    j.auSol = false;
    pas(p, secondes(0.5));
    expect(j.auSol).toBe(true);
    expect(j.y).toBe(230 - 50);
  });

  it('un bloc cogné par-dessous arrête la montée et sursaute', () => {
    const { p } = enJeu();
    const m = p.monde;
    m.joueur.x = 401; // sous le bloc 1 (x 400, y 180)
    p.toucheEnfoncee('ESPACE');
    let cogne = false;
    for (let i = 0; i < secondes(0.5) && !cogne; i++) {
      p.executerPas();
      cogne = m.evenements.includes('bosse');
    }
    expect(cogne).toBe(true);
    expect(m.joueur.y + 6).toBeGreaterThanOrEqual(210);
    expect(m.solides.find((s) => s.type === 'bloc' && s.x === 400)!.bosse).toBeGreaterThan(0);
  });

  it('« coyote time » : on peut encore sauter juste après avoir quitté un rebord', () => {
    for (const [delai, attendu] of [
      [0.05, true],
      [0.2, false],
    ] as const) {
      const { p } = enJeu();
      const m = p.monde;
      m.joueur.x = 1345;
      m.joueur.y = 160 - 50; // sur le bloc 4 (x 1340, y 160), loin au-dessus du sol
      pas(p, 2);
      p.toucheEnfoncee('DROITE');
      while (m.joueur.auSol) p.executerPas();
      pas(p, secondes(delai));
      p.toucheEnfoncee('ESPACE');
      p.executerPas();
      expect(m.evenements.includes('saut'), `délai ${delai}`).toBe(attendu);
    }
  });

  it('un appui sur Saut juste avant d’atterrir est mémorisé', () => {
    const { p } = enJeu();
    const m = p.monde;
    p.toucheEnfoncee('ESPACE');
    p.executerPas();
    p.toucheRelachee('ESPACE');
    while (m.joueur.y + 50 < SOL - 12 || m.joueur.vy < 0) p.executerPas(); // presque au sol
    p.toucheEnfoncee('ESPACE');
    let sauts = 0;
    for (let i = 0; i < secondes(0.2); i++) {
      p.executerPas();
      if (m.evenements.includes('saut')) sauts++;
    }
    expect(sauts).toBe(1);
  });
});

describe('Mode Moderne : pièces et ennemis', () => {
  it('une pièce rapporte 100 points et joue issordiyen.wav', () => {
    const { p, sons } = nouvelle();
    rejouer(p, parcours);
    const premiere = sons.find((s) => s.son === '/audio/issordiyen.wav');
    expect(premiere).toBeDefined();
    expect(p.monde.stats.score).toBeGreaterThanOrEqual(1000);
  });

  it('écraser un champignon : cheikhLdjama3.wav, rebond, 200 points', () => {
    const { p, sons } = enJeu();
    const m = p.monde;
    const champ = m.ennemis.find((e) => e.type === 'champ')!;
    champ.x = 600 - 120; // devant le tuyau 1
    m.joueur.x = champ.x - 2;
    m.joueur.y = champ.y - 50 - 40; // au-dessus, en chute
    m.joueur.vy = 300;
    m.joueur.auSol = false;
    let ok = false;
    for (let i = 0; i < 40 && !ok; i++) {
      p.executerPas();
      ok = m.evenements.includes('ecrasement');
    }
    expect(ok).toBe(true);
    expect(champ.vivant).toBe(false);
    expect(m.joueur.vy).toBeLessThan(0); // rebond
    expect(m.stats.score).toBe(200);
    expect(sons.map((s) => s.son)).toContain('/audio/cheikhLdjama3.wav');
  });

  it('écraser une tortue joue A3rav.wav', () => {
    const { p, sons } = enJeu();
    const m = p.monde;
    const tortue = m.ennemis.find((e) => e.type === 'tortue')!;
    m.joueur.x = tortue.x;
    m.joueur.y = tortue.y - 50 - 30;
    m.joueur.vy = 300;
    m.joueur.auSol = false;
    for (let i = 0; i < 40 && tortue.vivant; i++) p.executerPas();
    expect(tortue.vivant).toBe(false);
    expect(sons.map((s) => s.son)).toContain('/audio/A3rav.wav');
  });

  it('toucher un ennemi de côté : boum.wav puis partiePerdue.wav 0,32 s plus tard, musique coupée', () => {
    const { p, sons } = enJeu();
    const m = p.monde;
    p.toucheEnfoncee('DROITE');
    m.ennemis[0].x = 360; // champignon juste devant Mario
    for (let i = 0; i < secondes(2) && m.phase === 'jeu'; i++) p.executerPas();
    expect(m.phase).toBe('defaite');
    expect(m.cause).toBe('ennemi');
    pas(p, secondes(1));
    const boum = sons.find((s) => s.son === '/audio/boum.wav')!;
    const perdue = sons.find((s) => s.son === '/audio/partiePerdue.wav')!;
    expect(perdue.t - boum.t).toBeGreaterThan(0.3);
    expect(perdue.t - boum.t).toBeLessThan(0.5);
    expect(sons.map((s) => s.son)).toContain('MUSIQUE-');
  });

  it('au drapeau sans les 10 pièces : pas de victoire, un message l’indique', () => {
    const { p } = enJeu();
    const m = p.monde;
    for (const e of m.ennemis) e.vivant = false;
    m.joueur.x = 4600;
    p.toucheEnfoncee('DROITE');
    pas(p, secondes(1));
    expect(m.phase).toBe('jeu');
    expect(m.message?.texte).toBe('Il manque 10 pièces !');
  });
});
