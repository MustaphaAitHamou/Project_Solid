/**
 * Génère des scénarios d'entrées clavier variés pour les tests de fidélité.
 *
 * Un « joueur » automatique (comportement tiré d'une graine) observe l'état du moteur à chaque
 * tour et produit des événements KeyListener BRUTS, comme le système les envoyait au jeu Java :
 * appui initial, répétition automatique (~30 Hz après ~0,5 s), relâchements, sauts, retours en
 * arrière… Le harnais Java rejoue ensuite exactement ces entrées sur le code original : toute
 * divergence entre les deux moteurs est détectée par tests/fidelite/fidelite.test.ts.
 *
 * Usage : node outils/fidelite/generer-scenarios.ts
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { AUCUNE_CORRECTION } from '../../src/games/mario-ahmed-aberkan/config.ts';
import { Partie, type Touche } from '../../src/games/mario-ahmed-aberkan/engine/index.ts';

const DOSSIER = join(import.meta.dirname, '../../tests/fidelite/scenarios');

/** Générateur pseudo-aléatoire déterministe (mulberry32). */
function aleatoire(graine: number): () => number {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Profil {
  ticks: number;
  /** distance (px) à laquelle le joueur saute devant un ennemi */
  distanceSaut: number;
  /** probabilité par tour de faire une action aléatoire */
  hasard: number;
  /** probabilité de reculer lors d'une action aléatoire */
  recul: number;
  /** probabilité qu'un saut soit « raté » (pas de saut devant un ennemi) */
  distraction: number;
}

function generer(graine: number, profil: Profil): string {
  const r = aleatoire(graine);
  const partie = new Partie({ corrections: AUCUNE_CORRECTION });
  const lignes: string[] = [
    `# Scénario généré (graine ${graine}) : ${JSON.stringify(profil)}`,
    `ticks ${profil.ticks}`,
  ];
  let maintenue: Touche | null = null; // flèche tenue par le « joueur »
  let depuisAppui = 0;
  let attenteReprise = 0;
  let espaceRelacheDans = -1;
  let directionForcee: { touche: Touche; reste: number } | null = null;

  for (let tick = 1; tick <= profil.ticks; tick++) {
    const ev: string[] = [];
    const appui = (t: Touche): void => {
      ev.push(`${tick} appui ${t}`);
      partie.clavier.keyPressed(t);
    };
    const relache = (t: Touche): void => {
      ev.push(`${tick} relache ${t}`);
      partie.clavier.keyReleased(t);
    };
    const s = partie.scene;
    const m = s.mario;

    // Relâchement d'Espace programmé (en Java, il arrête aussi le déplacement)
    if (espaceRelacheDans === 0) {
      relache('ESPACE');
      maintenue = null;
      attenteReprise = Math.floor(r() * 40);
    }
    if (espaceRelacheDans >= 0) espaceRelacheDans--;

    // Déplacement voulu : droite par défaut, parfois gauche ou arrêt
    let voulue: Touche | null = 'DROITE';
    if (directionForcee) {
      voulue = directionForcee.touche === 'ESPACE' ? null : directionForcee.touche;
      if (--directionForcee.reste <= 0) directionForcee = null;
    } else if (r() < profil.hasard) {
      const x = r();
      directionForcee = {
        touche: x < profil.recul ? 'GAUCHE' : x < profil.recul + 0.3 ? 'ESPACE' : 'DROITE',
        reste: 30 + Math.floor(r() * 400),
      };
    }

    if (attenteReprise > 0) {
      attenteReprise--;
    } else if (voulue !== maintenue) {
      if (maintenue) relache(maintenue);
      if (voulue) appui(voulue);
      maintenue = voulue;
      depuisAppui = 0;
    } else if (maintenue) {
      // Répétition automatique du système : ~0,5 s puis ~30 Hz
      depuisAppui++;
      if (depuisAppui > 150 && depuisAppui % 10 === 0) appui(maintenue);
    }

    // Sauts : devant un ennemi proche, contre un obstacle, ou au hasard
    if (m.isVivant() && espaceRelacheDans < 0) {
      const devant = [...s.getChamps(), ...s.getTortues()].some(
        (e) =>
          e.isVivant() &&
          e.getX() - (m.getX() + m.getLargeur()) > 0 &&
          e.getX() - (m.getX() + m.getLargeur()) < profil.distanceSaut,
      );
      const bloque = maintenue === 'DROITE' && s.getDx() === 0 && s.getxPos() >= 0;
      if (((devant && r() > profil.distraction) || bloque || r() < 0.002) && !m.isSaut()) {
        appui('ESPACE');
        espaceRelacheDans = Math.floor(r() * 120);
      } else if (m.isSaut() && r() < 0.003) {
        appui('ESPACE'); // appui en l'air : rejoue le son sans sauter (comportement Java)
        espaceRelacheDans = Math.floor(r() * 20);
      }
    }

    lignes.push(...ev);
    partie.executerTour();
  }
  return lignes.join('\n') + '\n';
}

const PROFILS: [number, Profil][] = [
  [11, { ticks: 9000, distanceSaut: 60, hasard: 0.004, recul: 0.3, distraction: 0.1 }],
  [23, { ticks: 9000, distanceSaut: 35, hasard: 0.006, recul: 0.4, distraction: 0.05 }],
  [37, { ticks: 12000, distanceSaut: 80, hasard: 0.003, recul: 0.2, distraction: 0.0 }],
  [41, { ticks: 12000, distanceSaut: 50, hasard: 0.008, recul: 0.5, distraction: 0.02 }],
  [53, { ticks: 6000, distanceSaut: 25, hasard: 0.01, recul: 0.3, distraction: 0.5 }],
  [67, { ticks: 15000, distanceSaut: 70, hasard: 0.002, recul: 0.1, distraction: 0.0 }],
  [79, { ticks: 15000, distanceSaut: 45, hasard: 0.005, recul: 0.35, distraction: 0.01 }],
  [97, { ticks: 15000, distanceSaut: 90, hasard: 0.004, recul: 0.25, distraction: 0.0 }],
];

for (const [graine, profil] of PROFILS) {
  const nom = `aleatoire-${graine}`;
  writeFileSync(join(DOSSIER, `${nom}.txt`), generer(graine, profil));
  // Résumé : jusqu'où le joueur est allé
  console.log(nom, 'généré');
}

// Scénario sans aucune entrée pendant 110 s : ennemis livrés à eux-mêmes, temps écoulé.
writeFileSync(
  join(DOSSIER, 'attente-110s.txt'),
  '# Aucune entrée : les ennemis se déplacent seuls, le compte à rebours passe sous zéro\nticks 34800\n',
);
console.log('attente-110s généré');
