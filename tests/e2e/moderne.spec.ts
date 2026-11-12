/**
 * Mode Moderne (par défaut) dans un vrai navigateur, sur le build de production.
 */
import { expect, test, type Page } from '@playwright/test';
import { TEXTE_CREDIT } from '../../src/games/mario-ahmed-aberkan/engine/Scene.ts';
import {
  commencer,
  differencePixels,
  etatModerne,
  mesurerImagesParSeconde,
  ouvrirJeu,
  parcoursVictoire,
  rejouerSegments,
  sons,
  surveillerErreurs,
  type Segment,
} from './outils.ts';

const journal = (page: Page): Promise<string[]> => page.evaluate(() => window.__jeuMario.journalAudio());

/** Passe le tuyau 1, écrase un champignon puis meurt contre la tortue 1 (vérifié dans Node). */
const MORT: Segment[] = [
  { pas: 96, gauche: false, droite: false, saut: false },
  { pas: 180, gauche: false, droite: true, saut: false },
  { pas: 60, gauche: false, droite: true, saut: true },
  { pas: 600, gauche: false, droite: true, saut: false },
];

test('le mode Moderne est proposé par défaut, avec l’écran d’accueil du jeu', async ({ page }) => {
  const erreurs = surveillerErreurs(page);
  await ouvrirJeu(page);
  expect(await page.evaluate(() => window.__jeuMario.mode())).toBe('moderne');
  await expect(page.locator('.ks-mario__titre')).toHaveText('Mario Ahmed Aberkan');
  await expect(page.locator('.ks-mario__surtitre')).toHaveText('Super Ahmed Averkan Bros');
  await expect(page.locator('.ks-mario__commencer')).toHaveText('▶ Jouer');
  await expect(page.locator('.ks-mario__credit')).toHaveText(TEXTE_CREDIT);
  await expect(page.locator('.ks-bascule__option[data-mode="moderne"]')).toHaveAttribute('aria-pressed', 'true');
  expect(erreurs).toEqual([]);
});

test('6, 7 et 12. clavier : sauter (Espace, ↑ ou Z), courir (flèches ou Q/D), la caméra suit', async ({ page }) => {
  await ouvrirJeu(page);
  await commencer(page);
  await expect.poll(async () => (await etatModerne(page)).phase).toBe('jeu');
  // au départ (x 300), aucun bloc au-dessus de Mario : Z (code KeyW), ↑ et Espace font sauter
  const sauts = async (): Promise<number> => (await sons(page)).filter((s) => s === '/audio/saut.wav').length;
  for (const [i, t] of ['KeyW', 'ArrowUp', 'Space'].entries()) {
    await expect.poll(async () => (await etatModerne(page)).joueur.auSol).toBe(true);
    await page.keyboard.down(t);
    await expect.poll(sauts, { timeout: 1000 }).toBe(i + 1);
    expect((await etatModerne(page)).joueur.y).toBeLessThan(243);
    await page.keyboard.up(t);
  }
  await expect.poll(async () => (await etatModerne(page)).joueur.auSol).toBe(true);
  const e0 = await etatModerne(page);
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(500);
  const e1 = await etatModerne(page);
  expect(e1.joueur.x).toBeGreaterThan(e0.joueur.x + 100);
  expect(e1.joueur.vx).toBe(330);
  expect(e1.camera.x).toBeGreaterThan(e0.camera.x + 50);
  await page.keyboard.up('ArrowRight');
  // touche Q d'un clavier AZERTY (code KeyA) : vers la gauche
  await page.keyboard.down('KeyA');
  await page.waitForTimeout(250);
  const e2 = await etatModerne(page);
  expect(e2.joueur.direction).toBe(-1);
  expect(e2.joueur.x).toBeLessThan(e1.joueur.x + 60);
  await page.keyboard.up('KeyA');
});

test('7. saut modulable : maintenir Saut fait sauter bien plus haut qu’un appui bref', async ({ page }) => {
  await ouvrirJeu(page);
  await commencer(page);
  await expect.poll(async () => (await etatModerne(page)).phase).toBe('jeu');
  const sommet = async (duree: number): Promise<number> => {
    await expect.poll(async () => (await etatModerne(page)).joueur.auSol).toBe(true);
    await page.keyboard.down('Space');
    await page.waitForTimeout(duree);
    await page.keyboard.up('Space');
    let y = 999;
    for (let i = 0; i < 60; i++) {
      const e = await etatModerne(page);
      y = Math.min(y, e.joueur.y);
      if (e.joueur.auSol && i > 3) break;
      await page.waitForTimeout(12);
    }
    return 243 - y;
  };
  const haut = await sommet(450);
  const bref = await sommet(20);
  test.info().annotations.push({
    type: 'mesure',
    description: `saut maintenu ≈ ${haut.toFixed(0)} px, saut bref ≈ ${bref.toFixed(0)} px`,
  });
  expect(haut).toBeGreaterThan(140);
  expect(bref).toBeLessThan(110);
});

