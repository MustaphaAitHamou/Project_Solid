import type { CheminSon, SortieAudio } from '../engine/index.ts';
import { lireWavPcm } from './wav.ts';

type ContexteAudio = AudioContext;
interface FenetreAudio {
  AudioContext?: typeof AudioContext;
  webkitAudioContext?: typeof AudioContext;
}

export interface SonJoue {
  son: CheminSon;
  /** performance.now() au moment de la demande de lecture */
  instant: number;
}

/**
 * Lecture des sons originaux avec la Web Audio API.
 *
 * - Comme Audio.playSound() en Java (un nouveau Clip à chaque appel), chaque son est joué par
 *   une nouvelle source : plusieurs sons peuvent se superposer et aucun appel ne bloque le jeu.
 * - Les navigateurs interdisent le son avant une interaction : deverrouiller() doit être appelé
 *   pendant un geste de l'utilisateur (clic sur « Commencer », touche, toucher).
 * - Sans Web Audio, repli sur des éléments <audio> pointant vers les mêmes fichiers WAV.
 */
export class LecteurAudio implements SortieAudio {
  private contexte: ContexteAudio | null = null;
  /** Sortie commune de tous les sons (gain 1 : volume d'origine). */
  private sortie: GainNode | null = null;
  private analyseur: AnalyserNode | null = null;
  private readonly tampons = new Map<CheminSon, AudioBuffer>();
  private readonly sourcesActives = new Set<AudioScheduledSourceNode | HTMLAudioElement>();
  private readonly octets: Map<CheminSon, ArrayBuffer>;
  private readonly urls: Map<CheminSon, string>;
  /** Journal des sons demandés (utilisé par les tests automatisés). */
  readonly journal: SonJoue[] = [];

  constructor(octets: Map<CheminSon, ArrayBuffer>, urls: Map<CheminSon, string>) {
    this.octets = octets;
    this.urls = urls;
    // Décodage immédiat des WAV PCM, sans contexte audio (aucune restriction d'autoplay ici).
    if (typeof AudioBuffer !== 'undefined') {
      for (const [son, donnees] of octets) {
        try {
          const wav = lireWavPcm(donnees);
          const tampon = new AudioBuffer({
            length: wav.donnees[0].length,
            numberOfChannels: wav.canaux,
            sampleRate: wav.frequence,
          });
          wav.donnees.forEach((canal, i) => tampon.copyToChannel(canal, i));
          this.tampons.set(son, tampon);
        } catch {
          // décodé plus tard par decodeAudioData()
        }
      }
    }
  }

  get etat(): AudioContextState | 'indisponible' | 'non-deverrouille' {
    if (!this.contexte) return typeof AudioBuffer === 'undefined' ? 'indisponible' : 'non-deverrouille';
    return this.contexte.state;
  }

  /** Nombre de sons dont les données sont prêtes à être jouées. */
  get nbSonsPrets(): number {
    return this.tampons.size;
  }

  /** À appeler pendant un geste de l'utilisateur. Sans effet si déjà fait. */
  deverrouiller(): void {
    const w = window as unknown as FenetreAudio;
    const Contexte = w.AudioContext ?? w.webkitAudioContext;
    if (!Contexte) return;
    if (!this.contexte) {
      try {
        this.contexte = new Contexte({ latencyHint: 'interactive' });
      } catch {
        return;
      }
      this.sortie = this.contexte.createGain();
      this.sortie.connect(this.contexte.destination);
      // iOS : jouer un échantillon silencieux pendant le geste débloque la sortie audio
      const silence = this.contexte.createBuffer(1, 1, this.contexte.sampleRate);
      const source = this.contexte.createBufferSource();
      source.buffer = silence;
      source.connect(this.contexte.destination);
      source.start();
      // Repli : sons non décodés par lireWavPcm (format inattendu) -> décodeur du navigateur
      for (const [son, donnees] of this.octets) {
        if (!this.tampons.has(son)) {
          this.contexte
            .decodeAudioData(donnees.slice(0))
            .then((tampon) => this.tampons.set(son, tampon))
            .catch(() => console.error(`Son illisible par ce navigateur : ${son}`));
        }
      }
    }
    if (this.contexte.state === 'suspended') void this.contexte.resume();
  }

  playSound(son: CheminSon): void {
    this.journal.push({ son, instant: performance.now() });
    if (this.journal.length > 500) this.journal.splice(0, 100);
    const ctx = this.contexte;
    const tampon = this.tampons.get(son);
    if (ctx && tampon) {
      // (si le contexte reprend encore, la source démarrera dès qu'il sera actif)
      const source = ctx.createBufferSource();
      source.buffer = tampon;
      source.connect(this.sortie ?? ctx.destination);
      source.onended = () => this.sourcesActives.delete(source);
      this.sourcesActives.add(source);
      source.start();
    } else if (!ctx && typeof AudioBuffer === 'undefined') {
      // Repli sans Web Audio
      const url = this.urls.get(son);
      if (!url) return;
      const el = new Audio(url);
      el.onended = () => this.sourcesActives.delete(el);
      this.sourcesActives.add(el);
      void el.play().catch(() => this.sourcesActives.delete(el));
    }
  }

  /** Coupe tous les sons en cours (nouvelle partie, sortie de page). */
  toutArreter(): void {
    for (const s of this.sourcesActives) {
      try {
        if (s instanceof HTMLAudioElement) s.pause();
        else s.stop();
      } catch {
        /* déjà terminé */
      }
    }
    this.sourcesActives.clear();
  }

  /** Met le son en pause (onglet masqué) / le reprend. */
  suspendre(): void {
    if (this.contexte?.state === 'running') void this.contexte.suspend();
  }
  reprendre(): void {
    if (this.contexte?.state === 'suspended') void this.contexte.resume();
  }

  get nbSourcesActives(): number {
    return this.sourcesActives.size;
  }

  /** Diagnostic (tests) : niveau crête actuel du signal envoyé aux haut-parleurs. */
  niveauSortie(): number {
    if (!this.contexte || !this.sortie) return 0;
    if (!this.analyseur) {
      this.analyseur = this.contexte.createAnalyser();
      this.analyseur.fftSize = 2048;
      this.sortie.connect(this.analyseur);
    }
    const donnees = new Float32Array(this.analyseur.fftSize);
    this.analyseur.getFloatTimeDomainData(donnees);
    let crete = 0;
    for (const v of donnees) crete = Math.max(crete, Math.abs(v));
    return crete;
  }

  /** Diagnostic (tests) : format et premiers échantillons d'un son prêt à être joué. */
  description(
    son: CheminSon,
    nbEchantillons = 0,
  ): { frequence: number; canaux: number; duree: number; echantillons: number[] } | null {
    const t = this.tampons.get(son);
    if (!t) return null;
    return {
      frequence: t.sampleRate,
      canaux: t.numberOfChannels,
      duree: t.duration,
      echantillons: Array.from(t.getChannelData(0).subarray(0, nbEchantillons)),
    };
  }

  fermer(): void {
    this.toutArreter();
    void this.contexte?.close();
    this.contexte = null;
  }
}
