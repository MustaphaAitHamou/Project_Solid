#!/usr/bin/env node
/**
 * Harnais de référence Java : exécute le code ORIGINAL du jeu (dépôt Project_Dhmed) sur les scénarios
 * de tests/fidelite/scenarios et produit les références tests/fidelite/references.
 *
 * Seules modifications apportées à une COPIE des sources Java (le dépôt n'est jamais modifié) :
 *   - les Thread.start() de Scene (Chrono), CompteARebours, Champ et Tortue sont retirés :
 *     le harnais exécute lui-même ces boucles aux cadences mesurées (horloge déterministe) ;
 *   - Audio.playSound() et Audio.stopSound() journalisent le son au lieu de le jouer / l'arrêter.
 * Les sources sont ensuite toutes converties en UTF-8 (Scene.java est en UTF-8, les autres en
 * Windows-1252, comme le précise la configuration Eclipse du projet) et compilées en UTF-8.
 * Toute la logique de jeu (collisions, sauts, animations, défilement…) est celle du Java d'origine.
 *
 * Prérequis : JDK 11+ (javac et java dans le PATH).
 * Usage : node outils/harnais-java/executer.mjs <chemin-du-depot-Project_Dhmed> [scenario…]
 */
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  cpSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { cpus, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { brotliCompressSync, constants } from 'node:zlib';

const RACINE = resolve(import.meta.dirname, '../..');
const SCENARIOS = join(RACINE, 'tests/fidelite/scenarios');
const REFERENCES = join(RACINE, 'tests/fidelite/references');
/** Captures du rendu Java (lignes « capture » des scénarios) pour la comparaison pixel à pixel E2E. */
const CAPTURES = join(RACINE, 'tests/e2e/references');
/** Scénarios dont la trace complète est aussi conservée (diagnostic détaillé en cas d'écart). */
const TRACES_COMPLETES = new Set(['essai']);
export const TAILLE_BLOC = 100;

const depot = process.argv[2] && resolve(process.argv[2]);
if (!depot) {
  console.error('Usage : node outils/harnais-java/executer.mjs <chemin-du-depot-Project_Dhmed> [scenario…]');
  process.exit(2);
}
const choisis = process.argv.slice(3);

// 1) Copie des sources et correctifs minimaux (octets préservés : les sources sont en Windows-1252)
const travail = mkdtempSync(join(tmpdir(), 'harnais-mario-'));
cpSync(join(depot, 'src'), join(travail, 'src'), { recursive: true });
function patcher(fichier, avant, apres, optionnel = false) {
  const chemin = join(travail, 'src/com/mosmos', fichier);
  const texte = readFileSync(chemin, 'latin1');
  if (texte.split(avant).length !== 2) {
    if (optionnel) return;
    throw new Error(`Correctif introuvable dans ${fichier} : ${avant}`);
  }
  writeFileSync(chemin, texte.replace(avant, apres), 'latin1');
}
patcher('jeu/Scene.java', 'chronoEcran.start();', '/* HARNAIS: chronoEcran.start(); */');
patcher('affichage/CompteARebours.java', 'compteARebours.start();', '/* HARNAIS: compteARebours.start(); */');
patcher('personnage/Champ.java', 'chronoChamp.start();', '/* HARNAIS: chronoChamp.start(); */');
patcher('personnage/Tortue.java', 'chronoChamp.start();', '/* HARNAIS: chronoChamp.start(); */');
patcher(
  'audio/Audio.java',
  '\t\tAudio s = new Audio(son);\n\t\ts.play();',
  '\t\tjournal.add(son); // HARNAIS (au lieu de : new Audio(son).play())',
);
patcher(
  'audio/Audio.java',
  '\t\tAudio s = new Audio(son);\n\t\ts.arrete();',
  '\t\tjournal.add("STOP " + son); // HARNAIS (au lieu de : new Audio(son).arrete())',
  true,
);
patcher(
  'audio/Audio.java',
  '\tpublic static void playSound(String son) {',
  '\tpublic static java.util.List<String> journal = new java.util.ArrayList<String>(); // HARNAIS\n\tpublic static void playSound(String son) {',
);

// 2) Compilation
const classes = join(travail, 'classes');
const sources = [];
const lister = (d) => {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    if (e.isDirectory()) lister(join(d, e.name));
    else if (e.name.endsWith('.java')) sources.push(join(d, e.name));
  }
};
lister(join(travail, 'src'));
// Encodages mixtes : chaque fichier est converti en UTF-8 selon son encodage réel
const utf8Strict = new TextDecoder('utf-8', { fatal: true });
const cp1252 = new TextDecoder('windows-1252');
for (const f of sources) {
  const octets = readFileSync(f);
  let texte;
  try {
    texte = utf8Strict.decode(octets);
  } catch {
    texte = cp1252.decode(octets);
  }
  writeFileSync(f, texte, 'utf8');
}
lister(join(import.meta.dirname, 'harnais'));
execFileSync('javac', ['-encoding', 'UTF-8', '-nowarn', '-d', classes, ...sources], { stdio: 'inherit' });
cpSync(join(depot, 'src/images'), join(classes, 'images'), { recursive: true });
cpSync(join(depot, 'src/audio'), join(classes, 'audio'), { recursive: true });

