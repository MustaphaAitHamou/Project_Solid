import { basculerPleinEcran, elementPleinEcran } from '../../shared/plein-ecran.ts';
import { HAUTEUR_JEU, LARGEUR_JEU, RATTRAPAGE_MAX_MS } from './config.ts';
import { Partie, type CheminSon, type ListeDessin, type ResultatPartie, type Touche } from './engine/index.ts';
import { TEXTE_CREDIT } from './engine/Scene.ts';
import './jeu.css';
import { creerMonde, type EtatMonde, type SonsModernes } from './moderne/monde.ts';
import { PartieModerne } from './moderne/PartieModerne.ts';
import { LecteurAudio } from './platform/audio.ts';
import { chargerRessources, type RessourcesJeu } from './platform/chargement.ts';
import { CommandesTactiles, EntreesClavier, Manette, type CibleEntrees, type Commande } from './platform/entrees.ts';
import { ecrirePreferences, lirePreferences, type ModeJeu, type Preferences } from './platform/preferences.ts';
import { RenduCanvas } from './platform/rendu.ts';
import { RenduModerne } from './platform/renduModerne.ts';

export type PhaseJeu = 'chargement' | 'pret' | 'en-cours' | 'pause' | 'terminee' | 'erreur';
export type { ModeJeu };

export interface EtatInterface {
  phase: PhaseJeu;
  mode: ModeJeu;
  muet: boolean;
  resultat: ResultatPartie | null;
}

export interface OptionsJeu {
  /** Élément dans lequel le jeu est monté. */
  conteneur: HTMLElement;
  /** Expose window.__jeuMario (tests automatisés). */
  modeTest?: boolean;
  surChangement?: (etat: EtatInterface) => void;
}

const THEME: CheminSon = '/audio/themeSong.wav';
/** Délai avant l'écran de fin (laisse voir l'animation et entendre le son de fin). */
const DELAI_FIN_MS = { moderne: { gagnee: 3400, perdue: 2300 }, classique: { gagnee: 1500, perdue: 2500 } } as const;

const ICONE_PAUSE =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>';
const ICONE_SON =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
const ICONE_MUET =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 9l5 6M21 9l-5 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

const secondes = (s: number): string =>
  `${s.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} s`;

/**
 * Le jeu « Mario Ahmed Aberkan » monté dans une page Web, en deux modes :
 * - Moderne (par défaut) : même niveau, mêmes images, mêmes sons, mêmes règles, avec une
 *   physique fluide, une caméra, des effets et une interface modernes ;
 * - Classique : portage fidèle, tour par tour, du jeu Java d'origine.
 * Indépendant du site et de Three.js : il ne dépend que du DOM et de ses propres moteurs.
 */
export class JeuMarioAhmedAberkan implements CibleEntrees {
  readonly racine: HTMLElement;
  private readonly cadre: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly voile: HTMLElement;
  private readonly barre: HTMLElement;
  private readonly boutonSon: HTMLButtonElement;
  private readonly boutonRejouer: HTMLButtonElement;
  private readonly tactile: CommandesTactiles;
  private readonly clavier: EntreesClavier;
  private readonly manette: Manette;
  private readonly options: OptionsJeu;

  private ressources: RessourcesJeu | null = null;
  private audio: LecteurAudio | null = null;
  private renduClassique: RenduCanvas | null = null;
  private renduModerne: RenduModerne | null = null;
  private prefs: Preferences = lirePreferences();
  private mode: ModeJeu = this.prefs.mode;
  private partieClassique: Partie | null = null;
  private partieModerne: PartieModerne | null = null;
  private apercuClassique: ListeDessin | null = null;
  private apercuModerne: EtatMonde | null = null;
  private phase: PhaseJeu = 'chargement';
  private resultat: ResultatPartie | null = null;
  private idRaf = 0;
  private dernier = 0;
  private horlogeFigee = false;
  private finSignalee = false;
  private minuterieFin = 0;
  private toucherDetecte = false;
  private observateur: ResizeObserver | null = null;
  private readonly nettoyages: (() => void)[] = [];
  private readonly stats = { images: 0, tours: 0, debut: 0, imagesParSeconde: 0, toursParSeconde: 0 };

