/**
 * Jeu « Mario Ahmed Aberkan » dans un vrai navigateur (build de production).
 * Les numéros renvoient à la liste de vérifications du cahier des charges.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import {
  commencer,
  comparerAuJava,
  etat,
  mesurerImagesParSeconde,
  ouvrirJeu,
  rejouerScenario,
  sons,
  surveillerErreurs,
  URL_JEU,
} from './outils.ts';

const RACINE = join(import.meta.dirname, '../..');
const manifeste = JSON.parse(
  readFileSync(join(RACINE, 'src/games/mario-ahmed-aberkan/assets/manifeste.json'), 'utf8'),
) as {
  ressources: { nom: string; type: string; fichier: string; sha256: string; largeur?: number; hauteur?: number }[];
};

test.describe('Ressources originales et rendu', () => {
  test('4. les 28 PNG et 6 WAV chargés sont les fichiers originaux (SHA-256 vérifiés dans le navigateur)', async ({
    page,
    request,
  }) => {
    const erreurs = surveillerErreurs(page);
    await ouvrirJeu(page);
    const empreintes = await page.evaluate(() => window.__jeuMario.empreintes());
    expect(Object.keys(empreintes)).toHaveLength(34);
    for (const r of manifeste.ressources) expect(empreintes[r.fichier], r.fichier).toBe(r.sha256);
    // et le serveur sert exactement les octets du dépôt Java
    for (const r of manifeste.ressources) {
      const octets = await (await request.get(`/originaux/mario-ahmed-aberkan/${r.fichier}`)).body();
      expect(createHash('sha256').update(octets).digest('hex'), r.fichier).toBe(r.sha256);
    }
    expect(erreurs).toEqual([]);
  });

  test('5. les images gardent leurs dimensions et le jeu ses proportions 2:1', async ({ page }) => {
    await ouvrirJeu(page);
    const images = await page.evaluate(() => window.__jeuMario.images());
    expect(images).toHaveLength(28);
    for (const i of images) {
      const r = manifeste.ressources.find((m) => m.nom === i.nom)!;
      expect([i.largeur, i.hauteur], i.nom).toEqual([r.largeur, r.hauteur]);
    }
    for (const [l, h] of [
      [1280, 800],
      [1920, 1080],
      [1024, 600],
      [800, 1000],
    ]) {
      await page.setViewportSize({ width: l, height: h });
      await page.waitForTimeout(200);
      const t = await page.locator('.ks-mario__ecran').boundingBox();
      expect(Math.abs(t!.width / t!.height - 2), `${l}×${h}`).toBeLessThan(0.01);
      // la résolution interne est un multiple entier exact de 700×350 (pixels nets, sans déformation)
      const k = await page.evaluate(() => window.__jeuMario.facteurInterne());
      const [cw, ch] = await page.locator('.ks-mario__ecran').evaluate((c: HTMLCanvasElement) => [c.width, c.height]);
      expect([cw, ch]).toEqual([700 * k, 350 * k]);
    }
  });

  const CAPTURES: [string, string, number, boolean][] = [
    ['première image', 'essai', 1, false],
    ['saut contre le premier tuyau', 'essai', 300, false],
    ['explosion à la mort de Mario', 'aleatoire-37', 700, true],
    ['Mario mort qui s’envole', 'aleatoire-37', 900, true],
    ['milieu du niveau', 'victoire', 2000, false],
    ['écran de victoire', 'victoire', 4710, true],
  ];
  for (const [nom, scenario, tour, fin] of CAPTURES) {
    test(`4. rendu identique au pixel près au jeu Java : ${nom} (tour ${tour})`, async ({ page }) => {
      await ouvrirJeu(page);
      await rejouerScenario(page, scenario, tour);
      const { differents, compares } = await comparerAuJava(page, `${scenario}-${tour}.png`, fin);
      expect(compares).toBeGreaterThan(180_000); // 700×350 moins les zones de texte
      expect(differents).toBe(0);
    });
  }
});

test.describe('Jouabilité au clavier (temps réel)', () => {
  test('6. Mario se déplace à droite puis à gauche, le décor défile (12)', async ({ page }) => {
    await ouvrirJeu(page);
    await commencer(page);
    const e0 = await etat(page);
    expect(e0.xPos).toBe(-1);
    await page.keyboard.down('ArrowRight');
    await page.waitForTimeout(500);
    const e1 = await etat(page);
    expect(e1.xPos).toBeGreaterThan(100); // ≈316 px/s
    expect(e1.mario.versDroite).toBe(true);
    expect(e1.xFond1).not.toBe(e0.xFond1); // 12. le décor défile
    expect(e1.dessins.find((d) => d.startsWith('chateau1'))).not.toBe(e0.dessins.find((d) => d.startsWith('chateau1')));
    await page.keyboard.up('ArrowRight');
    await page.keyboard.down('ArrowLeft');
    await page.waitForTimeout(250);
    await page.keyboard.up('ArrowLeft');
    const e2 = await etat(page);
    expect(e2.xPos).toBeLessThan(e1.xPos);
    expect(e2.mario.versDroite).toBe(false);
    expect(e2.mario.x).toBe(300); // comme en Java, Mario reste au centre et le monde défile
  });

  test('7. Mario saute (même hauteur et même trajectoire qu’en Java) et 13. le son de saut est joué', async ({
    page,
  }) => {
    await ouvrirJeu(page);
    await commencer(page);
    await page.keyboard.press('Space');
    let minY = 999;
    const debut = Date.now();
    let fini = false;
    while (Date.now() - debut < 2000 && !fini) {
      const e = await etat(page);
      minY = Math.min(minY, e.mario.y);
      fini = minY < 243 && !e.mario.saut;
      await page.waitForTimeout(20);
    }
    // sommet du saut : 245 - 160 = 85 (montée de 4 px × 40 tours) ; échantillonnage toutes les 20 ms
    expect(minY).toBeGreaterThanOrEqual(85);
    expect(minY).toBeLessThanOrEqual(95);
    expect((await etat(page)).mario.y).toBe(243); // retombé au sol
    expect(await sons(page)).toEqual(['/audio/saut.wav']);
  });

  test('8. collisions : le premier tuyau bloque Mario ; maintenir → et sauter permet de le franchir', async ({
    page,
  }) => {
    await ouvrirJeu(page);
    await commencer(page);
    await page.keyboard.down('ArrowRight');
    await expect.poll(async () => (await etat(page)).xPos, { timeout: 5000 }).toBe(272);
    await page.waitForTimeout(300);
    expect((await etat(page)).xPos).toBe(272); // bloqué contre le tuyau
    await page.keyboard.press('Space'); // la flèche droite reste enfoncée
    await expect.poll(async () => (await etat(page)).xPos, { timeout: 3000 }).toBeGreaterThan(272 + 43);
    await page.keyboard.up('ArrowRight');
  });

  test('11. le compte à rebours décompte en temps réel et le score s’affiche', async ({ page }) => {
    await ouvrirJeu(page);
    await commencer(page);
    const e0 = await etat(page);
    expect(e0.textes).toEqual(['0pièce(s) trouvée(s) sur 10', 'Temps restant : 100']);
    await page.waitForTimeout(2600);
    const e1 = await etat(page);
    expect(e1.compteurTemps).toBe(98);
    expect(e1.textes[1]).toBe('Temps restant : 98');
  });

  test('19. les touches du jeu ne font pas défiler la page et n’activent pas les boutons', async ({ page }) => {
    await ouvrirJeu(page);
    await page.evaluate(() => (document.body.style.paddingBottom = '2000px')); // page défilable
    await commencer(page);
    const hauteur = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
    expect(hauteur).toBeGreaterThan(0);
    await page.evaluate(() => window.scrollTo(0, 0));
    for (const t of ['Space', 'ArrowRight', 'ArrowLeft', 'ArrowDown', 'Space']) {
      await page.keyboard.press(t);
    }
    await page.keyboard.down('ArrowRight');
    await page.waitForTimeout(300);
    await page.keyboard.up('ArrowRight');
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    // Espace avec le focus sur « Recommencer » : Mario saute, la partie n'est pas relancée
    const tours = (await etat(page)).tours;
    await page.locator('#bouton-partie').focus();
    await page.keyboard.press('Space');
    await page.waitForTimeout(200);
    const e = await etat(page);
    expect(e.tours).toBeGreaterThan(tours);
    expect(e.mario.saut || e.mario.y < 243).toBe(true);
  });

  test('focus : le jeu reste jouable après un clic ailleurs ; perte de focus de la fenêtre = touches relâchées', async ({
    page,
  }) => {
    await ouvrirJeu(page);
    await commencer(page);
    await page.mouse.click(5, 5); // clic hors du jeu
    await page.keyboard.down('ArrowRight');
    await page.waitForTimeout(200);
    expect((await etat(page)).dx).toBe(1);
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await page.waitForTimeout(50);
    const e = await etat(page);
    expect(e.touches).toEqual([]);
    expect(e.dx).toBe(0);
    await page.keyboard.up('ArrowRight');
  });
});

test.describe('Ennemis, pièces, défaite, victoire (entrées rejouées à l’identique du Java)', () => {
  test('9. les ennemis se déplacent seuls et font demi-tour', async ({ page }) => {
    await ouvrirJeu(page);
    await commencer(page);
    const parcours = new Array(8).fill(0);
    let precedent = await etat(page);
    for (let i = 0; i < 10; i++) {
      await page.waitForTimeout(100);
      const e = await etat(page);
      e.champs.forEach((c, k) => (parcours[k] += Math.abs(c.x - precedent.champs[k].x)));
      precedent = e;
    }
    for (const d of parcours) expect(d).toBeGreaterThan(45); // ≈66 px/s, Mario immobile
    // la tortue 1 part vers la droite et fait demi-tour contre le 2e tuyau (x = 1000)
    expect(precedent.tortues[0].x).toBeLessThan(950);
  });

  test('10. une pièce se ramasse (score, son « piece.wav »)', async ({ page }) => {
    await ouvrirJeu(page);
    await rejouerScenario(page, 'victoire', 700);
    const e = await etat(page);
    expect(e.score).toBe(1);
    expect(e.piecesRestantes).toBe(9);
    expect(e.textes[0]).toBe('1pièce(s) trouvée(s) sur 10');
    expect(await sons(page)).toContain('/audio/piece.wav');
  });

  test('9 et 14. un ennemi écrasé puis la défaite : sons, message et « Rejouer »', async ({ page }) => {
    await ouvrirJeu(page);
    // aleatoire-23 : un champignon est écrasé, puis Mario meurt au tour 6322
    await rejouerScenario(page, 'aleatoire-23', 6500);
    const e = await etat(page);
    expect(e.champs.some((c) => !c.vivant)).toBe(true);
    expect(e.mario.vivant).toBe(false);
    expect(e.premierResultat).toBe('perdue');
    expect(e.textes).toContain('Vous avez perdu...');
    const s = await sons(page);
    expect(s.indexOf('/audio/ecrasePersonnage.wav')).toBeGreaterThanOrEqual(0);
    expect(s.slice(-2)).toEqual(['/audio/boum.wav', '/audio/partiePerdue.wav']);
    await expect(page.locator('.ks-mario__rejouer')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.ks-mario')).toHaveAttribute('data-phase', 'terminee');
  });

  test('14. perdre par manque de temps (100 s)', async ({ page }) => {
    await ouvrirJeu(page);
    await rejouerScenario(page, 'attente-110s', 31700);
    const e = await etat(page);
    expect(e.compteurTemps).toBe(0); // figé à 0 (le Java continuait en négatif)
    expect(e.premierResultat).toBe('perdue');
    expect(e.textes).toContain('Vous avez perdu...');
  });

  test('15. terminer le niveau : 10 pièces, arrivée, « Vous avez gagné !! » et partieGagnee.wav', async ({ page }) => {
    await ouvrirJeu(page);
    await rejouerScenario(page, 'victoire', 4800);
    const e = await etat(page);
    expect(e.score).toBe(10);
    expect(e.xPos).toBeGreaterThan(4400);
    expect(e.premierResultat).toBe('gagnee');
    expect(e.textes).toContain('Vous avez gagné !!');
    expect((await sons(page)).filter((s) => s === '/audio/partieGagnee.wav')).toHaveLength(1);
    await expect(page.locator('.ks-mario__rejouer')).toBeVisible({ timeout: 5000 });
    // le résultat ne change plus, même après la fin théorique du temps
    await page.evaluate(() => window.__jeuMario.executerTours(30000));
    expect((await etat(page)).textes).toContain('Vous avez gagné !!');
  });
});

test.describe('Parties successives, plein écran, audio, fluidité', () => {
  test('16 et 17. plusieurs parties sans rechargement de la page', async ({ page }) => {
    const erreurs = surveillerErreurs(page);
    await ouvrirJeu(page);
    await page.evaluate(() => ((window as unknown as { __marqueur: number }).__marqueur = 42));
    for (let partie = 1; partie <= 5; partie++) {
      if (partie === 1) await commencer(page);
      else await page.click('#bouton-partie');
      await expect.poll(async () => (await etat(page)).tours).toBeLessThan(400);
      const e = await etat(page);
      expect([e.xPos, e.score, e.compteurTemps, e.mario.vivant]).toEqual([-1, 0, 100, true]);
      await page.keyboard.down('ArrowRight');
      await page.keyboard.press('Space');
      await page.waitForTimeout(700);
      await page.keyboard.up('ArrowRight');
      expect((await etat(page)).xPos).toBeGreaterThan(100);
    }
    expect(await page.evaluate(() => (window as unknown as { __marqueur: number }).__marqueur)).toBe(42);
    // une seule boucle active : la cadence reste celle du Java
    await page.waitForTimeout(1200);
    const { toursParSeconde } = await page.evaluate(() => window.__jeuMario.stats());
    expect(Math.abs(toursParSeconde - 316.5)).toBeLessThan(8);
    expect(erreurs).toEqual([]);
  });

  test('18. affichage plein écran', async ({ page }) => {
    await ouvrirJeu(page);
    await commencer(page);
    await page.click('#bouton-plein-ecran');
    await expect.poll(() => page.evaluate(() => document.fullscreenElement?.className ?? '')).toContain('ks-mario');
    await expect(page.locator('#bouton-plein-ecran')).toHaveText('Quitter le plein écran');
    const vue = page.viewportSize()!;
    const t = (await page.locator('.ks-mario__ecran').boundingBox())!;
    expect(Math.max(t.width / vue.width, t.height / vue.height)).toBeGreaterThan(0.99); // remplit l'écran
    expect(Math.abs(t.width / t.height - 2)).toBeLessThan(0.01); // sans déformation
    // le jeu reste jouable en plein écran
    await page.keyboard.down('ArrowRight');
    await page.waitForTimeout(300);
    await page.keyboard.up('ArrowRight');
    expect((await etat(page)).xPos).toBeGreaterThan(50);
    await page.keyboard.press('Escape');
    await page.evaluate(() => (document.fullscreenElement ? document.exitFullscreen() : undefined));
    await expect.poll(() => page.evaluate(() => document.fullscreenElement === null)).toBe(true);
    await expect(page.locator('#bouton-plein-ecran')).toHaveText('Plein écran');
  });

  test('13. audio : contexte déverrouillé au clic, 6 sons décodés, sons superposés sans blocage', async ({ page }) => {
    await ouvrirJeu(page);
    expect((await page.evaluate(() => window.__jeuMario.audio())).etat).toBe('non-deverrouille');
    await commencer(page);
    await expect.poll(async () => (await page.evaluate(() => window.__jeuMario.audio())).etat).toBe('running');
    expect((await page.evaluate(() => window.__jeuMario.audio())).sonsPrets).toBe(6);
    // 10 sauts rapprochés : 10 sons, le jeu continue à sa cadence
    const t0 = (await etat(page)).tours;
    for (let i = 0; i < 10; i++) await page.keyboard.press('Space', { delay: 15 });
    await page.waitForTimeout(500);
    expect((await sons(page)).filter((s) => s === '/audio/saut.wav')).toHaveLength(10);
    expect((await etat(page)).tours - t0).toBeGreaterThan(150);
  });

  test('13. audio : les échantillons joués sont ceux des WAV d’origine et un signal sort réellement', async ({
    page,
  }) => {
    await ouvrirJeu(page);
    await commencer(page);
    for (const r of manifeste.ressources.filter((m) => m.type === 'son')) {
      const wav = readFileSync(join(RACINE, 'public/originaux/mario-ahmed-aberkan', r.fichier));
      // lecture indépendante du fichier : format et 2000 premiers échantillons du canal gauche
      const canaux = wav.readUInt16LE(22);
      const frequence = wav.readUInt32LE(24);
      const bits = wav.readUInt16LE(34);
      let i = 12;
      while (wav.toString('latin1', i, i + 4) !== 'data') i += 8 + wav.readUInt32LE(i + 4);
      const debut = i + 8;
      const pas = (bits / 8) * canaux;
      const attendus = Array.from({ length: 2000 }, (_, k) =>
        bits === 8 ? (wav.readUInt8(debut + k * pas) - 128) / 128 : wav.readInt16LE(debut + k * pas) / 32768,
      );
      const d = (await page.evaluate(([son]) => window.__jeuMario.descriptionSon(son, 2000), [
        `/${r.fichier}`,
      ] as const))!;
      expect([d.frequence, d.canaux], r.fichier).toEqual([frequence, canaux]);
      expect(Math.abs(d.duree - wav.readUInt32LE(i + 4) / (frequence * pas))).toBeLessThan(0.001);
      expect(d.echantillons.map((v) => Math.fround(v))).toEqual(attendus.map((v) => Math.fround(v)));
    }
    // silence, puis signal non nul juste après un saut
    expect(await page.evaluate(() => window.__jeuMario.niveauAudio())).toBe(0);
    await page.keyboard.press('Space');
    let crete = 0;
    for (let k = 0; k < 10 && crete === 0; k++) {
      await page.waitForTimeout(25);
      crete = Math.max(crete, await page.evaluate(() => window.__jeuMario.niveauAudio()));
    }
    test.info().annotations.push({ type: 'mesure', description: `niveau crête après un saut : ${crete.toFixed(3)}` });
    expect(crete).toBeGreaterThan(0.05);
  });

  test('20b. jeu fluide sur ordinateur : ~60 images/s et 316 tours de logique/s', async ({ page }) => {
    await ouvrirJeu(page);
    await commencer(page);
    await page.keyboard.down('ArrowRight');
    const fps = await mesurerImagesParSeconde(page, 2500);
    await page.keyboard.up('ArrowRight');
    const { toursParSeconde } = await page.evaluate(() => window.__jeuMario.stats());
    test
      .info()
      .annotations.push({
        type: 'mesure',
        description: `ordinateur : ${fps.toFixed(1)} images/s, ${toursParSeconde} tours/s`,
      });
    expect(fps).toBeGreaterThan(50);
    expect(Math.abs(toursParSeconde - 316.5)).toBeLessThan(8);
  });

  test('page sans paramètre de test : aucun crochet de test exposé', async ({ page }) => {
    await page.goto(URL_JEU);
    await expect(page.locator('#bouton-partie')).toBeEnabled();
    expect(await page.evaluate(() => 'game' in window || '__jeuMario' in window)).toBe(false);
  });
});
