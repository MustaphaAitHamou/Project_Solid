/**
 * Site KABYLE SOLIDE : chargement, scène Three.js, navigation, routes, mise en page responsive.
 */
import { expect, test } from '@playwright/test';
import { differencePixels, mesurerImagesParSeconde, surveillerErreurs, URL_JEU } from './outils.ts';

test('1. le site se charge correctement (titre, contenu, aucune erreur)', async ({ page }) => {
  const erreurs = surveillerErreurs(page);
  const reponse = await page.goto('/');
  expect(reponse?.status()).toBe(200);
  await expect(page).toHaveTitle('KABYLE SOLIDE');
  await expect(page.locator('h1')).toHaveText(/KABYLE\s*SOLIDE/);
  await expect(page.locator('.ks-nav')).toBeVisible();
  await expect(page.locator('.ks-carte')).toHaveCount(1);
  await expect(page.locator('.ks-carte__titre')).toHaveText('Mario Ahmed Aberkan');
  await page.waitForTimeout(1500);
  expect(erreurs).toEqual([]);
});

test('2. la scène Three.js fonctionne (WebGL, rendu animé, pause hors écran)', async ({ page }) => {
  await page.goto('/');
  const canvas = page.locator('.ks-heros__3d');
  await expect(canvas).toHaveAttribute('data-engine', /three\.js r\d+/);
  await expect(canvas).toHaveAttribute('data-etat', 'actif');
  await expect.poll(async () => Number(await canvas.getAttribute('data-images'))).toBeGreaterThan(60);

  // Ce que dessine WebGL : comparaison du héros avec et sans le canvas 3D
  const heros = page.locator('.ks-heros');
  const avec3d = await heros.screenshot();
  await canvas.evaluate((c) => (c.style.visibility = 'hidden'));
  const sans3d = await heros.screenshot();
  await canvas.evaluate((c) => (c.style.visibility = ''));
  const part = await differencePixels(page, avec3d, sans3d);
  test
    .info()
    .annotations.push({
      type: 'mesure',
      description: `pixels dessinés par la scène 3D : ${(part * 100).toFixed(1)} %`,
    });
  expect(part).toBeGreaterThan(0.03);

  // Animation : deux captures successives diffèrent
  const a = await canvas.screenshot();
  await page.waitForTimeout(400);
  const b = await canvas.screenshot();
  expect(a.equals(b)).toBe(false);

  // Pause du rendu quand la scène sort de l'écran
  await page.setViewportSize({ width: 1280, height: 420 });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(canvas).toHaveAttribute('data-etat', 'pause');
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(canvas).toHaveAttribute('data-etat', 'actif');
});

test('3. la navigation mène au jeu et en revient', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: '▶ Jouer à Mario Ahmed Aberkan' }).click();
  await expect(page).toHaveURL(URL_JEU);
  await expect(page.locator('h1')).toHaveText('Mario Ahmed Aberkan');
  await expect(page.getByRole('link', { name: 'Jeux' })).toHaveAttribute('aria-current', 'page');
  await page.getByRole('link', { name: '← Accueil' }).click();
  await expect(page).toHaveURL('/');
  // depuis la carte du catalogue
  await page.getByRole('link', { name: 'Jouer à Mario Ahmed Aberkan', exact: true }).click();
  await expect(page).toHaveURL(URL_JEU);
  await page.getByRole('link', { name: 'Retour à l’accueil' }).click();
  await expect(page).toHaveURL('/');
});

test('routes : avec ou sans barre oblique finale, ressources originales, page 404', async ({ request }) => {
  for (const chemin of [URL_JEU, `${URL_JEU}/`]) {
    const r = await request.get(chemin);
    expect(r.status(), chemin).toBe(200);
    expect(await r.text()).toContain('<h1>Mario Ahmed Aberkan</h1>');
  }
  const png = await request.get('/originaux/mario-ahmed-aberkan/images/marioArretDroite.png');
  expect(png.headers()['content-type']).toBe('image/png');
  const wav = await request.get('/originaux/mario-ahmed-aberkan/audio/saut.wav');
  expect(wav.headers()['content-type']).toMatch(/audio\/(wav|x-wav|wave)/);
  expect((await request.get('/page-qui-n-existe-pas')).status()).toBe(404);
});

for (const largeur of [320, 390, 768, 1280, 1920]) {
  test(`mise en page responsive sans défilement horizontal (${largeur} px)`, async ({ page }) => {
    await page.setViewportSize({ width: largeur, height: 800 });
    for (const chemin of ['/', URL_JEU]) {
      await page.goto(chemin);
      await page.waitForTimeout(300);
      const debordement = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(debordement, chemin).toBeLessThanOrEqual(0);
    }
  });
}

test('20a. accueil fluide : scène 3D à ~60 images/s', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.ks-heros__3d')).toHaveAttribute('data-etat', 'actif');
  const fps = await mesurerImagesParSeconde(page);
  test.info().annotations.push({ type: 'mesure', description: `accueil : ${fps.toFixed(1)} images/s` });
  expect(fps).toBeGreaterThan(50);
});