  constructor(options: OptionsJeu) {
    this.options = options;
    this.racine = document.createElement('div');
    this.racine.className = 'ks-mario';
    this.racine.tabIndex = 0;
    this.racine.setAttribute('role', 'application');
    this.racine.setAttribute(
      'aria-label',
      'Mario Ahmed Aberkan : flèches pour se déplacer, barre d’espace pour sauter, Échap pour la pause',
    );

    this.cadre = document.createElement('div');
    this.cadre.className = 'ks-mario__cadre';
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'ks-mario__ecran';
    this.canvas.width = LARGEUR_JEU;
    this.canvas.height = HAUTEUR_JEU;
    this.voile = document.createElement('div');
    this.voile.className = 'ks-mario__voile';
    this.voile.addEventListener('click', (e) => this.surActionVoile(e));

    this.barre = document.createElement('div');
    this.barre.className = 'ks-mario__barre';
    const boutonPause = this.boutonIcone('Pause (Échap)', ICONE_PAUSE, () => this.basculerPause());
    boutonPause.classList.add('ks-mario__barre-pause');
    this.boutonSon = this.boutonIcone('Couper le son (M)', ICONE_SON, () => this.basculerSon());
    this.barre.append(boutonPause, this.boutonSon);

    this.boutonRejouer = document.createElement('button');
    this.boutonRejouer.type = 'button';
    this.boutonRejouer.className = 'ks-mario__rejouer';
    this.boutonRejouer.textContent = 'Rejouer';
    this.boutonRejouer.hidden = true;
    this.boutonRejouer.addEventListener('click', () => this.demarrer());
    this.cadre.append(this.canvas, this.barre, this.voile, this.boutonRejouer);

    this.tactile = new CommandesTactiles(this);
    this.racine.append(this.cadre, this.tactile.element);
    options.conteneur.append(this.racine);

    this.clavier = new EntreesClavier(
      this,
      () => this.estActif(),
      () => this.mode,
    );
    this.clavier.attacher();
    this.manette = new Manette(this);
    this.nettoyages.push(
      () => this.clavier.detacher(),
      () => this.manette.detacher(),
    );
    this.installerTactile();
    this.installerVisibilite();
    this.canvas.addEventListener('pointerdown', () => this.racine.focus({ preventScroll: true }));
    this.majBoutonSon();
    this.afficherVoile('<p class="ks-mario__message">Chargement du jeu…</p>');
  }

  // ------------------------------------------------------------------ cycle de vie

  /** Charge les ressources originales puis affiche l'écran d'accueil du jeu. */
  async charger(): Promise<void> {
    this.definirPhase('chargement');
    try {
      this.ressources = await chargerRessources((n, total) => {
        this.afficherVoile(
          `<p class="ks-mario__message">Chargement des ressources originales…</p><progress max="${total}" value="${n}"></progress>`,
        );
      }, this.options.modeTest);
    } catch (erreur) {
      console.error(erreur);
      this.definirPhase('erreur');
      this.afficherVoile(
        `<p class="ks-mario__message"><strong>Impossible de charger le jeu.</strong><br>${(erreur as Error).message}</p>`,
      );
      return;
    }
    const audio = new LecteurAudio(this.ressources.sons, this.ressources.urlsSons);
    audio.definirMuet(this.prefs.muet);
    this.audio = audio;
    // musique et jingles de fin : arrivent en arrière-plan, joués dès qu'ils sont prêts
    for (const p of this.ressources.sonsDifferes) {
      p.then(({ son, octets }) => audio.ajouterSon(son, octets)).catch((e: unknown) => console.error(e));
    }
    this.renduClassique = new RenduCanvas(this.canvas, this.ressources.images);
    this.renduModerne = new RenduModerne(this.canvas, this.ressources.images);
    const apercu = new Partie();
    apercu.executerTour();
    this.apercuClassique = apercu.image;
    this.apercuModerne = creerMonde();
    this.observerTaille();
    this.definirPhase('pret');
    this.afficherAccueil();
    if (this.options.modeTest) this.exposerPourLesTests();
  }