test('8. collisions : le tuyau bloque Mario ; en sautant avec → maintenue, il le franchit', async ({ page }) => {
  await ouvrirJeu(page);
  await commencer(page);
  await page.keyboard.down('ArrowRight');
  await expect.poll(async () => (await etatModerne(page)).joueur.x + 24, { timeout: 5000 }).toBe(600);
  await page.keyboard.down('Space');
  await expect.poll(async () => (await etatModerne(page)).joueur.x + 4, { timeout: 3000 }).toBeGreaterThan(643);
  await page.keyboard.up('Space');
  await page.keyboard.up('ArrowRight');
});

test('9, 10 et 15. victoire rejouée : 10 pièces, ennemis écrasés, sons, musique, écran de fin et record', async ({
  page,
}) => {
  const erreurs = surveillerErreurs(page);
  await ouvrirJeu(page);
  await rejouerSegments(page, parcoursVictoire());
  const e = await etatModerne(page);
  expect(e.phase).toBe('victoire');
  expect(e.stats.pieces).toBe(10);
  expect(e.stats.ecrases).toBeGreaterThan(0);
  const s = await sons(page);
  expect(s.filter((x) => x === '/audio/issordiyen.wav')).toHaveLength(10);
  expect(s.some((x) => x === '/audio/cheikhLdjama3.wav' || x === '/audio/A3rav.wav')).toBe(true);
  expect(s.filter((x) => x === '/audio/partieGagnee.wav')).toHaveLength(1);
  const j = await journal(page);
  expect(j.indexOf('play /audio/themeSong.wav')).toBeLessThan(j.indexOf('stop /audio/themeSong.wav'));
  // séquence de fin puis carte des résultats
  await page.evaluate(() => window.__jeuMario.reprendreHorloge());
  await expect(page.locator('.ks-mario__carte--fin')).toBeVisible({ timeout: 8000 });
  await expect(page.locator('.ks-mario__stats')).toContainText('10 / 10');
  await expect(page.locator('.ks-mario__badge')).toHaveText('Nouveau record !');
  // le record est gardé
  await page.reload();
  await page.waitForFunction(() => window.__jeuMario?.phase() === 'pret');
  await expect(page.locator('.ks-mario__record')).toContainText('Record :');
  expect(erreurs).toEqual([]);
});

test('9 et 14. défaite : un champignon écrasé puis contact latéral, sons, message et écran de fin', async ({
  page,
}) => {
  await ouvrirJeu(page);
  await rejouerSegments(page, MORT);
  const e = await etatModerne(page);
  expect(e.phase).toBe('defaite');
  expect(e.cause).toBe('ennemi');
  expect(e.stats.ecrases).toBe(1);
  const s = await sons(page);
  expect(s).toContain('/audio/cheikhLdjama3.wav');
  expect(s.slice(-2)).toEqual(['/audio/boum.wav', '/audio/partiePerdue.wav']);
  expect(await journal(page)).toContain('stop /audio/themeSong.wav');
  await page.evaluate(() => window.__jeuMario.reprendreHorloge());
  await expect(page.locator('.ks-mario__carte--fin')).toBeVisible({ timeout: 6000 });
  await expect(page.locator('.ks-mario__carte--fin .ks-mario__surtitre')).toHaveText('Perdu !');
  // Rejouer relance une partie
  await page.click('.ks-mario__rejouer-moderne');
  await expect.poll(async () => (await etatModerne(page)).phase).toBe('jeu');
});

test('14. temps écoulé : défaite après 100 s', async ({ page }) => {
  await ouvrirJeu(page);
  await rejouerSegments(page, [{ pas: 120 * 102, gauche: false, droite: false, saut: false }]);
  const e = await etatModerne(page);
  expect(e.phase).toBe('defaite');
  expect(e.cause).toBe('temps');
  await page.evaluate(() => window.__jeuMario.reprendreHorloge());
  await expect(page.locator('.ks-mario__carte--fin .ks-mario__surtitre')).toHaveText('Temps écoulé', { timeout: 6000 });
});

test('pause : Échap fige la partie et coupe le son, Échap la reprend', async ({ page }) => {
  await ouvrirJeu(page);
  await commencer(page);
  await page.waitForTimeout(300);
  await page.keyboard.press('Escape');
  await expect(page.locator('.ks-mario__voile--pause')).toBeVisible();
  expect(await page.evaluate(() => window.__jeuMario.phase())).toBe('pause');
  const pas = (await etatModerne(page)).pas;
  await page.waitForTimeout(400);
  expect((await etatModerne(page)).pas).toBe(pas);
  await expect.poll(async () => (await page.evaluate(() => window.__jeuMario.audio())).etat).toBe('suspended');
  await page.keyboard.press('Escape');
  await expect(page.locator('.ks-mario__voile--pause')).toBeHidden();
  await page.waitForTimeout(300);
  expect((await etatModerne(page)).pas).toBeGreaterThan(pas + 20);
  // le bouton pause du cadre fonctionne aussi
  await page.click('.ks-mario__barre-pause');
  await expect(page.locator('.ks-mario__voile--pause')).toBeVisible();
  await page.click('[data-action="reprendre"]');
  await expect(page.locator('.ks-mario__voile--pause')).toBeHidden();
});

