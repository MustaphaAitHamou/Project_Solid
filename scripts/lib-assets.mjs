// Outils partagés par les scripts de manifeste et de vérification des ressources originales.
// Lecture seule : aucun fichier PNG/WAV n'est jamais modifié.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

export const DOSSIER_ORIGINAUX = 'originaux/mario-ahmed-aberkan';

export function sha256(chemin) {
  return createHash('sha256').update(readFileSync(chemin)).digest('hex');
}

/** Dimensions lues dans l'en-tête IHDR du PNG (sans décoder l'image). */
export function infosPng(chemin) {
  const d = readFileSync(chemin);
  if (d.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error(`${chemin} n'est pas un PNG`);
  return { largeur: d.readUInt32BE(16), hauteur: d.readUInt32BE(20) };
}

/** Format lu dans le bloc « fmt » du WAV. */
export function infosWav(chemin) {
  const d = readFileSync(chemin);
  if (d.toString('latin1', 0, 4) !== 'RIFF' || d.toString('latin1', 8, 12) !== 'WAVE')
    throw new Error(`${chemin} n'est pas un WAV`);
  let i = 12;
  let fmt = null;
  let octetsDonnees = 0;
  while (i + 8 <= d.length) {
    const id = d.toString('latin1', i, i + 4);
    const taille = d.readUInt32LE(i + 4);
    if (id === 'fmt ') {
      fmt = {
        codec: d.readUInt16LE(i + 8),
        canaux: d.readUInt16LE(i + 10),
        frequence: d.readUInt32LE(i + 12),
        alignement: d.readUInt16LE(i + 20),
        bits: d.readUInt16LE(i + 22),
      };
    } else if (id === 'data') {
      octetsDonnees = taille;
    }
    i += 8 + taille + (taille & 1);
  }
  if (!fmt) throw new Error(`${chemin} : bloc fmt absent`);
  return {
    codec: fmt.codec === 1 ? 'PCM' : `codec-${fmt.codec}`,
    canaux: fmt.canaux,
    frequence: fmt.frequence,
    bits: fmt.bits,
    duree: Math.round((octetsDonnees / (fmt.frequence * fmt.alignement)) * 1000) / 1000,
  };
}

export function listerFichiers(dossier) {
  return readdirSync(dossier)
    .filter((f) => statSync(join(dossier, f)).isFile())
    .sort();
}
