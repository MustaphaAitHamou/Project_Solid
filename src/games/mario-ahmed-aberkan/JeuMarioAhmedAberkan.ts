import { basculerPleinEcran, elementPleinEcran } from '../../shared/plein-ecran.ts';
import { HAUTEUR_JEU, LARGEUR_JEU, RATTRAPAGE_MAX_MS } from './config.ts';
import { Partie, type CheminSon, type ListeDessin, type ResultatPartie, type Touche } from './engine/index.ts';
import './jeu.css';
import { LecteurAudio } from './platform/audio.ts';
import { chargerRessources, type RessourcesJeu } from './platform/chargement.ts';
import { CommandesTactiles, EntreesClavier, type CibleEntrees } from './platform/entrees.ts';
import { RenduCanvas } from './platform/rendu.ts';

export type PhaseJeu = 'chargement' | 'pret' | 'en-cours' | 'terminee' | 'erreur';

export interface OptionsJeu {
  /** Élément dans lequel le jeu est monté. */
  conteneur: HTMLElement;
  /** Expose window.__jeuMario (tests automatisés). */
  modeTest?: boolean;
  surChangementPhase?: (phase: PhaseJeu, resultat: ResultatPartie | null) => void;
}

/** Délai avant de proposer « Rejouer » (laisse voir l'animation et entendre le son de fin). */
const DELAI_REJOUER_MS = { gagnee: 1500, perdue: 2500 } as const;

/**
 * Le jeu « Mario Ahmed Aberkan » monté dans une page Web.
 * Indépendant du site et de Three.js : il ne dépend que du DOM et de son propre moteur.
 */
export class JeuMarioAhmedAberkan implements CibleEntrees {
  readonly racine: HTMLElement;
  private readonly cadre: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly voile: HTMLElement;
  private readonly boutonRejouer: HTMLButtonElement;
  private readonly tactile: CommandesTactiles;
  private readonly clavier: EntreesClavier;
  private readonly options: OptionsJeu;

