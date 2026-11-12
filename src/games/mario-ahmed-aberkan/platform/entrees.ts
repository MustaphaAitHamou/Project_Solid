import type { Touche } from '../engine/index.ts';

/** Commandes hors du jeu lui-même : pause et coupure du son. */
export type Commande = 'PAUSE' | 'SON';

/** Destinataire des entrées (implémenté par le jeu). L'horodatage suit performance.now(). */
export interface CibleEntrees {
  enfoncer(touche: Touche, horodatage: number): void;
  relacher(touche: Touche, horodatage: number): void;
  toutRelacher(): void;
  commande(c: Commande): void;
}

/**
 * Profil « classique » : uniquement les touches de Clavier.java (flèches, Espace).
 * Profil « moderne » : en plus Q/D et Z (AZERTY ; A/D et W en QWERTY), ↑ pour sauter.
 * Les deux : Échap ou P pour la pause, M pour couper le son.
 */
export type ProfilClavier = 'classique' | 'moderne';

function commandeDe(e: KeyboardEvent, profil: ProfilClavier): Touche | Commande | null {
  switch (e.code) {
    case 'ArrowRight':
      return 'DROITE';
    case 'ArrowLeft':
      return 'GAUCHE';
    case 'Space':
      return 'ESPACE';
    case 'Escape':
    case 'KeyP':
      return 'PAUSE';
    case 'KeyM':
      return 'SON';
  }
  if (profil === 'moderne') {
    switch (e.code) {
      case 'KeyD':
        return 'DROITE';
      case 'KeyA': // touche Q d'un clavier AZERTY
        return 'GAUCHE';
      case 'ArrowUp':
      case 'KeyW': // touche Z d'un clavier AZERTY
        return 'ESPACE';
    }
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
  private readonly profil: () => ProfilClavier;
  private readonly enfoncees = new Set<Touche>();

  constructor(cible: CibleEntrees, estActif: () => boolean, profil: () => ProfilClavier = () => 'classique') {
    this.cible = cible;
    this.estActif = estActif;
    this.profil = profil;
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
    if (e.ctrlKey || e.metaKey || e.altKey || estEditable(e.target)) return;
    const c = commandeDe(e, this.profil());
    if (c === 'PAUSE' || c === 'SON') {
      if (e.repeat) return;
      // la pause doit rester accessible même quand le jeu est en pause
      this.cible.commande(c);
      if (this.estActif() || c === 'PAUSE') e.preventDefault();
      return;
    }
    if (!this.estActif()) return;
    if (!c) {
      // ↑ et ↓ ne doivent pas faire défiler la page pendant une partie
      if (e.code === 'ArrowUp' || e.code === 'ArrowDown') e.preventDefault();
      return;
    }
    e.preventDefault(); // pas de défilement, pas d'activation du bouton qui a le focus
    e.stopPropagation();
    if (e.repeat || this.enfoncees.has(c)) return;
    this.enfoncees.add(c);
    this.cible.enfoncer(c, e.timeStamp);
  };

  private readonly surRelachement = (e: KeyboardEvent): void => {
    const c = commandeDe(e, this.profil());
    if (!c || c === 'PAUSE' || c === 'SON') return;
    if (this.estActif()) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!this.enfoncees.delete(c)) return;
    this.cible.relacher(c, e.timeStamp);
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
 * Manette (Gamepad API, disposition standard) : stick gauche ou croix pour se déplacer,
 * A/B ou haut de la croix pour sauter, Start pour la pause. Lue à chaque image.
 */
export class Manette {
  private readonly cible: CibleEntrees;
  private precedent = { gauche: false, droite: false, saut: false, pause: false };
  private connectee = false;
  private readonly surConnexion = (): void => {
    this.connectee = true;
  };

  constructor(cible: CibleEntrees) {
    this.cible = cible;
    window.addEventListener('gamepadconnected', this.surConnexion);
  }

  detacher(): void {
    window.removeEventListener('gamepadconnected', this.surConnexion);
  }

  lire(actif: boolean): void {
    if (!this.connectee || typeof navigator.getGamepads !== 'function') return;
    const etat = { gauche: false, droite: false, saut: false, pause: false };
    for (const pad of navigator.getGamepads()) {
      if (!pad) continue;
      const b = (i: number): boolean => Boolean(pad.buttons[i]?.pressed);
      const ax = pad.axes[0] ?? 0;
      etat.gauche ||= ax < -0.45 || b(14);
      etat.droite ||= ax > 0.45 || b(15);
      etat.saut ||= b(0) || b(1) || b(12);
      etat.pause ||= b(9);
    }
    const t = performance.now();
    if (etat.pause && !this.precedent.pause) this.cible.commande('PAUSE');
    if (actif) {
      const bascule = (cle: 'gauche' | 'droite' | 'saut', touche: Touche): void => {
        if (etat[cle] && !this.precedent[cle]) this.cible.enfoncer(touche, t);
        else if (!etat[cle] && this.precedent[cle]) this.cible.relacher(touche, t);
      };
      bascule('gauche', 'GAUCHE');
      bascule('droite', 'DROITE');
      bascule('saut', 'ESPACE');
    }
    this.precedent = etat;
  }
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
