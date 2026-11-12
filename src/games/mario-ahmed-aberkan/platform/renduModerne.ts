import type { NomImage } from '../engine/index.ts';
import { TEXTE_CREDIT, TEXTE_DEFAITE, TEXTE_VICTOIRE } from '../engine/Scene.ts';
import type { Ennemi, EtatMonde } from '../moderne/monde.ts';
import { DUREES, MAT_X, PARALLAXE_CIEL, SOL, VUE } from '../moderne/reglages.ts';
import type { RessourceImage } from './chargement.ts';
import { contexte2d, facteurEntier } from './rendu.ts';

const POLICE_UI = 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
/** Le sol du décor commence à la ligne 293 de fondEcran.png : le ciel et le sol défilent séparément. */
const LIGNE_SOL = 293;
const DECOR_DECALAGE = -50; // Java : xFond1 = -50 au départ

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const versLeBas = (t: number): number => 1 - (1 - t) ** 3;

/**
 * Rendu du mode Moderne (mêmes images originales, jamais modifiées ni filtrées) :
 * - interpolation entre les deux derniers pas de simulation (mouvement fluide à toute fréquence) ;
 * - caméra au sous-pixel (pixels du jeu agrandis d'un facteur entier, sprites nets) ;
 * - parallaxe : la bande « ciel » du décor défile plus lentement que la bande « sol » ;
 * - particules, textes flottants, secousses, interface (HUD) tracée à la résolution de l'écran.
 */
export class RenduModerne {
  private readonly ecran: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly images: Map<NomImage, RessourceImage>;
  private k = 1;
  private piecesAffichees = 0;
  private impulsionPieces = 0;
  private dernierT = 0;

  constructor(ecran: HTMLCanvasElement, images: Map<NomImage, RessourceImage>) {
    this.ecran = ecran;
    this.images = images;
    this.ctx = contexte2d(ecran, true);
  }

  get facteurInterne(): number {
    return this.k;
  }

  dimensionner(largeurPx: number, _hauteurPx: number): void {
    this.k = facteurEntier(largeurPx);
    if (this.ecran.width !== VUE.largeur * this.k) {
      this.ecran.width = VUE.largeur * this.k;
      this.ecran.height = VUE.hauteur * this.k;
    }
  }

  private img(nom: NomImage): RessourceImage {
    const i = this.images.get(nom);
    if (!i) throw new Error(`Image non chargée : ${nom}`);
    return i;
  }

  /** Arrondi au pixel physique : déplacement au sous-pixel du jeu, sans flou. */
  private px(v: number): number {
    return Math.round(v * this.k) / this.k;
  }

  private sprite(nom: NomImage, x: number, y: number, alpha = 1): void {
    const i = this.img(nom);
    if (alpha <= 0) return;
    if (alpha < 1) this.ctx.globalAlpha = alpha;
    this.ctx.drawImage(i.source, this.px(x), this.px(y), i.largeur, i.hauteur);
    if (alpha < 1) this.ctx.globalAlpha = 1;
  }