  private ressources: RessourcesJeu | null = null;
  private audio: LecteurAudio | null = null;
  private rendu: RenduCanvas | null = null;
  private partie: Partie | null = null;
  private apercu: ListeDessin | null = null;
  private phase: PhaseJeu = 'chargement';
  private idRaf = 0;
  private dernier = 0;
  private horlogeFigee = false;
  private finSignalee = false;
  private minuterieRejouer = 0;
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
      'Mario Ahmed Aberkan : flèches gauche et droite pour se déplacer, barre d’espace pour sauter',
    );

    this.cadre = document.createElement('div');
    this.cadre.className = 'ks-mario__cadre';
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'ks-mario__ecran';
    this.canvas.width = LARGEUR_JEU;
    this.canvas.height = HAUTEUR_JEU;
    this.voile = document.createElement('div');
    this.voile.className = 'ks-mario__voile';
    this.boutonRejouer = document.createElement('button');
    this.boutonRejouer.type = 'button';
    this.boutonRejouer.className = 'ks-mario__rejouer';
    this.boutonRejouer.textContent = 'Rejouer';
    this.boutonRejouer.hidden = true;
    this.boutonRejouer.addEventListener('click', () => this.demarrer());
    this.cadre.append(this.canvas, this.voile, this.boutonRejouer);

    this.tactile = new CommandesTactiles(this);
    this.racine.append(this.cadre, this.tactile.element);
    options.conteneur.append(this.racine);

    this.clavier = new EntreesClavier(this, () => this.phase === 'en-cours' || this.phase === 'terminee');
    this.clavier.attacher();
    this.nettoyages.push(() => this.clavier.detacher());
    this.installerTactile();
    this.installerVisibilite();
    this.canvas.addEventListener('pointerdown', () => this.racine.focus({ preventScroll: true }));
    this.afficherVoile('<p class="ks-mario__message">Chargement du jeu…</p>');
  }

  // ------------------------------------------------------------------ cycle de vie

  /** Charge les ressources originales puis affiche la première image du jeu. */
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
    this.audio = new LecteurAudio(this.ressources.sons, this.ressources.urlsSons);
    this.rendu = new RenduCanvas(this.canvas, this.ressources.images);
    this.observerTaille();
    // Aperçu : premier tour d'une partie, identique à la première image du jeu Java
    const apercu = new Partie();
    apercu.executerTour();
    this.apercu = apercu.image;
    this.rendu.dessiner(this.apercu);
    this.definirPhase('pret');
    const voile = this.afficherVoile(`
      <button type="button" class="ks-mario__commencer">▶ Commencer</button>
      <p class="ks-mario__aide"><kbd>←</kbd> <kbd>→</kbd> se déplacer · <kbd>Espace</kbd> sauter</p>`);
    voile.querySelector('button')?.addEventListener('click', () => this.demarrer());
    if (this.options.modeTest) this.exposerPourLesTests();
  }

  /** Lance (ou relance) une partie. À appeler depuis un geste de l'utilisateur (son autorisé). */
  demarrer(): void {
    if (!this.ressources || !this.audio || !this.rendu) return;
    this.audio.deverrouiller();
    this.audio.toutArreter();
    this.tactile.reinitialiser();
    this.partie = new Partie({ audio: this.audio });
    this.finSignalee = false;
    window.clearTimeout(this.minuterieRejouer);
    this.boutonRejouer.hidden = true;
    this.voile.hidden = true;
    this.dernier = performance.now();
    this.stats.debut = this.dernier;
    this.stats.images = this.stats.tours = 0;
    this.definirPhase('en-cours');
    this.racine.focus({ preventScroll: true });
    if (!this.idRaf) this.idRaf = requestAnimationFrame(this.boucle);
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

  detruire(): void {
    cancelAnimationFrame(this.idRaf);
    this.idRaf = 0;
    window.clearTimeout(this.minuterieRejouer);
    this.observateur?.disconnect();
    for (const n of this.nettoyages) n();
    this.audio?.fermer();
    this.racine.remove();
    delete (window as { __jeuMario?: unknown }).__jeuMario;
  }

  // ------------------------------------------------------------------ boucle

  private readonly boucle = (maintenant: number): void => {
    this.idRaf = requestAnimationFrame(this.boucle);
    const partie = this.partie;
    if (!partie || !this.rendu) return;
    if (!this.horlogeFigee) this.avancerJusqua(maintenant);
    this.rendu.dessiner(partie.image);
    this.mesurer(maintenant, partie);

    const resultat = partie.getPremierResultat();
    if (resultat && !this.finSignalee) {
      this.finSignalee = true;
      this.definirPhase('terminee', resultat);
      this.minuterieRejouer = window.setTimeout(() => {
        if (this.partie === partie) this.boutonRejouer.hidden = false;
      }, DELAI_REJOUER_MS[resultat]);
    }
  };

  /** Fait avancer la simulation jusqu'à l'instant `t` (horloge de performance.now()). */
  private avancerJusqua(t: number): void {
    if (!this.partie) return;
    const dt = t - this.dernier;
    if (dt <= 0) return;
    this.partie.avancer(Math.min(dt, RATTRAPAGE_MAX_MS));
    this.dernier = t;
  }

  private mesurer(maintenant: number, partie: Partie): void {
    this.stats.images++;
    const ecoule = maintenant - this.stats.debut;
    if (ecoule >= 1000) {
      this.stats.imagesParSeconde = Math.round((this.stats.images * 1000) / ecoule);
      this.stats.toursParSeconde = Math.round(((partie.getTours() - this.stats.tours) * 1000) / ecoule);
      this.stats.images = 0;
      this.stats.tours = partie.getTours();
      this.stats.debut = maintenant;
    }
  }

  // ------------------------------------------------------------------ entrées (CibleEntrees)

  enfoncer(touche: Touche, horodatage: number): void {
    if (!this.partie || (this.phase !== 'en-cours' && this.phase !== 'terminee')) return;
    this.audio?.deverrouiller();
    // L'entrée est appliquée à l'instant exact où elle s'est produite, entre deux images
    if (!this.horlogeFigee) this.avancerJusqua(this.instant(horodatage));
    this.partie.toucheEnfoncee(touche);
  }

  relacher(touche: Touche, horodatage: number): void {
    if (!this.partie) return;
    if (!this.horlogeFigee) this.avancerJusqua(this.instant(horodatage));
    this.partie.toucheRelachee(touche);
  }

  toutRelacher(): void {
    this.partie?.relacherTout();
    this.tactile.reinitialiser();
  }

  /** Horodatage d'événement dans la base de temps de performance.now() (repli si incohérent). */
  private instant(horodatage: number): number {
    const maintenant = performance.now();
    return horodatage > 0 && Math.abs(horodatage - maintenant) < 1000 ? horodatage : maintenant;
  }

  // ------------------------------------------------------------------ affichage

  private definirPhase(phase: PhaseJeu, resultat: ResultatPartie | null = null): void {
    this.phase = phase;
    this.racine.dataset.phase = phase;
    this.racine.classList.toggle('ks-mario--actif', phase === 'en-cours' || phase === 'terminee');
    this.options.surChangementPhase?.(phase, resultat);
  }

  private afficherVoile(html: string): HTMLElement {
    this.voile.innerHTML = html;
    this.voile.hidden = false;
    return this.voile;
  }

  /** Ajuste la résolution du canvas à sa taille affichée (en pixels physiques). */
  private observerTaille(): void {
    const appliquer = (largeurPx: number, hauteurPx: number): void => {
      if (!this.rendu || largeurPx < 1 || hauteurPx < 1) return;
      this.rendu.dimensionner(largeurPx, hauteurPx);
      // hors partie, redessine l'image affichée (sinon la boucle s'en charge)
      if (!this.partie && this.apercu) this.rendu.dessiner(this.apercu);
      else if (this.partie) this.rendu.dessiner(this.partie.image);
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

  /** Onglet masqué : le jeu se met en pause (pas de rattrapage au retour), le son aussi. */
  private installerVisibilite(): void {
    const surVisibilite = (): void => {
      if (document.hidden) {
        this.audio?.suspendre();
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
      etat: () => jeu.etatPourLesTests(),
      sons: () => (jeu.audio?.journal ?? []).map((s) => s.son),
      audio: () => ({
        etat: jeu.audio?.etat,
        sonsPrets: jeu.audio?.nbSonsPrets,
        sourcesActives: jeu.audio?.nbSourcesActives,
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
      facteurAffichage: () => jeu.rendu?.facteurAffichage,
      facteurInterne: () => jeu.rendu?.facteurInterne,
      imageLogique: () => jeu.rendu?.imageLogique.toDataURL('image/png'),
      figerHorloge: () => {
        jeu.horlogeFigee = true;
      },
      reprendreHorloge: () => {
        jeu.horlogeFigee = false;
        jeu.dernier = performance.now();
      },
      /** Exécute n tours ; `entrees` : [tour relatif (1..n), 'appui' | 'relache', touche] (KeyListener brut). */
      executerTours: (n: number, entrees: [number, 'appui' | 'relache', Touche][] = []) => {
        const p = jeu.partie;
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
    };
  }

  private etatPourLesTests(): unknown {
    const p = this.partie;
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
}