  /** Lance (ou relance) une partie. À appeler depuis un geste de l'utilisateur (son autorisé). */
  demarrer(mode: ModeJeu = this.mode): void {
    if (!this.ressources || !this.audio) return;
    this.choisirModeInterne(mode);
    this.audio.deverrouiller();
    this.audio.toutArreter();
    this.audio.reprendre();
    this.tactile.reinitialiser();
    this.partieClassique = null;
    this.partieModerne = null;
    if (mode === 'classique') this.partieClassique = new Partie({ audio: this.audio });
    else this.partieModerne = new PartieModerne(this.sonsModernes(this.audio));
    this.finSignalee = false;
    this.resultat = null;
    window.clearTimeout(this.minuterieFin);
    this.boutonRejouer.hidden = true;
    this.voile.hidden = true;
    this.dernier = performance.now();
    this.stats.debut = this.dernier;
    this.stats.images = this.stats.tours = 0;
    this.definirPhase('en-cours');
    this.racine.focus({ preventScroll: true });
    if (!this.idRaf) this.idRaf = requestAnimationFrame(this.boucle);
  }

  /** Change de mode : relance une partie si l'on jouait, sinon met à jour l'écran d'accueil. */
  choisirMode(mode: ModeJeu): void {
    if (this.phase === 'chargement' || this.phase === 'erreur') {
      this.choisirModeInterne(mode);
      return;
    }
    if (this.phase === 'pret') {
      this.choisirModeInterne(mode);
      this.afficherAccueil();
      this.rendre();
      return;
    }
    this.demarrer(mode);
  }

  private choisirModeInterne(mode: ModeJeu): void {
    this.mode = mode;
    this.racine.dataset.mode = mode;
    if (this.prefs.mode !== mode) {
      this.prefs.mode = mode;
      ecrirePreferences(this.prefs);
    }
    this.notifier();
  }

  basculerPause(): void {
    if (this.phase === 'en-cours') {
      this.definirPhase('pause');
      this.toutRelacher();
      this.audio?.suspendre();
      this.afficherPause();
    } else if (this.phase === 'pause') {
      this.voile.hidden = true;
      this.audio?.reprendre();
      this.dernier = performance.now();
      this.definirPhase(this.finSignalee ? 'terminee' : 'en-cours');
      this.racine.focus({ preventScroll: true });
    }
  }

  basculerSon(): void {
    this.prefs.muet = !this.prefs.muet;
    ecrirePreferences(this.prefs);
    this.audio?.definirMuet(this.prefs.muet);
    this.majBoutonSon();
    if (this.phase === 'pause') this.afficherPause();
    this.notifier();
  }

  async basculerPleinEcran(): Promise<boolean> {
    const etat = await basculerPleinEcran(this.racine);
    this.racine.focus({ preventScroll: true });
    return etat;
  }

  estEnPleinEcran(): boolean {
    return elementPleinEcran() === this.racine;
  }

  get phaseCourante(): PhaseJeu {
    return this.phase;
  }

  get modeCourant(): ModeJeu {
    return this.mode;
  }

  detruire(): void {
    cancelAnimationFrame(this.idRaf);
    this.idRaf = 0;
    window.clearTimeout(this.minuterieFin);
    this.observateur?.disconnect();
    for (const n of this.nettoyages) n();
    this.audio?.fermer();
    this.racine.remove();
    delete (window as { __jeuMario?: unknown }).__jeuMario;
  }

  private sonsModernes(audio: LecteurAudio): SonsModernes {
    return {
      jouer: (son) => audio.playSound(son),
      musique: (lancer) =>
        lancer
          ? audio.jouerMusique(THEME, { boucle: true, volume: 0.5, fondu: 0.8 })
          : audio.arreterMusique(THEME, 0.35),
    };
  }

  // ------------------------------------------------------------------ boucle