test('son : M coupe et rétablit le son, la préférence est mémorisée', async ({ page }) => {
  await ouvrirJeu(page);
  await commencer(page);
  await page.keyboard.press('KeyM');
  await expect.poll(async () => (await page.evaluate(() => window.__jeuMario.audio())).muet).toBe(true);
  await expect(page.locator('.ks-mario__barre .ks-mario__icone[aria-pressed]')).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await page.waitForFunction(() => window.__jeuMario?.phase() === 'pret');
  expect((await page.evaluate(() => window.__jeuMario.audio())).muet).toBe(true);
  await commencer(page);
  await page.keyboard.press('KeyM');
  await expect.poll(async () => (await page.evaluate(() => window.__jeuMario.audio())).muet).toBe(false);
});

test('changer de version depuis la page (Moderne ⇄ Classique)', async ({ page }) => {
  await ouvrirJeu(page);
  await page.click('.ks-bascule__option[data-mode="classique"]');
  await expect(page.locator('.ks-mario__commencer')).toHaveText('▶ Jouer (classique)');
  await page.click('.ks-mario__commencer');
  await expect.poll(() => page.evaluate(() => window.__jeuMario.etat()?.tours ?? 0)).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.__jeuMario.mode())).toBe('classique');
  await page.click('.ks-bascule__option[data-mode="moderne"]');
  await expect
    .poll(async () => (await page.evaluate(() => window.__jeuMario.etatModerne()))?.pas ?? 0)
    .toBeGreaterThan(0);
  expect(await page.evaluate(() => window.__jeuMario.mode())).toBe('moderne');
});

test('manette : stick vers la droite et bouton A', async ({ page }) => {
  await page.addInitScript(() => {
    const pad = {
      axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
      connected: true,
      index: 0,
      id: 'test',
    };
    (window as unknown as { __pad: typeof pad }).__pad = pad;
    Object.defineProperty(navigator, 'getGamepads', { value: () => [pad] });
  });
  await ouvrirJeu(page);
  await commencer(page);
  await page.evaluate(() => window.dispatchEvent(new Event('gamepadconnected')));
  await expect.poll(async () => (await etatModerne(page)).phase).toBe('jeu');
  // bouton A au départ (rien au-dessus de Mario) : saut
  await page.evaluate(
    () => ((window as unknown as { __pad: { buttons: { pressed: boolean }[] } }).__pad.buttons[0].pressed = true),
  );
  await expect.poll(async () => (await sons(page)).filter((s) => s === '/audio/saut.wav').length).toBe(1);
  await page.evaluate(
    () => ((window as unknown as { __pad: { buttons: { pressed: boolean }[] } }).__pad.buttons[0].pressed = false),
  );
  // stick vers la droite : Mario court
  const x0 = (await etatModerne(page)).joueur.x;
  await page.evaluate(() => ((window as unknown as { __pad: { axes: number[] } }).__pad.axes[0] = 1));
  await page.waitForTimeout(300);
  expect((await etatModerne(page)).joueur.x).toBeGreaterThan(x0 + 50);
});

test('18. plein écran en mode moderne', async ({ page }) => {
  await ouvrirJeu(page);
  await commencer(page);
  await page.click('#bouton-plein-ecran');
  await expect.poll(() => page.evaluate(() => document.fullscreenElement?.className ?? '')).toContain('ks-mario');
  const vue = page.viewportSize()!;
  const t = (await page.locator('.ks-mario__ecran').boundingBox())!;
  expect(Math.max(t.width / vue.width, t.height / vue.height)).toBeGreaterThan(0.99);
  expect(Math.abs(t.width / t.height - 2)).toBeLessThan(0.01);
  await page.evaluate(() => document.exitFullscreen());
});

test('20. fluide : ~60 images/s, 120 pas de simulation/s, l’image bouge à chaque instant', async ({ page }) => {
  await ouvrirJeu(page);
  await commencer(page);
  await page.keyboard.down('ArrowRight');
  const fps = await mesurerImagesParSeconde(page, 2500);
  const { toursParSeconde } = await page.evaluate(() => window.__jeuMario.stats());
  const a = await page.locator('.ks-mario__ecran').screenshot();
  await page.waitForTimeout(120);
  const b = await page.locator('.ks-mario__ecran').screenshot();
  await page.keyboard.up('ArrowRight');
  test.info().annotations.push({
    type: 'mesure',
    description: `moderne : ${fps.toFixed(1)} images/s, ${toursParSeconde} pas/s`,
  });
  expect(fps).toBeGreaterThan(50);
  expect(Math.abs(toursParSeconde - 120)).toBeLessThan(5);
  expect(await differencePixels(page, a, b)).toBeGreaterThan(0.02);
});
