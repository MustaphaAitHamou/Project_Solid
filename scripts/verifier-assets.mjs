#!/usr/bin/env node
// Vérifie que les ressources originales servies par le site sont strictement identiques
// (SHA-256 + taille) à celles inscrites dans le manifeste, sans fichier manquant ni en trop.
//
// Usage :
//   node scripts/verifier-assets.mjs                    -> vérifie public/
//   node scripts/verifier-assets.mjs dist               -> vérifie le build de production
//   node scripts/verifier-assets.mjs public --depot <chemin-MarioJava>
//        -> compare aussi avec src/ et bin/ du dépôt Java d'origine
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DOSSIER_ORIGINAUX, listerFichiers, sha256 } from './lib-assets.mjs';

const args = process.argv.slice(2);
const iDepot = args.indexOf('--depot');
const depot = iDepot >= 0 ? args[iDepot + 1] : null;
const cible = args.find((a, i) => !a.startsWith('--') && (iDepot < 0 || i !== iDepot + 1)) ?? 'public';

const racine = resolve(import.meta.dirname, '..');
const manifeste = JSON.parse(readFileSync(join(racine, 'src/games/mario-ahmed-aberkan/assets/manifeste.json'), 'utf8'));
const dossier = join(resolve(racine, cible), DOSSIER_ORIGINAUX);

let erreurs = 0;
const lignes = [];
for (const r of manifeste.ressources) {
  const chemin = join(dossier, r.fichier);
  if (!existsSync(chemin)) {
    console.error(`MANQUANT  ${r.fichier}`);
    erreurs++;
    continue;
  }
  const h = sha256(chemin);
  const ok = h === r.sha256 && statSync(chemin).size === r.octets;
  let comparaisonDepot = '';
  if (depot) {
    const hSrc = sha256(join(depot, 'src', r.fichier));
    const hBin = sha256(join(depot, 'bin', r.fichier));
    comparaisonDepot = hSrc === h && hBin === h ? ' = src/ = bin/' : ' ≠ DÉPÔT';
    if (hSrc !== h || hBin !== h) erreurs++;
  }
  if (!ok) erreurs++;
  lignes.push(`${ok ? 'OK  ' : 'ÉCHEC'} ${h}  ${r.fichier}${comparaisonDepot}`);
}
// Aucun fichier inattendu (ex. : copie convertie ou remplacée)
for (const sous of ['images', 'audio']) {
  for (const f of listerFichiers(join(dossier, sous))) {
    if (!manifeste.ressources.some((r) => r.fichier === `${sous}/${f}`)) {
      console.error(`INATTENDU ${sous}/${f}`);
      erreurs++;
    }
  }
}
console.log(lignes.join('\n'));
const nbImages = manifeste.ressources.filter((r) => r.type === 'image').length;
const nbSons = manifeste.ressources.length - nbImages;
if (erreurs) {
  console.error(`\n${erreurs} erreur(s) dans ${cible}/${DOSSIER_ORIGINAUX}`);
  process.exit(1);
}
console.log(`\n${nbImages} PNG + ${nbSons} WAV identiques au manifeste (SHA-256) dans ${cible}/${DOSSIER_ORIGINAUX}`);
