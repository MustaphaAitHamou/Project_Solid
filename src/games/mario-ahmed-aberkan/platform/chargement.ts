import manifeste from '../assets/manifeste.json';
import type { CheminSon, NomImage } from '../engine/index.ts';

export interface RessourceImage {
  nom: NomImage;
  source: CanvasImageSource;
  largeur: number;
  hauteur: number;
}

export interface RessourcesJeu {
  images: Map<NomImage, RessourceImage>;
  sons: Map<CheminSon, ArrayBuffer>;
  urlsSons: Map<CheminSon, string>;
  /** SHA-256 calculés dans le navigateur (si demandé) : fichier -> empreinte */
  empreintes: Map<string, string>;
}

export interface EntreeManifeste {
  nom: string;
  type: 'image' | 'son';
  fichier: string;
  sha256: string;
  octets: number;
  largeur?: number;
  hauteur?: number;
}

export const MANIFESTE = manifeste as { dossierPublic: string; ressources: EntreeManifeste[] };

/** URL publique d'une ressource originale (servie telle quelle depuis public/originaux). */
export function urlRessource(fichier: string): string {
  return `${import.meta.env.BASE_URL}${MANIFESTE.dossierPublic.replace(/^\//, '')}/${fichier}`;
}

async function hexSha256(octets: ArrayBuffer): Promise<string> {
  const h = await crypto.subtle.digest('SHA-256', octets);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Décode un PNG original sans aucune transformation de couleur (pas de conversion d'espace
 * colorimétrique) et vérifie que ses dimensions sont exactement celles de son en-tête.
 */
async function decoderImage(
  octets: ArrayBuffer,
  url: string,
): Promise<CanvasImageSource & { width: number; height: number }> {
  const blob = new Blob([octets], { type: 'image/png' });
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(blob, { colorSpaceConversion: 'none', premultiplyAlpha: 'default' });
    } catch {
      try {
        return await createImageBitmap(blob);
      } catch {
        /* repli <img> ci-dessous */
      }
    }
  }
  const img = new Image();
  img.decoding = 'async';
  img.src = url;
  await img.decode();
  return img;
}

/**
 * Charge les 28 PNG et 6 WAV originaux listés dans le manifeste.
 * En cas d'échec, une erreur explicite est levée : aucune ressource n'est jamais remplacée.
 */
export async function chargerRessources(
  surProgression?: (chargees: number, total: number) => void,
  verifierEmpreintes = false,
): Promise<RessourcesJeu> {
  const res: RessourcesJeu = { images: new Map(), sons: new Map(), urlsSons: new Map(), empreintes: new Map() };
  const total = MANIFESTE.ressources.length;
  let chargees = 0;
  surProgression?.(0, total);

  await Promise.all(
    MANIFESTE.ressources.map(async (r) => {
      const url = urlRessource(r.fichier);
      const reponse = await fetch(url);
      if (!reponse.ok) throw new Error(`Ressource introuvable : ${r.fichier} (HTTP ${reponse.status})`);
      const octets = await reponse.arrayBuffer();
      if (octets.byteLength !== r.octets) throw new Error(`Taille inattendue pour ${r.fichier}`);
      if (verifierEmpreintes) {
        const h = await hexSha256(octets);
        res.empreintes.set(r.fichier, h);
        if (h !== r.sha256) throw new Error(`Empreinte SHA-256 différente pour ${r.fichier}`);
      }
      if (r.type === 'image') {
        const image = await decoderImage(octets, url);
        if (image.width !== r.largeur || image.height !== r.hauteur) {
          throw new Error(`Dimensions inattendues pour ${r.fichier} : ${image.width}×${image.height}`);
        }
        res.images.set(r.nom as NomImage, {
          nom: r.nom as NomImage,
          source: image,
          largeur: image.width,
          hauteur: image.height,
        });
      } else {
        const chemin = `/${r.fichier}` as CheminSon; // « /audio/saut.wav », comme dans le code Java
        res.sons.set(chemin, octets);
        res.urlsSons.set(chemin, url);
      }
      surProgression?.(++chargees, total);
    }),
  );
  return res;
}
