import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, type Page } from '@playwright/test';

export type Entree = [number, 'appui' | 'relache', 'DROITE' | 'GAUCHE' | 'ESPACE'];

export interface EtatJeu {
  tours: number;
  tempsMs: number;
  xPos: number;
  dx: number;
  xFond1: number;
  xFond2: number;
  mario: { x: number; y: number; saut: boolean; vivant: boolean; versDroite: boolean; marche: boolean };
  score: number;
  piecesRestantes: number;
  compteurTemps: number;
  resultat: 'gagnee' | 'perdue' | null;
  premierResultat: 'gagnee' | 'perdue' | null;
  champs: { x: number; y: number; vivant: boolean }[];
  tortues: { x: number; y: number; vivant: boolean }[];
  touches: string[];
  dessins: string[];
  textes: string[];
}

export interface EtatModerne {
  pas: number;
  t: number;
  phase: 'intro' | 'jeu' | 'victoire' | 'defaite';
  cause: 'ennemi' | 'temps' | null;
  chrono: number;
  joueur: { x: number; y: number; vx: number; vy: number; auSol: boolean; etat: string; direction: number };
  camera: { x: number };
  stats: {
    pieces: number;
    ecrases: number;
    score: number;
    meilleurCombo: number;
    tempsFinal: number | null;
    bonus: number;
  };
  ennemis: { type: string; x: number; vivant: boolean }[];
  piecesRestantes: number;
  particules: number;
  touches: string[];
}

export interface Segment {
  pas: number;
  gauche: boolean;
  droite: boolean;
  saut: boolean;
}

interface CrochetTest {
  phase(): string;
  mode(): 'moderne' | 'classique';
  choisirMode(m: 'moderne' | 'classique'): void;
  etat(): EtatJeu | null;
  etatModerne(): EtatModerne | null;
  sons(): string[];
  journalAudio(): string[];
  executerSegments(segments: Segment[]): void;
  basculerPause(): void;
  audio(): { etat: string; sonsPrets: number; sourcesActives: number; muet: boolean; musiquePrete: boolean };
  niveauAudio(): number;
  descriptionSon(
    son: string,
    n: number,
  ): { frequence: number; canaux: number; duree: number; echantillons: number[] } | null;
  empreintes(): Record<string, string>;
  images(): { nom: string; largeur: number; hauteur: number }[];
  stats(): { imagesParSeconde: number; toursParSeconde: number };
  facteurAffichage(): number;
  facteurInterne(): number;
  imageLogique(): string;
  figerHorloge(): void;
  reprendreHorloge(): void;
  executerTours(n: number, entrees?: Entree[]): void;
}
declare global {
  interface Window {
    __jeuMario: CrochetTest;
  }
}

const RACINE = join(import.meta.dirname, '../..');
export const URL_JEU = '/jeux/mario-ahmed-aberkan';

/** Ouvre la page du jeu en mode test, dans le mode voulu, et attend la fin du chargement. */
export async function ouvrirJeu(page: Page, mode: 'moderne' | 'classique' = 'moderne'): Promise<void> {
  await page.goto(`${URL_JEU}?test`);
  await page.waitForFunction(() => window.__jeuMario?.phase() === 'pret');
  if ((await page.evaluate(() => window.__jeuMario.mode())) !== mode) {
    await page.evaluate((m) => window.__jeuMario.choisirMode(m), mode);
  }
}

export async function commencer(page: Page): Promise<void> {
  await page.click('.ks-mario__commencer');
  await expect.poll(() => page.evaluate(() => window.__jeuMario.phase())).toBe('en-cours');
  await expect
    .poll(() => page.evaluate(() => window.__jeuMario.etat()?.tours ?? window.__jeuMario.etatModerne()?.pas ?? 0))
    .toBeGreaterThan(0);
}

export const etatModerne = (page: Page): Promise<EtatModerne> => page.evaluate(() => window.__jeuMario.etatModerne()!);

/** Parcours gagnant du mode Moderne (outils/moderne/planifier-victoire.ts). */
export function parcoursVictoire(): Segment[] {
  return (
    JSON.parse(readFileSync(join(RACINE, 'tests/moderne/parcours-victoire.json'), 'utf8')) as { segments: Segment[] }
  ).segments;
}

/** Rejoue des segments du mode Moderne de façon déterministe (horloge figée). */
export async function rejouerSegments(page: Page, segments: Segment[]): Promise<void> {
  await page.evaluate(() => window.__jeuMario.figerHorloge());
  await page.click('#bouton-partie');
  await expect.poll(() => page.evaluate(() => window.__jeuMario.etatModerne()?.pas)).toBe(0);
  await page.evaluate((s) => window.__jeuMario.executerSegments(s), segments);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
}

export const etat = (page: Page): Promise<EtatJeu> => page.evaluate(() => window.__jeuMario.etat()!);
export const sons = (page: Page): Promise<string[]> => page.evaluate(() => window.__jeuMario.sons());

/** Entrées KeyListener brutes d'un scénario de tests/fidelite/scenarios. */
export function entreesScenario(nom: string): Entree[] {
  const texte = readFileSync(join(RACINE, 'tests/fidelite/scenarios', `${nom}.txt`), 'utf8');
  return texte
    .split(/\r?\n/)
    .map((l) => l.trim().split(/\s+/))
    .filter((p) => /^\d+$/.test(p[0]))
    .map((p) => [Number(p[0]), p[1] as Entree[1], p[2] as Entree[2]]);
}

