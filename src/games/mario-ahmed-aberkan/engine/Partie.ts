import { CADENCES_MESUREES, CORRECTIONS_PAR_DEFAUT, type CadencesHorloge, type Corrections } from '../config.ts';
import { Clavier } from './Clavier.ts';
import { ListeDessin } from './ListeDessin.ts';
import { Scene } from './Scene.ts';
import type { Direction, ResultatPartie, SortieAudio, Touche } from './types.ts';

export interface OptionsPartie {
  audio?: SortieAudio;
  corrections?: Partial<Corrections>;
  cadences?: Partial<CadencesHorloge>;
}

const AUDIO_MUET: SortieAudio = { playSound() {}, stopSound() {} };

type Primitives = Record<string, string | number | boolean | null | undefined>;

/** Copie les champs primitifs d'un objet (les références vers d'autres objets sont ignorées). */
function capturer(objet: object): Primitives {
  const copie: Primitives = {};
  for (const [cle, valeur] of Object.entries(objet)) {
    if (valeur === null || (typeof valeur !== 'object' && typeof valeur !== 'function')) {
      copie[cle] = valeur as Primitives[string];
    }
  }
  return copie;
}

export interface SauvegardePartie {
  horloge: Primitives;
  directionsMaintenues: Direction[];
  scene: Primitives;
  mario: Primitives;
  objets: Primitives[];
  pieces: Primitives[];
  piecesRestantes: number[];
  champs: Primitives[];
  tortues: Primitives[];
  score: Primitives;
  compteARebours: Primitives;
}

/**
 * Une partie : la Scene Java + l'horloge qui remplace ses threads.
 *
 * Le jeu Java repose sur 4 sortes de threads concurrents (Chrono, Champ, Tortue, CompteARebours).
 * Ici, une horloge déterministe en microsecondes exécute les mêmes actions aux mêmes cadences
 * (mesurées sur le jeu original), indépendamment de la fréquence de l'écran :
 *   - toutes les 3,16 ms   : un tour de Scene.paintComponent() (logique + liste d'affichage) ;
 *   - à 20,12 ms puis toutes les 15,12 ms : bouge() de chaque ennemi vivant ;
 *   - toutes les 1000,15 ms : un tour de CompteARebours.
 * À instant égal : compte à rebours, puis ennemis, puis entrées clavier, puis paintComponent.
 */
export class Partie {
  readonly scene: Scene;
  readonly clavier: Clavier;
  readonly corrections: Corrections;
  readonly cadences: CadencesHorloge;
  /** Liste d'affichage du dernier tour de paintComponent(). */
  readonly image = new ListeDessin();

  private tempsUs = 0;
  private prochainRafraichissementUs: number;
  private prochainEnnemisUs: number;
  private prochainCompteAReboursUs: number;
  private tours = 0;
  private premierResultat: ResultatPartie | null = null;
  private tourPremierResultat = 0;
  private directionsMaintenues: Direction[] = [];
  private espaceMaintenu = false;

  constructor(options: OptionsPartie = {}) {
    this.corrections = { ...CORRECTIONS_PAR_DEFAUT, ...options.corrections };
    this.cadences = { ...CADENCES_MESUREES, ...options.cadences };
    this.scene = new Scene(options.audio ?? AUDIO_MUET, this.corrections);
    this.clavier = new Clavier(this.scene, this.corrections);
    this.prochainRafraichissementUs = this.cadences.periodeRafraichissementUs;
    this.prochainEnnemisUs = this.cadences.delaiInitialEnnemisUs;
    this.prochainCompteAReboursUs = this.cadences.periodeCompteAReboursUs;
  }

  /** Nombre de tours de paintComponent() exécutés. */
  getTours(): number {
    return this.tours;
  }
  /** Temps simulé écoulé depuis le début de la partie. */
  getTempsMs(): number {
    return this.tempsUs / 1000;
  }
  /** Premier résultat affiché (gagné/perdu), conservé même si l'affichage Java change ensuite. */
  getPremierResultat(): ResultatPartie | null {
    return this.premierResultat;
  }
  getTourPremierResultat(): number {
    return this.tourPremierResultat;
  }

  /** Avance la simulation de `dureeMs` millisecondes. Renvoie le nombre de tours exécutés. */
  avancer(dureeMs: number): number {
    const cible = this.tempsUs + Math.max(0, dureeMs) * 1000;
    let tours = 0;
    while (this.prochainEvenementUs() <= cible) {
      if (this.traiterProchainEvenement()) tours++;
    }
    this.tempsUs = cible;
    return tours;
  }

  /**
   * Exécute les événements jusqu'au prochain tour de paintComponent() inclus.
   * `avantDessin` est appelé juste avant ce tour (injection d'entrées clavier brutes dans les tests).
   */
  executerTour(avantDessin?: () => void): void {
    while (!this.traiterProchainEvenement(avantDessin)) {
      /* événements intermédiaires : compte à rebours, ennemis */
    }
  }

