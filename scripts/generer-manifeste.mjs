#!/usr/bin/env node
// Génère src/games/mario-ahmed-aberkan/assets/manifeste.json à partir des fichiers copiés
// dans public/originaux/mario-ahmed-aberkan, en vérifiant qu'ils sont identiques (SHA-256)
// aux fichiers du dépôt Java d'origine.
//
// Usage : node scripts/generer-manifeste.mjs <chemin-du-depot-MarioJava>
import { writeFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DOSSIER_ORIGINAUX, infosPng, infosWav, listerFichiers, sha256 } from './lib-assets.mjs';

const depot = process.argv[2];
if (!depot) {
  console.error('Usage : node scripts/generer-manifeste.mjs <chemin-du-depot-MarioJava>');
  process.exit(2);
}
const racine = resolve(import.meta.dirname, '..');
const copies = join(racine, 'public', DOSSIER_ORIGINAUX);

const entrees = [];
for (const [type, sousDossier] of [
  ['image', 'images'],
  ['son', 'audio'],
]) {
  for (const fichier of listerFichiers(join(copies, sousDossier))) {
    const copie = join(copies, sousDossier, fichier);
    const original = join(depot, 'src', sousDossier, fichier);
    const empreinte = sha256(copie);
    const empreinteOriginal = sha256(original);
    if (empreinte !== empreinteOriginal) {
      console.error(`ÉCHEC : ${fichier} diffère de l'original`);
      process.exit(1);
    }
    const nom = fichier.replace(/\.(png|wav)$/, '');
    entrees.push({
      nom,
      type,
      fichier: `${sousDossier}/${fichier}`,
      original: `src/${sousDossier}/${fichier}`,
      octets: statSync(copie).size,
      sha256: empreinte,
      ...(type === 'image' ? infosPng(copie) : infosWav(copie)),
    });
  }
}

const manifeste = {
  description:
    'Ressources originales du jeu Java MarioJava (src/images et src/audio), copiées sans aucune modification.',
  depot: 'https://github.com/MustaphaAitHamou/MarioJava',
  dossierPublic: `/${DOSSIER_ORIGINAUX}`,
  ressources: entrees,
};
const sortie = join(racine, 'src/games/mario-ahmed-aberkan/assets/manifeste.json');
writeFileSync(sortie, JSON.stringify(manifeste, null, 2) + '\n');
console.log(`${entrees.length} ressources inscrites dans ${sortie}`);