  private readonly boucle = (maintenant: number): void => {
    this.idRaf = requestAnimationFrame(this.boucle);
    this.manette.lire(this.estActif());
    if ((this.phase === 'en-cours' || this.phase === 'terminee') && !this.horlogeFigee) this.avancerJusqua(maintenant);
    else this.dernier = maintenant;
    this.rendre();
    this.mesurer(maintenant);
    this.detecterFin();
  };

  /** Fait avancer la simulation jusqu'à l'instant `t` (horloge de performance.now()). */
  private avancerJusqua(t: number): void {
    const dt = t - this.dernier;
    if (dt <= 0) return;
    const ms = Math.min(dt, RATTRAPAGE_MAX_MS);
    if (this.partieClassique) this.partieClassique.avancer(ms);
    else this.partieModerne?.avancer(ms);
    this.dernier = t;
  }

  private rendre(): void {
    if (this.mode === 'moderne') {
      const monde = this.partieModerne?.monde ?? this.apercuModerne;
      if (monde) this.renduModerne?.dessiner(monde, this.partieModerne?.alpha ?? 1, !this.partieModerne);
    } else {
      const liste = this.partieClassique?.image ?? this.apercuClassique;
      if (liste) this.renduClassique?.dessiner(liste);
    }
  }

  private detecterFin(): void {
    if (this.finSignalee) return;
    let resultat: ResultatPartie | null = null;
    if (this.partieClassique) resultat = this.partieClassique.getPremierResultat();
    else if (this.partieModerne) {
      const p = this.partieModerne.monde.phase;
      resultat = p === 'victoire' ? 'gagnee' : p === 'defaite' ? 'perdue' : null;
    }
    if (!resultat) return;
    this.finSignalee = true;
    this.resultat = resultat;
    const record = this.partieModerne ? this.enregistrerRecord(this.partieModerne.monde) : false;
    if (this.phase === 'en-cours') this.definirPhase('terminee');
    else this.notifier();
    const delai = DELAI_FIN_MS[this.partieModerne ? 'moderne' : 'classique'][resultat];
    const partie = this.partieModerne ?? this.partieClassique;
    this.minuterieFin = window.setTimeout(() => {
      if ((this.partieModerne ?? this.partieClassique) !== partie || this.phase === 'pause') return;
      if (this.partieModerne) this.afficherFin(this.partieModerne.monde, record);
      else this.boutonRejouer.hidden = false;
    }, delai);
  }

  /** Enregistre le meilleur temps et le meilleur score ; renvoie vrai si un record tombe. */
  private enregistrerRecord(m: EtatMonde): boolean {
    let record = false;
    if (m.phase === 'victoire' && m.stats.tempsFinal !== null) {
      if (this.prefs.meilleurTemps === null || m.stats.tempsFinal < this.prefs.meilleurTemps) {
        this.prefs.meilleurTemps = m.stats.tempsFinal;
        record = true;
      }
    }
    if (m.stats.score > this.prefs.meilleurScore) {
      this.prefs.meilleurScore = m.stats.score;
      record = record || m.phase === 'victoire';
    }
    ecrirePreferences(this.prefs);
    return record;
  }

  private mesurer(maintenant: number): void {
    this.stats.images++;
    const ecoule = maintenant - this.stats.debut;
    if (ecoule >= 1000) {
      const tours = this.partieClassique?.getTours() ?? this.partieModerne?.nbPas ?? 0;
      this.stats.imagesParSeconde = Math.round((this.stats.images * 1000) / ecoule);
      this.stats.toursParSeconde = Math.round(((tours - this.stats.tours) * 1000) / ecoule);
      this.stats.images = 0;
      this.stats.tours = tours;
      this.stats.debut = maintenant;
    }
  }

  // ------------------------------------------------------------------ entrées (CibleEntrees)

  private estActif(): boolean {
    return this.phase === 'en-cours' || this.phase === 'terminee';
  }

  enfoncer(touche: Touche, horodatage: number): void {
    if (!this.estActif()) return;
    this.audio?.deverrouiller();
    // L'entrée est appliquée à l'instant exact où elle s'est produite, entre deux images
    if (!this.horlogeFigee) this.avancerJusqua(this.instant(horodatage));
    this.partieClassique?.toucheEnfoncee(touche);
    this.partieModerne?.toucheEnfoncee(touche);
  }

