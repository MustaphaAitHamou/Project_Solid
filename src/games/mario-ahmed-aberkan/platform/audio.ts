import type { CheminSon, SortieAudio } from '../engine/index.ts';
import { lireWavPcm } from './wav.ts';

interface FenetreAudio {
  AudioContext?: typeof AudioContext;
  webkitAudioContext?: typeof AudioContext;
}

export interface SonJoue {
  son: CheminSon;
  /** 'play' ou 'stop', comme Audio.playSound / Audio.stopSound du Java */
  action: 'play' | 'stop';
  /** performance.now() au moment de la demande */
  instant: number;
}

export interface OptionsMusique {
  boucle?: boolean;
  /** volume de la musique (0 à 1), sous les effets sonores */
  volume?: number;
  /** durée du fondu d'entrée, en secondes */
  fondu?: number;
}

interface SourceActive {
  source: AudioBufferSourceNode | HTMLAudioElement;
  gain: GainNode | null;
}

/**
 * Lecture des sons originaux (fichiers WAV d'origine) avec la Web Audio API.
 *
 * - Comme Audio.playSound() en Java (un nouveau Clip à chaque appel), chaque son est joué par
 *   une nouvelle source : plusieurs sons peuvent se superposer et aucun appel ne bloque le jeu.
 * - stopSound(son) arrête réellement les lectures en cours de ce son.
 * - Les gros fichiers (musique, jingles de fin) peuvent arriver après le démarrage : un son
 *   demandé avant d'être prêt est joué dès son arrivée (sauf s'il a été arrêté entre-temps).
 * - Les navigateurs interdisent le son avant une interaction : deverrouiller() doit être appelé
 *   pendant un geste de l'utilisateur (clic sur « Jouer », touche, toucher).
 * - Sans Web Audio, repli sur des éléments <audio> pointant vers les mêmes fichiers WAV.
 */
export class LecteurAudio implements SortieAudio {
  private contexte: AudioContext | null = null;
  /** gain général (coupure du son) */
  private maitre: GainNode | null = null;
  private analyseur: AnalyserNode | null = null;
  private readonly tampons = new Map<CheminSon, AudioBuffer>();
  private readonly octets = new Map<CheminSon, ArrayBuffer>();
  private readonly urls: Map<CheminSon, string>;
  private readonly actives = new Map<CheminSon, Set<SourceActive>>();
  /** sons demandés avant que leurs données soient prêtes */
  private readonly enAttente = new Map<CheminSon, OptionsMusique | null>();
  private muet = false;
  /** Journal des sons demandés (utilisé par les tests automatisés). */
  readonly journal: SonJoue[] = [];

  constructor(octets: Map<CheminSon, ArrayBuffer>, urls: Map<CheminSon, string>) {
    this.urls = urls;
    for (const [son, donnees] of octets) this.ajouterSon(son, donnees);
  }

