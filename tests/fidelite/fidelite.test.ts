/**
 * Tests de fidélité : le moteur TypeScript (en mode AUCUNE_CORRECTION) doit produire, tour par
 * tour, EXACTEMENT les mêmes états, appels de dessin et sons que le code Java original exécuté
 * par le harnais de référence (outils/harnais-java), pour chaque scénario d'entrées clavier.
 *
 * Les références sont des empreintes SHA-256 de blocs de 100 tours de la trace Java ;
 * pour « essai », la trace complète est aussi conservée (diagnostic détaillé).
 */
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { brotliDecompressSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { executerScenario, lireScenario } from './trace.ts';

const TAILLE_BLOC = 100;
const dossier = import.meta.dirname;
const scenarios = readdirSync(join(dossier, 'scenarios'))
  .filter((f) => f.endsWith('.txt'))
  .map((f) => f.slice(0, -4));

function lireReference(nom: string): { tours: number; empreintes: string[] } {
  const lignes = readFileSync(join(dossier, 'references', `${nom}.empreintes`), 'utf8')
    .split('\n')
    .filter((l) => l && !l.startsWith('#'));
  return { tours: Number(lignes[0].split(' ')[1]), empreintes: lignes.slice(1) };
}

/** Décrit la différence entre deux lignes canoniques, champ par champ. */
function decrireDifference(java: string, ts: string): string {
  const noms = [
    'tour',
    'scène',
    'mario',
    'champignons',
    'tortues',
    'pièces',
    'score',
    'temps',
    'sons',
    'dessins',
    'textes',
  ];
  const a = java.split('|');
  const b = ts.split('|');
  const lignes: string[] = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] !== b[i]) lignes.push(`  ${noms[i] ?? i}\n    java : ${a[i]}\n    ts   : ${b[i]}`);
  }
  return lignes.join('\n');
}

describe('Fidélité au jeu Java original (traces tour par tour)', () => {
  it('chaque scénario possède sa référence Java', () => {
    expect(scenarios.length).toBeGreaterThanOrEqual(10);
    for (const nom of scenarios) expect(existsSync(join(dossier, 'references', `${nom}.empreintes`)), nom).toBe(true);
  });

  for (const nom of scenarios) {
    it(`scénario « ${nom} » : identique au Java à chaque tour`, () => {
      const scenario = lireScenario(readFileSync(join(dossier, 'scenarios', `${nom}.txt`), 'utf8'));
      const reference = lireReference(nom);
      expect(scenario.ticks).toBe(reference.tours);

      const lignes = executerScenario(scenario);
      const ecarts: string[] = [];
      for (let b = 0; b < reference.empreintes.length; b++) {
        const bloc = lignes.slice(b * TAILLE_BLOC, (b + 1) * TAILLE_BLOC).join('\n') + '\n';
        const empreinte = createHash('sha256').update(bloc).digest('hex').slice(0, 16);
        if (empreinte !== reference.empreintes[b])
          ecarts.push(`tours ${b * TAILLE_BLOC + 1} à ${(b + 1) * TAILLE_BLOC}`);
      }
      if (ecarts.length > 0) {
        let detail = '';
        const complete = join(dossier, 'references', `${nom}.txt.br`);
        if (existsSync(complete)) {
          const java = brotliDecompressSync(readFileSync(complete)).toString('utf8').trimEnd().split('\n');
          const i = lignes.findIndex((l, k) => l !== java[k]);
          detail = `\nPremier écart au tour ${i + 1} :\n${decrireDifference(java[i], lignes[i])}`;
        }
        expect.fail(`${ecarts.length} bloc(s) différent(s) du Java : ${ecarts.slice(0, 5).join(', ')}${detail}`);
      }
    });
  }
});
