/**
 * Lecture des fichiers WAV PCM d'origine (lecture seule : le fichier n'est jamais modifié).
 *
 * Les 6 sons du jeu sont des WAV PCM (8 bits non signés ou 16 bits signés, mono ou stéréo,
 * 11 025 à 44 100 Hz). Les échantillons sont convertis tels quels en flottants dans un
 * AudioBuffer à la fréquence d'origine du fichier : aucun traitement, aucun ré-échantillonnage
 * préalable (le navigateur ré-échantillonne à la lecture, comme le faisait Java Sound).
 */
export interface WavPcm {
  canaux: number;
  frequence: number;
  bits: number;
  /** échantillons normalisés [-1, 1], un tableau par canal */
  donnees: Float32Array<ArrayBuffer>[];
}

export function lireWavPcm(octets: ArrayBuffer): WavPcm {
  const v = new DataView(octets);
  const texte = (i: number): string =>
    String.fromCharCode(v.getUint8(i), v.getUint8(i + 1), v.getUint8(i + 2), v.getUint8(i + 3));
  if (texte(0) !== 'RIFF' || texte(8) !== 'WAVE') throw new Error('Fichier WAV invalide');
  let fmt: { codec: number; canaux: number; frequence: number; alignement: number; bits: number } | null = null;
  let debutDonnees = -1;
  let tailleDonnees = 0;
  for (let i = 12; i + 8 <= v.byteLength; ) {
    const id = texte(i);
    const taille = v.getUint32(i + 4, true);
    if (id === 'fmt ') {
      fmt = {
        codec: v.getUint16(i + 8, true),
        canaux: v.getUint16(i + 10, true),
        frequence: v.getUint32(i + 12, true),
        alignement: v.getUint16(i + 20, true),
        bits: v.getUint16(i + 22, true),
      };
    } else if (id === 'data') {
      debutDonnees = i + 8;
      tailleDonnees = Math.min(taille, v.byteLength - debutDonnees);
    }
    i += 8 + taille + (taille & 1);
  }
  if (!fmt || debutDonnees < 0) throw new Error('WAV incomplet (bloc fmt ou data absent)');
  if (fmt.codec !== 1 || (fmt.bits !== 8 && fmt.bits !== 16)) {
    throw new Error(`Format WAV non PCM 8/16 bits (codec ${fmt.codec}, ${fmt.bits} bits)`);
  }
  const nbTrames = Math.floor(tailleDonnees / fmt.alignement);
  const donnees = Array.from({ length: fmt.canaux }, () => new Float32Array(nbTrames));
  const octetsParEchantillon = fmt.bits / 8;
  for (let t = 0; t < nbTrames; t++) {
    for (let c = 0; c < fmt.canaux; c++) {
      const pos = debutDonnees + t * fmt.alignement + c * octetsParEchantillon;
      donnees[c][t] = fmt.bits === 8 ? (v.getUint8(pos) - 128) / 128 : v.getInt16(pos, true) / 32768;
    }
  }
  return { canaux: fmt.canaux, frequence: fmt.frequence, bits: fmt.bits, donnees };
}