  relacher(touche: Touche, horodatage: number): void {
    if (!this.horlogeFigee && this.estActif()) this.avancerJusqua(this.instant(horodatage));
    this.partieClassique?.toucheRelachee(touche);
    this.partieModerne?.toucheRelachee(touche);
  }

  toutRelacher(): void {
    this.partieClassique?.relacherTout();
    this.partieModerne?.relacherTout();
    this.tactile.reinitialiser();
  }

  commande(c: Commande): void {
    if (c === 'PAUSE') this.basculerPause();
    else this.basculerSon();
  }

  /** Horodatage d'événement dans la base de temps de performance.now() (repli si incohérent). */
  private instant(horodatage: number): number {
    const maintenant = performance.now();
    return horodatage > 0 && Math.abs(horodatage - maintenant) < 1000 ? horodatage : maintenant;
  }

  // ------------------------------------------------------------------ interface

  private notifier(): void {
    this.options.surChangement?.({
      phase: this.phase,
      mode: this.mode,
      muet: this.prefs.muet,
      resultat: this.resultat,
    });
  }

  private definirPhase(phase: PhaseJeu): void {
    this.phase = phase;
    this.racine.dataset.phase = phase;
    this.racine.classList.toggle('ks-mario--actif', phase === 'en-cours' || phase === 'terminee');
    this.notifier();
  }

  private boutonIcone(titre: string, icone: string, action: () => void): HTMLButtonElement {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'ks-mario__icone';
    b.title = titre;
    b.setAttribute('aria-label', titre);
    b.innerHTML = icone;
    b.addEventListener('click', () => {
      action();
      if (this.phase === 'en-cours') this.racine.focus({ preventScroll: true });
    });
    return b;
  }

  private majBoutonSon(): void {
    const titre = this.prefs.muet ? 'Rétablir le son (M)' : 'Couper le son (M)';
    this.boutonSon.title = titre;
    this.boutonSon.setAttribute('aria-label', titre);
    this.boutonSon.setAttribute('aria-pressed', String(this.prefs.muet));
    this.boutonSon.innerHTML = this.prefs.muet ? ICONE_MUET : ICONE_SON;
  }

  private afficherVoile(html: string, classe = ''): HTMLElement {
    this.voile.className = `ks-mario__voile ${classe}`.trim();
    this.voile.innerHTML = html;
    this.voile.hidden = false;
    return this.voile;
  }

  private afficherAccueil(): void {
    const t = this.prefs.meilleurTemps;
    const record =
      t !== null || this.prefs.meilleurScore > 0
        ? `<p class="ks-mario__record">Record : ${t !== null ? secondes(t) : '—'} · ${this.prefs.meilleurScore.toLocaleString('fr-FR')} pts</p>`
        : '';
    const moderne = this.mode === 'moderne';
    this.afficherVoile(
      `<div class="ks-mario__carte">
        <p class="ks-mario__surtitre">Super Ahmed Averkan Bros</p>
        <h2 class="ks-mario__titre">Mario Ahmed Aberkan</h2>
        <div class="ks-mario__choix">
          <button type="button" class="ks-mario__bouton ks-mario__bouton--principal ks-mario__commencer" data-action="jouer">▶ ${moderne ? 'Jouer' : 'Jouer (classique)'}</button>
          <button type="button" class="ks-mario__bouton" data-action="${moderne ? 'classique' : 'moderne'}">${moderne ? 'Version classique (Java)' : 'Version moderne'}</button>
        </div>
        ${record}
        <p class="ks-mario__aide">${this.aideCommandes()}</p>
        <p class="ks-mario__credit">${TEXTE_CREDIT}</p>
      </div>`,
      'ks-mario__voile--accueil',
    );
  }