  /** Ajoute les données d'un son (chargé plus tard) et lance une lecture en attente. */
  ajouterSon(son: CheminSon, donnees: ArrayBuffer): void {
    this.octets.set(son, donnees);
    // Décodage des WAV PCM sans contexte audio (aucune restriction d'autoplay ici)
    if (typeof AudioBuffer !== 'undefined') {
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
        this.decoderAvecLeNavigateur(son);
      }
    }
    this.lancerSiEnAttente(son);
  }

  private decoderAvecLeNavigateur(son: CheminSon): void {
    const donnees = this.octets.get(son);
    if (!this.contexte || !donnees || this.tampons.has(son)) return;
    this.contexte
      .decodeAudioData(donnees.slice(0))
      .then((tampon) => {
        this.tampons.set(son, tampon);
        this.lancerSiEnAttente(son);
      })
      .catch(() => console.error(`Son illisible par ce navigateur : ${son}`));
  }

  private lancerSiEnAttente(son: CheminSon): void {
    if (!this.enAttente.has(son) || !this.tampons.has(son) || !this.contexte) return;
    const options = this.enAttente.get(son) ?? null;
    this.enAttente.delete(son);
    this.demarrer(son, options);
  }

  get etat(): AudioContextState | 'indisponible' | 'non-deverrouille' {
    if (!this.contexte) return typeof AudioBuffer === 'undefined' ? 'indisponible' : 'non-deverrouille';
    return this.contexte.state;
  }

  /** Nombre de sons dont les données sont prêtes à être jouées. */
  get nbSonsPrets(): number {
    return this.tampons.size;
  }

  estPret(son: CheminSon): boolean {
    return this.tampons.has(son);
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
      this.maitre = this.contexte.createGain();
      this.maitre.gain.value = this.muet ? 0 : 1;
      this.maitre.connect(this.contexte.destination);
      // iOS : jouer un échantillon silencieux pendant le geste débloque la sortie audio
      const silence = this.contexte.createBuffer(1, 1, this.contexte.sampleRate);
      const source = this.contexte.createBufferSource();
      source.buffer = silence;
      source.connect(this.contexte.destination);
      source.start();
      for (const son of this.octets.keys()) this.decoderAvecLeNavigateur(son);
      for (const son of [...this.enAttente.keys()]) this.lancerSiEnAttente(son);
    }
    if (this.contexte.state === 'suspended') void this.contexte.resume();
  }

  // ---------------------------------------------------------------- SortieAudio (Java)

  playSound(son: CheminSon): void {
    this.noter(son, 'play');
    this.demarrer(son, null);
  }

  stopSound(son: CheminSon): void {
    this.noter(son, 'stop');
    this.enAttente.delete(son);
    this.arreter(son, 0);
  }

  // ---------------------------------------------------------------- musique (mode moderne)

  /** Lance une musique (en boucle par défaut), avec fondu d'entrée. */
  jouerMusique(son: CheminSon, options: OptionsMusique = {}): void {
    this.noter(son, 'play');
    this.arreter(son, 0);
    this.demarrer(son, { boucle: true, volume: 0.5, fondu: 0.6, ...options });
  }

  /** Arrête une musique avec un fondu de sortie (en secondes). */
  arreterMusique(son: CheminSon, fondu = 0.4): void {
    this.noter(son, 'stop');
    this.enAttente.delete(son);
    this.arreter(son, fondu);
  }

  // ---------------------------------------------------------------- interne

  private noter(son: CheminSon, action: 'play' | 'stop'): void {
    this.journal.push({ son, action, instant: performance.now() });
    if (this.journal.length > 500) this.journal.splice(0, 100);
  }

  private demarrer(son: CheminSon, musique: OptionsMusique | null): void {
    const ctx = this.contexte;
    const tampon = this.tampons.get(son);
    if (ctx && this.maitre && tampon) {
      // (si le contexte reprend encore, la source démarrera dès qu'il sera actif)
      const source = ctx.createBufferSource();
      source.buffer = tampon;
      let gain: GainNode | null = null;
      if (musique) {
        source.loop = musique.boucle ?? true;
        gain = ctx.createGain();
        const t = ctx.currentTime;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(musique.volume ?? 0.5, t + (musique.fondu ?? 0.6));
        source.connect(gain);
        gain.connect(this.maitre);
      } else {
        source.connect(this.maitre);
      }
      const active: SourceActive = { source, gain };
      this.suivre(son, active);
      source.onended = () => this.actives.get(son)?.delete(active);
      source.start();
    } else if (!ctx && typeof AudioBuffer === 'undefined') {
      // Repli sans Web Audio
      const url = this.urls.get(son);
      if (!url) return;
      const el = new Audio(url);
      el.loop = Boolean(musique?.boucle);
      el.volume = musique?.volume ?? 1;
      el.muted = this.muet;
      const active: SourceActive = { source: el, gain: null };
      this.suivre(son, active);
      el.onended = () => this.actives.get(son)?.delete(active);
      void el.play().catch(() => this.actives.get(son)?.delete(active));
    } else {
      // données ou contexte pas encore prêts : lecture dès que possible
      this.enAttente.set(son, musique);
    }
  }

  private suivre(son: CheminSon, active: SourceActive): void {
    let ensemble = this.actives.get(son);
    if (!ensemble) this.actives.set(son, (ensemble = new Set()));
    ensemble.add(active);
  }

  private arreter(son: CheminSon, fondu: number): void {
    const ensemble = this.actives.get(son);
    if (!ensemble) return;
    for (const a of ensemble) {
      try {
        if (a.source instanceof HTMLAudioElement) a.source.pause();
        else if (fondu > 0 && a.gain && this.contexte) {
          const t = this.contexte.currentTime;
          a.gain.gain.cancelScheduledValues(t);
          a.gain.gain.setValueAtTime(a.gain.gain.value, t);
          a.gain.gain.linearRampToValueAtTime(0, t + fondu);
          a.source.stop(t + fondu + 0.02);
        } else a.source.stop();
      } catch {
        /* déjà terminé */
      }
    }
    ensemble.clear();
  }

  /** Coupe tous les sons en cours (nouvelle partie, sortie de page). */
  toutArreter(): void {
    this.enAttente.clear();
    for (const son of this.actives.keys()) this.arreter(son, 0);
  }

  /** Coupe ou rétablit le son (sans interrompre la lecture). */
  definirMuet(muet: boolean): void {
    this.muet = muet;
    if (this.maitre && this.contexte) this.maitre.gain.setTargetAtTime(muet ? 0 : 1, this.contexte.currentTime, 0.02);
    for (const ensemble of this.actives.values())
      for (const a of ensemble) if (a.source instanceof HTMLAudioElement) a.source.muted = muet;
  }

  get estMuet(): boolean {
    return this.muet;
  }

  /** Met le son en pause (onglet masqué, pause du jeu) / le reprend. */
  suspendre(): void {
    if (this.contexte?.state === 'running') void this.contexte.suspend();
  }
  reprendre(): void {
    if (this.contexte?.state === 'suspended') void this.contexte.resume();
  }

  get nbSourcesActives(): number {
    let n = 0;
    for (const e of this.actives.values()) n += e.size;
    return n;
  }

  /** Diagnostic (tests) : niveau crête actuel du signal envoyé aux haut-parleurs. */
  niveauSortie(): number {
    if (!this.contexte || !this.maitre) return 0;
    if (!this.analyseur) {
      this.analyseur = this.contexte.createAnalyser();
      this.analyseur.fftSize = 2048;
      this.maitre.connect(this.analyseur);
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
    this.maitre = null;
  }
}