// 3) Exécution des scénarios (en parallèle)
const noms = readdirSync(SCENARIOS)
  .filter((f) => f.endsWith('.txt'))
  .map((f) => f.slice(0, -4))
  .filter((n) => choisis.length === 0 || choisis.includes(n));

function executer(nom) {
  return new Promise((ok, ko) => {
    const trace = join(travail, `${nom}.trace`);
    const captures = join(travail, `captures-${nom}`);
    mkdirSync(captures);
    // Le répertoire courant doit être le dépôt : Mario.marche() charge "src/images/..." en chemin relatif.
    const p = spawn(
      'java',
      ['-Djava.awt.headless=true', '-cp', classes, 'harnais.Harnais', join(SCENARIOS, `${nom}.txt`), trace, captures],
      {
        cwd: depot,
        stdio: ['ignore', 'inherit', 'inherit'],
      },
    );
    p.on('exit', (code) => (code === 0 ? ok(trace) : ko(new Error(`${nom} : code ${code}`))));
  });
}

export function empreintes(lignes) {
  const blocs = [];
  for (let i = 0; i < lignes.length; i += TAILLE_BLOC) {
    const bloc = lignes.slice(i, i + TAILLE_BLOC).join('\n') + '\n';
    blocs.push(createHash('sha256').update(bloc).digest('hex').slice(0, 16));
  }
  return blocs;
}

const enCours = new Set();
for (const nom of noms) {
  while (enCours.size >= Math.max(1, cpus().length - 1)) await Promise.race(enCours);
  const tache = executer(nom).then((trace) => {
    const texte = readFileSync(trace, 'utf8');
    const lignes = texte.trimEnd().split('\n');
    writeFileSync(
      join(REFERENCES, `${nom}.empreintes`),
      [
        `# Empreintes SHA-256 (16 car.) des traces du jeu Java original, par blocs de ${TAILLE_BLOC} tours`,
        `tours ${lignes.length}`,
        ...empreintes(lignes),
      ].join('\n') + '\n',
    );
    if (TRACES_COMPLETES.has(nom)) {
      writeFileSync(
        join(REFERENCES, `${nom}.txt.br`),
        brotliCompressSync(Buffer.from(texte), {
          params: { [constants.BROTLI_PARAM_QUALITY]: 11, [constants.BROTLI_PARAM_LGWIN]: 24 },
        }),
      );
    }
    for (const f of readdirSync(join(travail, `captures-${nom}`))) {
      mkdirSync(CAPTURES, { recursive: true });
      copyFileSync(join(travail, `captures-${nom}`, f), join(CAPTURES, `${nom}-${f.replace(/^java-/, '')}`));
    }
    console.log(`${nom} : ${lignes.length} tours`);
    enCours.delete(tache);
  });
  enCours.add(tache);
}
await Promise.all(enCours);
rmSync(travail, { recursive: true, force: true });