  /** `apercu` : image fixe derrière l'écran d'accueil (sans les textes d'annonce). */
  dessiner(m: EtatMonde, alpha: number, apercu = false): void {
    const c = this.ctx;
    const k = this.k;
    const dt = Math.max(0, Math.min(0.1, m.t - this.dernierT));
    this.dernierT = m.t;
    c.setTransform(k, 0, 0, k, 0, 0);
    c.imageSmoothingEnabled = false;
    c.globalAlpha = 1;

    const cam = lerp(m.camera.px, m.camera.x, alpha) + m.camera.sx;
    const sy = m.camera.sy;

    // --- décor (parallaxe)
    const fond = this.img('fondEcran');
    const tuiles = (decalage: number, sy0: number, h: number): void => {
      let x = (((decalage % 800) + 800) % 800) - 800;
      for (; x < VUE.largeur; x += 800) {
        c.drawImage(fond.source, 0, sy0, 800, h, this.px(x), this.px(sy0 + sy), 800, h);
      }
    };
    c.fillStyle = '#7a8cff';
    c.fillRect(0, 0, VUE.largeur, VUE.hauteur);
    tuiles(DECOR_DECALAGE - cam * PARALLAXE_CIEL, 0, LIGNE_SOL);
    tuiles(DECOR_DECALAGE - cam, LIGNE_SOL, 350 - LIGNE_SOL);

    // --- monde
    c.save();
    c.translate(-this.px(cam), this.px(sy));
    const visible = (x: number, l: number): boolean => x + l > cam - 40 && x < cam + VUE.largeur + 40;

    if (visible(10, 172)) this.sprite('chateau1', 10, 95);
    if (visible(220, 50)) this.sprite('depart', 220, 234);
    for (const s of m.solides) {
      if (!visible(s.x, s.largeur)) continue;
      const bosse = s.bosse > 0 ? Math.sin(Math.PI * (1 - s.bosse / DUREES.bosseBloc)) * 7 : 0;
      this.sprite(s.type === 'tuyau' ? 'tuyauRouge' : 'bloc', s.x, s.y - bosse);
    }
    for (const p of m.pieces) {
      if (!visible(p.x, 30)) continue;
      if (!p.prise) {
        const bob = Math.sin(m.t * 3.2 + p.x * 0.05) * 2.5;
        this.sprite(Math.floor(m.t / 0.316) % 2 === 0 ? 'piece1' : 'piece2', p.x, p.y + bob);
      } else if (p.tempsPrise < 0.3) {
        this.sprite('piece1', p.x, p.y - versLeBas(p.tempsPrise / 0.3) * 36, 1 - p.tempsPrise / 0.3);
      }
    }
    if (visible(4650, 49)) this.sprite('drapeau', 4650, 115);
    if (visible(5000, 124)) this.sprite('chateauFin', 5000, 145);
    for (const en of m.ennemis) this.dessinerEnnemi(en, alpha, visible);
    this.dessinerJoueur(m, alpha);
    this.dessinerParticules(m);
    c.restore();

    this.dessinerInterface(m, dt, apercu);
  }

  private dessinerEnnemi(en: Ennemi, alpha: number, visible: (x: number, l: number) => boolean): void {
    const x = lerp(en.px, en.x, alpha);
    if (!visible(x - 20, 70)) return;
    const cote = en.vx >= 0 ? 'Droite' : 'Gauche';
    if (en.type === 'champ') {
      if (en.vivant)
        this.sprite(Math.floor(en.phase / 0.142) % 2 === 0 ? `champArret${cote}` : `champMarche${cote}`, x, en.y);
      else {
        const a = 1 - Math.max(0, (en.tempsMort - 0.5) / (DUREES.disparitionChampEcrase - 0.5));
        this.sprite(`champEcrase${cote}`, x + en.largeur / 2 - 32.5, en.y + 20, a);
      }
    } else if (en.vivant) {
      this.sprite(Math.floor(en.phase / 0.158) % 2 === 0 ? `tortueArret${cote}` : `tortueMarche${cote}`, x, en.y);
    } else {
      const a = 1 - Math.max(0, (en.tempsMort - 1.2) / (DUREES.disparitionCarapace - 1.2));
      this.sprite('tortueFermee', x + 1.5, en.y + 27, a);
    }
  }

  private dessinerJoueur(m: EtatMonde, alpha: number): void {
    const j = m.joueur;
    const x = lerp(j.px, j.x, alpha);
    const y = lerp(j.py, j.y, alpha);
    const cote = j.direction === 1 ? 'Droite' : 'Gauche';
    if (j.etat === 'mort') {
      if (j.tempsEtat < DUREES.explosion) this.sprite('boom', x + 14 - 31.5, y);
      else this.sprite('marioMeurt', x, y);
      return;
    }
    if (j.etat === 'entre') {
      this.sprite('marioArretDroite', x, y, 1 - j.tempsEtat / 0.25);
      return;
    }
    if (j.etat === 'victoire' && j.y + 50 < SOL) {
      this.sprite('marioSautDroite', x, y);
      return;
    }
    if (!j.auSol && j.etat === 'normal') {
      this.sprite(`marioSaut${cote}`, x, y);
      return;
    }
    const enMarche = j.etat === 'victoire' || Math.abs(j.vx) > 15;
    const pas = enMarche && Math.floor(j.phaseMarche / 0.08) % 2 === 1;
    this.sprite(pas ? `marioMarche${cote}` : `marioArret${cote}`, x, y);
  }