/**
 * Rejoue un scénario de façon déterministe dans le navigateur : horloge figée, nouvelle partie,
 * puis exécution des tours avec les entrées exactes (les mêmes que celles validées sur le Java).
 */
export async function rejouerScenario(page: Page, nom: string, jusquAu: number): Promise<void> {
  const entrees = entreesScenario(nom).filter(([t]) => t <= jusquAu);
  await page.evaluate(() => window.__jeuMario.figerHorloge());
  await page.click('#bouton-partie');
  await expect.poll(() => page.evaluate(() => window.__jeuMario.etat()?.tours)).toBe(0);
  await page.evaluate(([n, e]) => window.__jeuMario.executerTours(n, e), [jusquAu, entrees] as const);
  // laisse une image se dessiner
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
}

/**
 * Compare l'image logique 700×350 du navigateur à une capture du rendu Java original
 * (tests/e2e/references). Les zones de texte sont exclues (polices rendues différemment).
 */
export async function comparerAuJava(
  page: Page,
  capture: string,
  messageDeFin: boolean,
): Promise<{ differents: number; compares: number; ecartMax: number; arrondis: number }> {
  const png = readFileSync(join(RACINE, 'tests/e2e/references', capture)).toString('base64');
  return page.evaluate(
    async ([b64, fin]) => {
      const octets = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const ref = await createImageBitmap(new Blob([octets], { type: 'image/png' }), { colorSpaceConversion: 'none' });
      const c1 = document.createElement('canvas');
      c1.width = 700;
      c1.height = 350;
      const x1 = c1.getContext('2d')!;
      x1.drawImage(ref, 0, 0);
      const java = x1.getImageData(0, 0, 700, 350).data;
      const img = new Image();
      img.src = window.__jeuMario.imageLogique();
      await img.decode();
      const c2 = document.createElement('canvas');
      c2.width = 700;
      c2.height = 350;
      const x2 = c2.getContext('2d')!;
      x2.drawImage(img, 0, 0);
      const web = x2.getImageData(0, 0, 700, 350).data;
      // Les sprites des personnages ont des bords semi-transparents : Java2D et le canvas
      // arrondissent différemment le mélange des couleurs (±1 ou 2 niveaux sur 255).
      let differents = 0;
      let compares = 0;
      let arrondis = 0;
      let ecartMax = 0;
      for (let y = 0; y < 350; y++) {
        for (let x = 0; x < 700; x++) {
          if (y < 33) continue; // crédit, score et temps
          if (fin && x >= 110 && x < 640 && y >= 130 && y < 200) continue; // message de fin
          compares++;
          const i = (y * 700 + x) * 4;
          const e = Math.max(
            Math.abs(java[i] - web[i]),
            Math.abs(java[i + 1] - web[i + 1]),
            Math.abs(java[i + 2] - web[i + 2]),
          );
          ecartMax = Math.max(ecartMax, e);
          if (e > 2) differents++;
          else if (e > 0) arrondis++;
        }
      }
      return { differents, compares, ecartMax, arrondis };
    },
    [png, messageDeFin] as const,
  );
}

/** Collecte les erreurs JavaScript et console d'une page. */
export function surveillerErreurs(page: Page): string[] {
  const erreurs: string[] = [];
  page.on('pageerror', (e) => erreurs.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') erreurs.push(`console: ${m.text()}`);
  });
  return erreurs;
}

/** Images affichées par seconde pendant `dureeMs`. */
export function mesurerImagesParSeconde(page: Page, dureeMs = 2000): Promise<number> {
  return page.evaluate(
    (d) =>
      new Promise<number>((r) => {
        let n = 0;
        const debut = performance.now();
        const f = (): void => {
          n++;
          if (performance.now() - debut < d) requestAnimationFrame(f);
          else r(n / ((performance.now() - debut) / 1000));
        };
        requestAnimationFrame(f);
      }),
    dureeMs,
  );
}

/** Proportion de pixels différents entre deux captures PNG de même taille (décodées dans la page). */
export function differencePixels(page: Page, a: Buffer, b: Buffer): Promise<number> {
  return page.evaluate(
    async ([pa, pb]) => {
      const lire = async (b64: string): Promise<ImageData> => {
        const octets = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        const img = await createImageBitmap(new Blob([octets], { type: 'image/png' }));
        const c = document.createElement('canvas');
        c.width = img.width;
        c.height = img.height;
        const x = c.getContext('2d')!;
        x.drawImage(img, 0, 0);
        return x.getImageData(0, 0, img.width, img.height);
      };
      const [ia, ib] = [await lire(pa), await lire(pb)];
      let n = 0;
      for (let i = 0; i < ia.data.length; i += 4) {
        const d =
          Math.abs(ia.data[i] - ib.data[i]) +
          Math.abs(ia.data[i + 1] - ib.data[i + 1]) +
          Math.abs(ia.data[i + 2] - ib.data[i + 2]);
        if (d > 24) n++;
      }
      return n / (ia.data.length / 4);
    },
    [a.toString('base64'), b.toString('base64')] as const,
  );
}