  // ---------- Entrées (couche navigateur) ----------

  /** Appui physique sur une touche (les répétitions automatiques du navigateur sont à ignorer). */
  toucheEnfoncee(touche: Touche): void {
    if (touche === 'ESPACE') {
      if (this.espaceMaintenu) return;
      this.espaceMaintenu = true;
    } else {
      if (this.directionsMaintenues.includes(touche)) return;
      this.directionsMaintenues.push(touche);
    }
    this.clavier.keyPressed(touche);
  }

  /** Relâchement physique d'une touche. */
  toucheRelachee(touche: Touche): void {
    if (touche === 'ESPACE') {
      if (!this.espaceMaintenu) return;
      this.espaceMaintenu = false;
    } else {
      const i = this.directionsMaintenues.indexOf(touche);
      if (i < 0) return;
      this.directionsMaintenues.splice(i, 1);
    }
    this.clavier.keyReleased(touche);
  }

  /** Relâche toutes les touches (perte de focus de la fenêtre, fin de partie…). */
  relacherTout(): void {
    for (const d of [...this.directionsMaintenues]) this.toucheRelachee(d);
    if (this.espaceMaintenu) this.toucheRelachee('ESPACE');
  }

  getTouchesMaintenues(): Touche[] {
    return this.espaceMaintenu ? [...this.directionsMaintenues, 'ESPACE'] : [...this.directionsMaintenues];
  }

  // ---------- Horloge ----------

  private prochainEvenementUs(): number {
    return Math.min(this.prochainRafraichissementUs, this.prochainEnnemisUs, this.prochainCompteAReboursUs);
  }

  /** Traite l'événement le plus proche. Renvoie vrai si c'était un tour de paintComponent(). */
  private traiterProchainEvenement(avantDessin?: () => void): boolean {
    const t = this.prochainEvenementUs();
    if (t > this.tempsUs) this.tempsUs = t;

    if (this.prochainCompteAReboursUs === t) {
      // Thread CompteARebours
      const fige = this.corrections.compteAReboursFigeEnFinDePartie && this.premierResultat !== null;
      if (!fige) this.scene.getCompteARebours().tourDeBoucle();
      this.prochainCompteAReboursUs += this.cadences.periodeCompteAReboursUs;
      return false;
    }

    if (this.prochainEnnemisUs === t) {
      // Threads Champ et Tortue : `if (vivant) { bouge(); sleep(15); }`
      for (const champ of this.scene.getChamps()) if (champ.isVivant()) champ.bouge();
      for (const tortue of this.scene.getTortues()) if (tortue.isVivant()) tortue.bouge();
      this.prochainEnnemisUs += this.cadences.periodeEnnemisUs;
      return false;
    }

    // Thread Chrono : repaint() -> paintComponent()
    this.tours++;
    if (this.corrections.maintienDesTouches && this.directionsMaintenues.length > 0) {
      this.clavier.keyPressed(this.directionsMaintenues[this.directionsMaintenues.length - 1]);
    }
    avantDessin?.();
    this.image.vider();
    this.scene.paintComponent(this.image);
    this.prochainRafraichissementUs += this.cadences.periodeRafraichissementUs;

    const resultat = this.scene.getResultat();
    if (resultat !== null && this.premierResultat === null) {
      this.premierResultat = resultat;
      this.tourPremierResultat = this.tours;
    }
    return true;
  }

  // ---------- Sauvegarde / restauration (outils de test et de recherche de parcours) ----------

  sauvegarder(): SauvegardePartie {
    const s = this.scene;
    return {
      horloge: capturer(this),
      directionsMaintenues: [...this.directionsMaintenues],
      scene: capturer(s),
      mario: capturer(s.mario),
      objets: s.getObjets().map(capturer),
      pieces: s.toutesLesPieces.map(capturer),
      piecesRestantes: s.getPieces().map((p) => s.toutesLesPieces.indexOf(p)),
      champs: s.getChamps().map(capturer),
      tortues: s.getTortues().map(capturer),
      score: capturer(s.getScore()),
      compteARebours: capturer(s.getCompteARebours()),
    };
  }

  restaurer(e: SauvegardePartie): void {
    const s = this.scene;
    Object.assign(this, e.horloge);
    this.directionsMaintenues = [...e.directionsMaintenues];
    Object.assign(s, e.scene);
    Object.assign(s.mario, e.mario);
    s.getObjets().forEach((o, i) => Object.assign(o, e.objets[i]));
    s.toutesLesPieces.forEach((p, i) => Object.assign(p, e.pieces[i]));
    s.setPieces(e.piecesRestantes.map((i) => s.toutesLesPieces[i]));
    s.getChamps().forEach((c, i) => Object.assign(c, e.champs[i]));
    s.getTortues().forEach((t, i) => Object.assign(t, e.tortues[i]));
    Object.assign(s.getScore(), e.score);
    Object.assign(s.getCompteARebours(), e.compteARebours);
  }
}
