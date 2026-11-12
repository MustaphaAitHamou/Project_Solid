import type { Touche } from '../engine/index.ts';

/** Destinataire des entrées (implémenté par le jeu). L'horodatage suit performance.now(). */
export interface CibleEntrees {
  enfoncer(touche: Touche, horodatage: number): void;
  relacher(touche: Touche, horodatage: number): void;
  toutRelacher(): void;
}

/** Commandes d'origine : flèche droite, flèche gauche, barre d'espace. */
function toucheDe(e: KeyboardEvent): Touche | null {
  switch (e.code) {
    case 'ArrowRight':
      return 'DROITE';
    case 'ArrowLeft':
      return 'GAUCHE';
    case 'Space':
      return 'ESPACE';
  }
  // Navigateurs anciens ou claviers virtuels sans `code`
  switch (e.key) {
    case 'ArrowRight':
    case 'Right':
      return 'DROITE';
    case 'ArrowLeft':
    case 'Left':
      return 'GAUCHE';
    case ' ':
    case 'Spacebar':
      return 'ESPACE';
  }
  return null;
}

function estEditable(cible: EventTarget | null): boolean {
  if (!(cible instanceof HTMLElement)) return false;
  return cible.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(cible.tagName);
}

/**
 * Clavier : écoute au niveau de la fenêtre (le jeu reste jouable même si le focus passe sur un
 * bouton de la page), empêche le défilement de la page et l'activation des boutons par les
 * touches du jeu, ignore la répétition automatique et relâche tout à la perte de focus.
 */
export class EntreesClavier {
  private readonly cible: CibleEntrees;
  private readonly estActif: () => boolean;
  private readonly enfoncees = new Set<Touche>();

  constructor(cible: CibleEntrees, estActif: () => boolean) {
    this.cible = cible;
    this.estActif = estActif;
  }

  attacher(): void {
    window.addEventListener('keydown', this.surAppui, { capture: true });
    window.addEventListener('keyup', this.surRelachement, { capture: true });
    window.addEventListener('blur', this.surPerteFocus);
    document.addEventListener('visibilitychange', this.surVisibilite);
  }

  detacher(): void {
    window.removeEventListener('keydown', this.surAppui, { capture: true });
    window.removeEventListener('keyup', this.surRelachement, { capture: true });
    window.removeEventListener('blur', this.surPerteFocus);
    document.removeEventListener('visibilitychange', this.surVisibilite);
    this.enfoncees.clear();
  }

  private readonly surAppui = (e: KeyboardEvent): void => {
    const touche = toucheDe(e);
    if (e.ctrlKey || e.metaKey || e.altKey || estEditable(e.target) || !this.estActif()) return;
    if (!touche) {
      // ↑ et ↓ ne servent pas au jeu mais ne doivent pas faire défiler la page pendant une partie
      if (e.code === 'ArrowUp' || e.code === 'ArrowDown') e.preventDefault();
      return;
    }
    e.preventDefault(); // pas de défilement, pas d'activation du bouton qui a le focus
    e.stopPropagation();
    if (e.repeat || this.enfoncees.has(touche)) return;
    this.enfoncees.add(touche);
    this.cible.enfoncer(touche, e.timeStamp);
  };

  private readonly surRelachement = (e: KeyboardEvent): void => {
    const touche = toucheDe(e);
    if (!touche) return;
    if (this.estActif()) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!this.enfoncees.delete(touche)) return;
    this.cible.relacher(touche, e.timeStamp);
  };

  private readonly surPerteFocus = (): void => {
    this.enfoncees.clear();
    this.cible.toutRelacher();
  };

  private readonly surVisibilite = (): void => {
    if (document.hidden) this.surPerteFocus();
  };
}

/**
 * Commandes tactiles virtuelles : ◀, ▶ et Saut. Chaque bouton suit ses propres pointeurs
 * (multi-touch : avancer et sauter en même temps). Affichées seulement sur écran tactile.
 */
export class CommandesTactiles {
  readonly element: HTMLElement;
  private readonly cible: CibleEntrees;
  private readonly pointeurs = new Map<Touche, Set<number>>();

  constructor(cible: CibleEntrees) {
    this.cible = cible;
    this.element = document.createElement('div');
    this.element.className = 'ks-mario__tactile';
    this.element.setAttribute('aria-hidden', 'true'); // doublon des touches du clavier
    const groupeGauche = document.createElement('div');
    groupeGauche.className = 'ks-mario__tactile-groupe';
    groupeGauche.append(this.bouton('GAUCHE', '◀', 'Gauche'), this.bouton('DROITE', '▶', 'Droite'));
    const groupeDroite = document.createElement('div');
    groupeDroite.className = 'ks-mario__tactile-groupe';
    groupeDroite.append(this.bouton('ESPACE', 'Saut', 'Sauter'));
    this.element.append(groupeGauche, groupeDroite);
    this.element.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private bouton(touche: Touche, texte: string, titre: string): HTMLButtonElement {
    const b = document.createElement('button');
    b.type = 'button';
    b.tabIndex = -1;
    b.className = `ks-mario__tactile-bouton ks-mario__tactile-bouton--${touche.toLowerCase()}`;
    b.textContent = texte;
    b.title = titre;
    this.pointeurs.set(touche, new Set());
    const actifs = this.pointeurs.get(touche)!;
    const fin = (e: PointerEvent): void => {
      if (!actifs.delete(e.pointerId)) return;
      if (actifs.size === 0) {
        b.classList.remove('est-enfonce');
        this.cible.relacher(touche, e.timeStamp);
      }
    };
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      try {
        b.setPointerCapture(e.pointerId);
      } catch {
        /* pointeur déjà libéré */
      }
      const premier = actifs.size === 0;
      actifs.add(e.pointerId);
      if (premier) {
        b.classList.add('est-enfonce');
        this.cible.enfoncer(touche, e.timeStamp);
      }
    });
    b.addEventListener('pointerup', fin);
    b.addEventListener('pointercancel', fin);
    b.addEventListener('lostpointercapture', fin);
    return b;
  }

  /** Relâche tous les boutons (perte de focus, nouvelle partie). */
  reinitialiser(): void {
    for (const actifs of this.pointeurs.values()) actifs.clear();
    for (const b of this.element.querySelectorAll('.est-enfonce')) b.classList.remove('est-enfonce');
  }
}