  private dessinerParticules(m: EtatMonde): void {
    const c = this.ctx;
    for (const p of m.particules) {
      c.globalAlpha = Math.min(1, (p.vie / p.vieMax) * 1.4);
      c.fillStyle = p.couleur;
      if (p.forme === 'rond') {
        c.beginPath();
        c.arc(p.x, p.y, p.taille, 0, Math.PI * 2);
        c.fill();
      } else {
        c.save();
        c.translate(p.x, p.y);
        c.rotate(Math.atan2(p.vy, p.vx));
        c.fillRect(-p.taille * 1.8, -p.taille / 2, p.taille * 3.6, p.taille);
        c.restore();
      }
    }
    c.globalAlpha = 1;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    for (const b of m.bulles) {
      c.globalAlpha = Math.min(1, (b.vie / b.vieMax) * 2);
      this.texte(b.texte, b.x, b.y, 15, b.couleur, '#1a1400', 3);
    }
    c.globalAlpha = 1;
  }

  private texte(
    t: string,
    x: number,
    y: number,
    taille: number,
    fond: string,
    contour: string,
    epaisseur: number,
  ): void {
    const c = this.ctx;
    c.font = `800 ${taille}px ${POLICE_UI}`;
    c.lineJoin = 'round';
    c.lineWidth = epaisseur;
    c.strokeStyle = contour;
    c.strokeText(t, x, y);
    c.fillStyle = fond;
    c.fillText(t, x, y);
  }

  private pastille(x: number, y: number, l: number, h: number, couleur = 'rgba(8, 12, 26, 0.55)'): void {
    const c = this.ctx;
    c.fillStyle = couleur;
    c.beginPath();
    c.roundRect(x, y, l, h, h / 2);
    c.fill();
  }