  private aideCommandes(): string {
    return this.mode === 'moderne'
      ? '<kbd>←</kbd> <kbd>→</kbd> (ou <kbd>Q</kbd> <kbd>D</kbd>) se déplacer · <kbd>Espace</kbd>, <kbd>↑</kbd> ou <kbd>Z</kbd> sauter — maintenir pour sauter plus haut · <kbd>Échap</kbd> pause · <kbd>M</kbd> son · manette acceptée'
      : '<kbd>←</kbd> <kbd>→</kbd> se déplacer · <kbd>Espace</kbd> sauter · <kbd>Échap</kbd> pause · <kbd>M</kbd> son — commandes du jeu Java';
  }

  private afficherPause(): void {
    this.afficherVoile(
      `<div class="ks-mario__carte ks-mario__carte--compacte">
        <h2 class="ks-mario__titre">Pause</h2>
        <div class="ks-mario__choix ks-mario__choix--colonne">
          <button type="button" class="ks-mario__bouton ks-mario__bouton--principal" data-action="reprendre">Reprendre</button>
          <button type="button" class="ks-mario__bouton" data-action="recommencer">Recommencer</button>
          <button type="button" class="ks-mario__bouton" data-action="son">Son : ${this.prefs.muet ? 'coupé' : 'activé'}</button>
          <button type="button" class="ks-mario__bouton" data-action="${this.mode === 'moderne' ? 'classique' : 'moderne'}">${this.mode === 'moderne' ? 'Passer en version classique' : 'Passer en version moderne'}</button>
        </div>
        <p class="ks-mario__aide">${this.aideCommandes()}</p>
      </div>`,
      'ks-mario__voile--pause',
    );
    this.voile.querySelector<HTMLButtonElement>('[data-action="reprendre"]')?.focus({ preventScroll: true });
  }

  private afficherFin(m: EtatMonde, record: boolean): void {
    const victoire = m.phase === 'victoire';
    const s = m.stats;
    const sousTitre = victoire ? 'Niveau terminé !' : m.cause === 'temps' ? 'Temps écoulé' : 'Perdu !';
    this.afficherVoile(
      `<div class="ks-mario__carte ks-mario__carte--fin">
        <p class="ks-mario__surtitre">${sousTitre}</p>
        <dl class="ks-mario__stats">
          <div><dt>Pièces</dt><dd>${s.pieces} / 10</dd></div>
          <div><dt>Temps</dt><dd>${victoire && s.tempsFinal !== null ? secondes(s.tempsFinal) : '—'}</dd></div>
          <div><dt>Écrasés</dt><dd>${s.ecrases}${s.meilleurCombo > 1 ? ` <small>combo ×${s.meilleurCombo}</small>` : ''}</dd></div>
          <div><dt>Score</dt><dd>${s.score.toLocaleString('fr-FR')}</dd></div>
        </dl>
        ${record ? '<p class="ks-mario__badge">Nouveau record !</p>' : ''}
        <div class="ks-mario__choix">
          <button type="button" class="ks-mario__bouton ks-mario__bouton--principal ks-mario__rejouer-moderne" data-action="recommencer">Rejouer</button>
          <button type="button" class="ks-mario__bouton" data-action="classique">Version classique</button>
        </div>
      </div>`,
      'ks-mario__voile--fin',
    );
    this.voile.querySelector<HTMLButtonElement>('[data-action="recommencer"]')?.focus({ preventScroll: true });
  }

