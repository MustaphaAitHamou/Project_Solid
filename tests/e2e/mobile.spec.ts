/**
 * Mobile (émulation Pixel 7 : écran tactile, densité 2,625) : commandes tactiles, cadrage, fluidité.
 */
import { expect, test, type Page } from '@playwright/test';
import { commencer, etatModerne, mesurerImagesParSeconde, ouvrirJeu, surveillerErreurs } from './outils.ts';

/** Toucher réel (événements tactiles du navigateur) via le protocole DevTools. */
async function toucher(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  const actifs = new Map<number, { x: number; y: number }>();
  const centre = async (selecteur: string) => {
    const b = (await page.locator(selecteur).boundingBox())!;
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  };
  // Chaque événement liste les doigts encore posés ; « touchEnd » (sans doigt) lève le dernier.
  const envoyer = (type: 'touchStart' | 'touchMove' | 'touchEnd') =>
    cdp.send('Input.dispatchTouchEvent', { type, touchPoints: [...actifs].map(([id, p]) => ({ id, ...p })) });
  return {
    async poser(id: number, selecteur: string) {
      actifs.set(id, await centre(selecteur));
      await envoyer('touchStart');
    },
    async lever(id: number) {
      actifs.delete(id);
      await envoyer(actifs.size > 0 ? 'touchMove' : 'touchEnd');
    },
  };
}

test('commandes tactiles : absentes avant la partie, présentes pendant', async ({ page }) => {
  await ouvrirJeu(page);
  await expect(page.locator('.ks-mario__tactile')).toBeHidden();
  await page.tap('.ks-mario__commencer');
  await expect(page.locator('.ks-mario__tactile')).toBeVisible();
  await expect(page.locator('.ks-mario__tactile-bouton')).toHaveCount(3);
});

test('6–8 (tactile). maintenir ▶ fait avancer Mario, ◀ reculer ; ▶ + Saut en même temps (multi-touch)', async ({
  page,
}) => {
  const erreurs = surveillerErreurs(page);
  await ouvrirJeu(page);
  await page.tap('.ks-mario__commencer');
  await expect.poll(async () => (await etatModerne(page)).phase).toBe('jeu');
  const doigts = await toucher(page);
  const x0 = (await etatModerne(page)).joueur.x;

  await doigts.poser(1, '.ks-mario__tactile-bouton--droite');
  await page.waitForTimeout(400);
  expect((await etatModerne(page)).joueur.x).toBeGreaterThan(x0 + 80);
  // second doigt sur « Saut » sans lâcher ▶
  await doigts.poser(2, '.ks-mario__tactile-bouton--espace');
  await expect.poll(async () => (await etatModerne(page)).joueur.vy, { timeout: 1000 }).toBeLessThan(0);
  await doigts.lever(2);
  const e = await etatModerne(page);
  await page.waitForTimeout(150);
  expect((await etatModerne(page)).joueur.x).toBeGreaterThan(e.joueur.x); // continue d'avancer en sautant
  await doigts.lever(1);
  await page.waitForTimeout(700); // retombe et s'arrête (légère inertie)
  const arret = (await etatModerne(page)).joueur.x;
  await page.waitForTimeout(200);
  expect((await etatModerne(page)).joueur.x).toBe(arret);

  await doigts.poser(3, '.ks-mario__tactile-bouton--gauche');
  await page.waitForTimeout(300);
  await doigts.lever(3);
  expect((await etatModerne(page)).joueur.x).toBeLessThan(arret);
  expect(erreurs).toEqual([]);
});

test('cadrage portrait : jeu en pleine largeur, proportions 2:1, aucun débordement', async ({ page }) => {
  await ouvrirJeu(page);
  const vue = page.viewportSize()!;
  const t = (await page.locator('.ks-mario__ecran').boundingBox())!;
  expect(t.width).toBeGreaterThan(vue.width * 0.95);
  expect(Math.abs(t.width / t.height - 2)).toBeLessThan(0.01);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
});

test('cadrage paysage : en-tête masqué, jeu sur toute la hauteur, sans défilement', async ({ page }) => {
  const vue = page.viewportSize()!;
  await page.setViewportSize({ width: vue.height, height: vue.width });
  await ouvrirJeu(page);
  await commencer(page);
  await expect(page.locator('.ks-entete')).toBeHidden();
  const t = (await page.locator('.ks-mario__ecran').boundingBox())!;
  const hauteur = page.viewportSize()!.height;
  expect(t.height).toBeGreaterThan(hauteur * 0.7);
  expect(t.y + t.height).toBeLessThanOrEqual(hauteur);
  expect(Math.abs(t.width / t.height - 2)).toBeLessThan(0.01);
  expect(
    await page.evaluate(() => [
      document.documentElement.scrollWidth - innerWidth,
      document.documentElement.scrollHeight - innerHeight,
    ]),
  ).toEqual([0, 0]);
  await expect(page.locator('.ks-mario__tactile')).toBeVisible();
});

test('20c. fluidité sur mobile : ~60 images/s et 120 pas/s (jeu) et accueil 3D', async ({ page }) => {
  await ouvrirJeu(page);
  await page.tap('.ks-mario__commencer');
  await page.waitForTimeout(500);
  const fps = await mesurerImagesParSeconde(page, 2500);
  const { toursParSeconde } = await page.evaluate(() => window.__jeuMario.stats());
  await page.goto('/');
  await expect(page.locator('.ks-heros__3d')).toHaveAttribute('data-etat', 'actif');
  const fps3d = await mesurerImagesParSeconde(page, 2500);
  test.info().annotations.push({
    type: 'mesure',
    description: `mobile : jeu ${fps.toFixed(1)} images/s, ${toursParSeconde} pas/s ; accueil 3D ${fps3d.toFixed(1)} images/s`,
  });
  expect(fps).toBeGreaterThan(50);
  expect(Math.abs(toursParSeconde - 120)).toBeLessThan(5);
  expect(fps3d).toBeGreaterThan(40);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
});