  private dessinerInterface(m: EtatMonde, dt: number, apercu: boolean): void {
    const c = this.ctx;
    c.textBaseline = 'middle';

    // Temps restant
    const urgent = m.chrono <= 10 && m.phase === 'jeu';
    const pulse = urgent ? 1 + Math.max(0, Math.sin(m.t * 10)) * 0.08 : 1;
    this.pastille(10, 10, 92, 32, urgent ? 'rgba(160, 20, 30, 0.72)' : undefined);
    c.save();
    c.translate(30, 26);
    c.strokeStyle = '#ffffff';
    c.lineWidth = 2.2;
    c.beginPath();
    c.arc(0, 0, 8, 0, Math.PI * 2);
    c.moveTo(0, 0);
    c.lineTo(0, -5);
    c.moveTo(0, 0);
    c.lineTo(4, 2);
    c.stroke();
    c.restore();
    c.textAlign = 'left';
    c.save();
    c.translate(46, 27);
    c.scale(pulse, pulse);
    c.font = `800 19px ${POLICE_UI}`;
    c.fillStyle = '#ffffff';
    c.fillText(String(Math.ceil(m.chrono)), 0, 0);
    c.restore();

    // Pièces (avec petite impulsion à chaque pièce)
    if (m.stats.pieces !== this.piecesAffichees) {
      if (m.stats.pieces > this.piecesAffichees) this.impulsionPieces = 1;
      this.piecesAffichees = m.stats.pieces;
    }
    this.impulsionPieces = Math.max(0, this.impulsionPieces - dt * 4);
    const zoom = 1 + this.impulsionPieces * 0.25;
    this.pastille(VUE.largeur - 122, 10, 112, 32);
    c.imageSmoothingEnabled = false;
    const piece = this.img('piece1');
    c.drawImage(piece.source, VUE.largeur - 116, 11, piece.largeur, piece.hauteur);
    c.save();
    c.translate(VUE.largeur - 84, 27);
    c.scale(zoom, zoom);
    c.font = `800 19px ${POLICE_UI}`;
    c.fillStyle = m.stats.pieces === 10 ? '#ffd54a' : '#ffffff';
    c.fillText(`${m.stats.pieces} / 10`, 0, 0);
    c.restore();
    c.textAlign = 'right';
    c.font = `700 12px ${POLICE_UI}`;
    c.fillStyle = 'rgba(255,255,255,0.92)';
    c.fillText(`${m.stats.score.toLocaleString('fr-FR')} pts`, VUE.largeur - 14, 54);

    // Progression jusqu'au drapeau
    const debut = 300;
    const avance = Math.max(0, Math.min(1, (m.joueur.x - debut) / (MAT_X - 24 - debut)));
    this.pastille(250, 21, 200, 8, 'rgba(8, 12, 26, 0.45)');
    c.fillStyle = '#ffd54a';
    c.beginPath();
    c.roundRect(250, 21, Math.max(8, 200 * avance), 8, 4);
    c.fill();
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.arc(250 + 200 * avance, 25, 6, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#e8434b';
    c.beginPath();
    c.moveTo(455, 16);
    c.lineTo(468, 21);
    c.lineTo(455, 26);
    c.fill();

    // Crédit de l'auteur (Java : drawString en haut de l'écran)
    c.textAlign = 'center';
    c.font = `700 9px ${POLICE_UI}`;
    c.fillStyle = 'rgba(255,255,255,0.75)';
    c.fillText(TEXTE_CREDIT, VUE.largeur / 2, 44);

    // Textes centraux
    c.textAlign = 'center';
    if (m.phase === 'intro' && !apercu) {
      const t = Math.min(1, m.tempsPhase / 0.25);
      c.save();
      c.translate(VUE.largeur / 2, 150);
      c.scale(0.6 + versLeBas(t) * 0.4, 0.6 + versLeBas(t) * 0.4);
      this.texte('Prêt ?', 0, 0, 46, '#ffffff', '#1d2550', 8);
      c.restore();
    } else if (m.phase === 'jeu' && m.tempsPhase < 0.7) {
      const t = m.tempsPhase / 0.7;
      c.save();
      c.globalAlpha = 1 - t;
      c.translate(VUE.largeur / 2, 150);
      c.scale(1 + t * 0.5, 1 + t * 0.5);
      this.texte('Partez !', 0, 0, 46, '#ffd54a', '#1d2550', 8);
      c.restore();
    }
    if (m.message) {
      c.globalAlpha = Math.min(1, m.message.vie * 2);
      this.texte(m.message.texte, VUE.largeur / 2, 120, 24, '#ffffff', '#8a1020', 6);
      c.globalAlpha = 1;
    }
    if (m.phase === 'victoire' && m.tempsPhase > 0.35) {
      const t = Math.min(1, (m.tempsPhase - 0.35) / 0.45);
      c.save();
      c.translate(VUE.largeur / 2, 135);
      c.scale(0.4 + versLeBas(t) * 0.6, 0.4 + versLeBas(t) * 0.6);
      c.rotate((1 - versLeBas(t)) * -0.15);
      this.texte(TEXTE_VICTOIRE, 0, 0, 54, '#ffd54a', '#5a2d00', 10);
      c.restore();
    }
    if (m.phase === 'defaite' && m.tempsPhase > 0.5) {
      const t = Math.min(1, (m.tempsPhase - 0.5) / 0.4);
      c.save();
      c.globalAlpha = t;
      c.translate(VUE.largeur / 2, 135 + (1 - versLeBas(t)) * -30);
      this.texte(TEXTE_DEFAITE, 0, 0, 48, '#ffffff', '#8a1020', 9);
      if (m.cause === 'temps') this.texte('Temps écoulé', 0, 44, 20, '#ffd54a', '#1d2550', 5);
      c.restore();
    }
  }
}