  private surActionVoile(e: Event): void {
    const bouton = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-action]');
    if (!bouton) return;
    switch (bouton.dataset.action) {
      case 'jouer':
      case 'recommencer':
        this.demarrer();
        break;
      case 'reprendre':
        this.basculerPause();
        break;
      case 'son':
        this.basculerSon();
        break;
      case 'classique':
      case 'moderne':
        if (this.phase === 'pret') this.choisirMode(bouton.dataset.action);
        else this.demarrer(bouton.dataset.action);
        break;
    }
  }

  /** Ajuste la résolution du canvas à sa taille affichée (en pixels physiques). */
  private observerTaille(): void {
    const appliquer = (largeurPx: number, hauteurPx: number): void => {
      if (largeurPx < 1 || hauteurPx < 1) return;
      this.renduClassique?.dimensionner(largeurPx, hauteurPx);
      this.renduModerne?.dimensionner(largeurPx, hauteurPx);
      this.rendre();
    };
    this.observateur = new ResizeObserver((entrees) => {
      for (const e of entrees) {
        const dpr = window.devicePixelRatio || 1;
        appliquer(e.contentRect.width * dpr, e.contentRect.height * dpr);
      }
    });
    this.observateur.observe(this.canvas);
    // Changement de densité sans changement de taille (zoom, autre écran)
    const surRedimensionnement = (): void => {
      const dpr = window.devicePixelRatio || 1;
      appliquer(this.canvas.clientWidth * dpr, this.canvas.clientHeight * dpr);
    };
    window.addEventListener('resize', surRedimensionnement);
    this.nettoyages.push(() => window.removeEventListener('resize', surRedimensionnement));
  }

  /** Commandes tactiles : visibles seulement sur un appareil tactile. */
  private installerTactile(): void {
    const grossier = window.matchMedia('(pointer: coarse)');
    const maj = (): void => {
      this.racine.classList.toggle('ks-mario--tactile', grossier.matches || this.toucherDetecte);
    };
    const surPointeur = (e: PointerEvent): void => {
      if (e.pointerType === 'touch' && !this.toucherDetecte) {
        this.toucherDetecte = true;
        maj();
      }
    };
    grossier.addEventListener('change', maj);
    window.addEventListener('pointerdown', surPointeur, { passive: true, capture: true });
    this.nettoyages.push(() => {
      grossier.removeEventListener('change', maj);
      window.removeEventListener('pointerdown', surPointeur, { capture: true });
    });
    maj();
  }

  /** Onglet masqué : la partie se met en pause (pas de rattrapage au retour), le son aussi. */
  private installerVisibilite(): void {
    const surVisibilite = (): void => {
      if (document.hidden) {
        if (this.phase === 'en-cours') this.basculerPause();
        else this.audio?.suspendre();
      } else {
        this.dernier = performance.now();
        if (this.phase === 'en-cours' || this.phase === 'terminee') this.audio?.reprendre();
      }
    };
    document.addEventListener('visibilitychange', surVisibilite);
    this.nettoyages.push(() => document.removeEventListener('visibilitychange', surVisibilite));
  }

  // ------------------------------------------------------------------ tests automatisés

  private exposerPourLesTests(): void {
    const jeu = this;
    (window as { __jeuMario?: unknown }).__jeuMario = {
      phase: () => jeu.phase,
      mode: () => jeu.mode,
      choisirMode: (m: ModeJeu) => jeu.choisirMode(m),
      etat: () => jeu.etatClassique(),
      etatModerne: () => jeu.etatModerne(),
      sons: () => (jeu.audio?.journal ?? []).filter((s) => s.action === 'play').map((s) => s.son),
      journalAudio: () => (jeu.audio?.journal ?? []).map((s) => `${s.action} ${s.son}`),
      audio: () => ({
        etat: jeu.audio?.etat,
        sonsPrets: jeu.audio?.nbSonsPrets,
        sourcesActives: jeu.audio?.nbSourcesActives,
        muet: jeu.audio?.estMuet,
        musiquePrete: jeu.audio?.estPret(THEME),
      }),
      niveauAudio: () => jeu.audio?.niveauSortie() ?? 0,
      descriptionSon: (son: CheminSon, n: number) => jeu.audio?.description(son, n) ?? null,
      empreintes: () => Object.fromEntries(jeu.ressources?.empreintes ?? []),
      images: () =>
        [...(jeu.ressources?.images.values() ?? [])].map((i) => ({
          nom: i.nom,
          largeur: i.largeur,
          hauteur: i.hauteur,
        })),
      stats: () => ({ imagesParSeconde: jeu.stats.imagesParSeconde, toursParSeconde: jeu.stats.toursParSeconde }),
      facteurAffichage: () => jeu.renduClassique?.facteurAffichage,
      facteurInterne: () =>
        jeu.mode === 'moderne' ? jeu.renduModerne?.facteurInterne : jeu.renduClassique?.facteurInterne,
      imageLogique: () => jeu.renduClassique?.imageLogique.toDataURL('image/png'),
      figerHorloge: () => {
        jeu.horlogeFigee = true;
      },
      reprendreHorloge: () => {
        jeu.horlogeFigee = false;
        jeu.dernier = performance.now();
      },
      /** Mode classique : n tours ; `entrees` : [tour relatif (1..n), 'appui' | 'relache', touche]. */
      executerTours: (n: number, entrees: [number, 'appui' | 'relache', Touche][] = []) => {
        const p = jeu.partieClassique;
        if (!p) return;
        for (let i = 1; i <= n; i++) {
          p.executerTour(() => {
            for (const [tour, action, touche] of entrees) {
              if (tour !== i) continue;
              if (action === 'appui') p.clavier.keyPressed(touche);
              else p.clavier.keyReleased(touche);
            }
          });
        }
      },
      /** Mode moderne : rejoue des segments { pas, gauche, droite, saut } (outils/moderne). */
      executerSegments: (segments: { pas: number; gauche: boolean; droite: boolean; saut: boolean }[]) => {
        const p = jeu.partieModerne;
        if (!p) return;
        for (const s of segments) {
          (s.droite ? p.toucheEnfoncee : p.toucheRelachee).call(p, 'DROITE');
          (s.gauche ? p.toucheEnfoncee : p.toucheRelachee).call(p, 'GAUCHE');
          (s.saut ? p.toucheEnfoncee : p.toucheRelachee).call(p, 'ESPACE');
          for (let i = 0; i < s.pas; i++) p.executerPas();
        }
        p.relacherTout();
      },
      basculerPause: () => jeu.basculerPause(),
    };
  }

  private etatClassique(): unknown {
    const p = this.partieClassique;
    if (!p) return null;
    const s = p.scene;
    const m = s.mario;
    return {
      tours: p.getTours(),
      tempsMs: p.getTempsMs(),
      xPos: s.getxPos(),
      dx: s.getDx(),
      xFond1: s.getxFond1(),
      xFond2: s.getxFond2(),
      mario: {
        x: m.getX(),
        y: m.getY(),
        saut: m.isSaut(),
        vivant: m.isVivant(),
        versDroite: m.isVersDroite(),
        marche: m.isMarche(),
      },
      score: s.getScore().getNbPieces(),
      piecesRestantes: s.getPieces().length,
      compteurTemps: s.getCompteARebours().getCompteurTemps(),
      resultat: s.getResultat(),
      premierResultat: p.getPremierResultat(),
      champs: s.getChamps().map((c) => ({ x: c.getX(), y: c.getY(), vivant: c.isVivant() })),
      tortues: s.getTortues().map((c) => ({ x: c.getX(), y: c.getY(), vivant: c.isVivant() })),
      touches: p.getTouchesMaintenues(),
      dessins: [...p.image].filter((op) => op.type === 'image').map((op) => `${op.image}@${op.x},${op.y}`),
      textes: [...p.image].filter((op) => op.type === 'texte').map((op) => op.texte),
    };
  }

  private etatModerne(): unknown {
    const p = this.partieModerne;
    if (!p) return null;
    const m = p.monde;
    return {
      pas: p.nbPas,
      t: m.t,
      phase: m.phase,
      cause: m.cause,
      chrono: m.chrono,
      joueur: {
        x: m.joueur.x,
        y: m.joueur.y,
        vx: m.joueur.vx,
        vy: m.joueur.vy,
        auSol: m.joueur.auSol,
        etat: m.joueur.etat,
        direction: m.joueur.direction,
      },
      camera: { x: m.camera.x },
      stats: { ...m.stats },
      ennemis: m.ennemis.map((e) => ({ type: e.type, x: e.x, vivant: e.vivant })),
      piecesRestantes: m.pieces.filter((x) => !x.prise).length,
      particules: m.particules.length,
      touches: p.getTouchesMaintenues(),
    };
  }
}
