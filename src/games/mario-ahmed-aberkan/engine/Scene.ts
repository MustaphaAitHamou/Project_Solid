import { CompteARebours, Score } from './affichage.ts';
import { Champ, Tortue } from './ennemis.ts';
import { Mario } from './Mario.ts';
import { BLOCS, CHAMPS, MARIO, PIECES, TORTUES, TUYAUX_ROUGES } from './niveau.ts';
import type { Objet } from './Objet.ts';
import { Bloc, Piece, TuyauRouge } from './objets.ts';
import type { Corrections } from '../config.ts';
import type { Graphiques, NomImage, Police, ResultatPartie, SortieAudio } from './types.ts';

/** new Font("Arial", Font.PLAIN, 18) */
export const POLICE_SCORE: Police = { nom: 'Arial', style: 0, taille: 18 };
/** new Font("Arial", Font.BOLD, 50) */
export const POLICE_FIN: Police = { nom: 'Arial', style: 1, taille: 50 };
/** new Font("Arial", Font.BOLD, 10) — ligne de crédit ajoutée dans Project_Dhmed */
export const POLICE_CREDIT: Police = { nom: 'Arial', style: 1, taille: 10 };
export const TEXTE_CREDIT = 'Par Aknanir nAth Yettura pour ig: @dz_kabylifornie';
export const TEXTE_VICTOIRE = 'arwu cḍaḥ !!';
export const TEXTE_DEFAITE = 'Tqarseḍ akk ziɣ';

/**
 * Portage de com.mosmos.jeu.Scene (version Project_Dhmed) — le « moteur » du jeu.
 *
 * Comme en Java, toute la logique d'un tour (collisions, défilement, animations, sauts, mort)
 * s'exécute dans paintComponent(), entremêlée aux appels de dessin : saute(), marche(), meurt()
 * et Piece.bouge() modifient l'état au moment où l'image est demandée. L'ordre des instructions
 * est donc reproduit à l'identique. Les dessins sont enregistrés dans un objet Graphiques
 * (liste d'affichage) puis rendus par la couche navigateur.
 */
export class Scene {
  // **** VARIABLES ****
  private imgFond1: NomImage = 'fondEcran';
  private imgFond2: NomImage = 'fondEcran';
  private imgChateau1: NomImage = 'chateau1';
  private imgDepart: NomImage = 'depart';

  private xFond1: number;
  private xFond2: number;
  /** déplacement du fond d'écran */
  private dx: number;
  /** position absolue dans le jeu */
  private xPos: number;
  /** hauteur courante du sol */
  private ySol: number;
  /** hauteur courante du plafond */
  private hauteurPlafond: number;
  private ok: boolean;

  public mario: Mario;

  private imgDrapeau: NomImage = 'drapeau';
  private imgChateauFin: NomImage = 'chateauFin';

  /** tableau qui enregistre tous les objets du jeu (8 tuyaux puis 12 blocs) */
  private tabObjets: Objet[];
  /** tableau qui enregistre toutes les pièces du jeu */
  private tabPieces: Piece[];
  /** tableau qui enregistre toutes les tortues du jeu */
  private tabTortues: Tortue[];
  /** tableau qui enregistre tous les champignons du jeu */
  private tabChamps: Champ[];

  private score: Score;
  private police: Police;
  private compteARebours: CompteARebours;

  /** Remplace les appels statiques Audio.playSound(...) */
  readonly audio: SortieAudio;
  /** Toutes les pièces, y compris ramassées (pour les sauvegardes d'état). */
  readonly toutesLesPieces: readonly Piece[];
  /** Ajout Web (sans effet sur la logique) : résultat affiché au dernier tour, null si aucun. */
  private resultat: ResultatPartie | null = null;
  private readonly corrections: Pick<Corrections, 'musiqueEtSonDeVictoire'>;
  /** Correction « musiqueEtSonDeVictoire » : indicateurs propres à la musique de thème. */
  private musiqueLancee = false;
  private musiqueArretee = false;

  // **** CONSTRUCTEUR ****
  constructor(
    audio: SortieAudio,
    corrections: Pick<Corrections, 'musiqueEtSonDeVictoire'> = { musiqueEtSonDeVictoire: false },
  ) {
    this.audio = audio;
    this.corrections = corrections;
    this.xFond1 = -50;
    this.xFond2 = 750;
    this.dx = 0;
    this.xPos = -1;
    this.ySol = 293;
    this.hauteurPlafond = 0;
    this.ok = true;

    this.mario = new Mario(this, MARIO[0], MARIO[1]);

    this.tabObjets = [
      ...TUYAUX_ROUGES.map(([x, y]) => new TuyauRouge(this, x, y)),
      ...BLOCS.map(([x, y]) => new Bloc(this, x, y)),
    ];
    this.tabPieces = PIECES.map(([x, y]) => new Piece(this, x, y));
    this.toutesLesPieces = [...this.tabPieces];
    this.tabChamps = CHAMPS.map(([x, y]) => new Champ(this, x, y));
    this.tabTortues = TORTUES.map(([x, y]) => new Tortue(this, x, y));

    this.score = new Score();
    this.police = POLICE_SCORE;
    this.compteARebours = new CompteARebours();
  }

  // **** GETTERS ****
  getDx(): number {
    return this.dx;
  }
  getxPos(): number {
    return this.xPos;
  }
  getySol(): number {
    return this.ySol;
  }
  getHautPlafond(): number {
    return this.hauteurPlafond;
  }
  getxFond1(): number {
    return this.xFond1;
  }
  getxFond2(): number {
    return this.xFond2;
  }
  isOk(): boolean {
    return this.ok;
  }
  getObjets(): readonly Objet[] {
    return this.tabObjets;
  }
  getPieces(): readonly Piece[] {
    return this.tabPieces;
  }
  getChamps(): readonly Champ[] {
    return this.tabChamps;
  }
  getTortues(): readonly Tortue[] {
    return this.tabTortues;
  }
  getScore(): Score {
    return this.score;
  }
  getCompteARebours(): CompteARebours {
    return this.compteARebours;
  }
  getResultat(): ResultatPartie | null {
    return this.resultat;
  }

  // **** SETTERS ****
  setDx(dx: number): void {
    this.dx = dx;
  }
  setxPos(xPos: number): void {
    this.xPos = xPos;
  }
  setySol(ySol: number): void {
    this.ySol = ySol;
  }
  setHautPlafond(hauteurPlafond: number): void {
    this.hauteurPlafond = hauteurPlafond;
  }
  setxFond1(xFond1: number): void {
    this.xFond1 = xFond1;
  }
  setxFond2(xFond2: number): void {
    this.xFond2 = xFond2;
  }
  /** Utilisé par les sauvegardes d'état (pièces ramassées). */
  setPieces(pieces: Piece[]): void {
    this.tabPieces = pieces;
  }

  // **** METHODES ****
  /** Déplacement des images « fixes » de l'écran simulant le déplacement de Mario. */
  deplacementFond(): void {
    if (this.xPos >= 0 && this.xPos <= 4430) {
      // Mise à jour des positions des éléments du jeu lors du déplacement de Mario
      this.xPos = this.xPos + this.dx;
      this.xFond1 = this.xFond1 - this.dx;
      this.xFond2 = this.xFond2 - this.dx;
    }
    // Permanence du fond d'écran
    if (this.xFond1 === -800) {
      this.xFond1 = 800;
    } else if (this.xFond2 === -800) {
      this.xFond2 = 800;
    } else if (this.xFond1 === 800) {
      this.xFond1 = -800;
    } else if (this.xFond2 === 800) {
      this.xFond2 = -800;
    }
  }

  private partieGagnee(): boolean {
    if (
      this.compteARebours.getCompteurTemps() > 0 &&
      this.mario.isVivant() === true &&
      this.score.getNbPieces() === 10 &&
      this.xPos > 4400
    ) {
      if (this.ok === true) {
        this.audio.playSound('/audio/partieGagnee.wav');
        this.ok = false;
      }
      return true;
    }
    return false;
  }

  private partiePerdue(): boolean {
    if (this.mario.isVivant() === false || this.compteARebours.getCompteurTemps() <= 0) {
      return true;
    }
    return false;
  }

  finDePartie(): boolean {
    if (this.corrections.musiqueEtSonDeVictoire) {
      // Correction (voir config.ts) : la musique ne consomme plus l'indicateur du son de victoire
      const fin = this.partieGagnee() === true || this.partiePerdue() === true;
      if (!fin && !this.musiqueLancee) {
        this.audio.playSound('/audio/themeSong.wav');
        this.musiqueLancee = true;
      } else if (fin && this.musiqueLancee && !this.musiqueArretee) {
        this.audio.stopSound('/audio/themeSong.wav');
        this.musiqueArretee = true;
      }
      return fin;
    }
    // Code Java d'origine (Project_Dhmed), reproduit tel quel
    if (this.partieGagnee() === true || this.partiePerdue() === true) {
      if (this.ok === true) {
        this.audio.stopSound('/audio/themeSong.wav');
        this.ok = false;
      }
      return true;
    } else {
      if (this.ok === true) {
        this.audio.playSound('/audio/themeSong.wav');
        this.ok = false;
      }
      return false;
    }
  }

  /** Dessin de toutes les images visibles à l'écran (appelé toutes les 3 ms environ en Java). */
  paintComponent(g2: Graphiques): void {
    // Détections des contacts avec des objets
    for (let i = 0; i < this.tabObjets.length; i++) {
      // mario
      if (this.mario.procheObjet(this.tabObjets[i])) {
        this.mario.contactObjet(this.tabObjets[i]);
      }
      // champignons
      for (let j = 0; j < this.tabChamps.length; j++) {
        if (this.tabChamps[j].procheObjet(this.tabObjets[i])) {
          this.tabChamps[j].contactObjet(this.tabObjets[i]);
        }
      }
      // tortues
      for (let j = 0; j < this.tabTortues.length; j++) {
        if (this.tabTortues[j].procheObjet(this.tabObjets[i])) {
          this.tabTortues[j].contactObjet(this.tabObjets[i]);
        }
      }
    }

    // Détection des contacts de mario avec des pièces
    // (comme en Java, après remove(i) l'indice continue d'avancer : la pièce suivante
    // n'est testée qu'au tour d'après)
    for (let i = 0; i < this.tabPieces.length; i++) {
      if (this.mario.procheObjet(this.tabPieces[i])) {
        if (this.mario.contactPiece(this.tabPieces[i])) {
          this.audio.playSound('/audio/issordiyen.wav');
          this.tabPieces.splice(i, 1);
          this.score.setNbPieces(this.score.getNbPieces() + 1);
        }
      }
    }

    // Détections des contacts des champignons avec les personnages (hors mario)
    for (let i = 0; i < this.tabChamps.length; i++) {
      // champignons
      for (let j = 0; j < this.tabChamps.length; j++) {
        if (j !== i) {
          if (this.tabChamps[j].prochePersonnage(this.tabChamps[i])) {
            this.tabChamps[j].contactPersonnage(this.tabChamps[i]);
          }
        }
      }
      // tortues
      for (let j = 0; j < this.tabTortues.length; j++) {
        if (this.tabTortues[j].prochePersonnage(this.tabChamps[i])) {
          this.tabTortues[j].contactPersonnage(this.tabChamps[i]);
        }
      }
    }

    // Détections des contacts des tortues avec les personnages (hors mario)
    for (let i = 0; i < this.tabTortues.length; i++) {
      // champignons
      for (let j = 0; j < this.tabChamps.length; j++) {
        if (this.tabChamps[j].prochePersonnage(this.tabTortues[i])) {
          this.tabChamps[j].contactPersonnage(this.tabTortues[i]);
        }
      }
      // tortues (la boucle Java commence à j = 1 : conservé tel quel)
      for (let j = 1; j < this.tabTortues.length; j++) {
        if (j !== i) {
          if (this.tabTortues[j].prochePersonnage(this.tabTortues[i])) {
            this.tabTortues[j].contactPersonnage(this.tabTortues[i]);
          }
        }
      }
    }

    // Détection des contacts de mario avec des personnages
    // champignons
    for (let i = 0; i < this.tabChamps.length; i++) {
      if (this.mario.prochePersonnage(this.tabChamps[i]) && this.tabChamps[i].isVivant() === true) {
        this.mario.contactPersonnage(this.tabChamps[i]);
        if (this.tabChamps[i].isVivant() === false) {
          this.audio.playSound('/audio/cheikhLdjama3.wav');
        }
      }
    }
    // tortues
    for (let i = 0; i < this.tabTortues.length; i++) {
      if (this.mario.prochePersonnage(this.tabTortues[i]) && this.tabTortues[i].isVivant() === true) {
        this.mario.contactPersonnage(this.tabTortues[i]);
        if (this.tabTortues[i].isVivant() === false) {
          this.audio.playSound('/audio/A3rav.wav');
        }
      }
    }

    // Déplacement de tous les objets "fixes" du jeu
    this.deplacementFond();
    if (this.xPos >= 0 && this.xPos <= 4430) {
      for (let i = 0; i < this.tabObjets.length; i++) this.tabObjets[i].deplacement();
      for (let i = 0; i < this.tabPieces.length; i++) this.tabPieces[i].deplacement();
      for (let i = 0; i < this.tabChamps.length; i++) this.tabChamps[i].deplacement();
      for (let i = 0; i < this.tabTortues.length; i++) this.tabTortues[i].deplacement();
    }

    // Image de fond
    g2.drawImage(this.imgFond1, this.xFond1, 0);
    g2.drawImage(this.imgFond2, this.xFond2, 0);
    const pub = POLICE_CREDIT;
    g2.setFont(pub);
    g2.drawString(TEXTE_CREDIT, 180, 10);

    // Image du château du départ
    g2.drawImage(this.imgChateau1, 10 - this.xPos, 95);
    // Image du panneau de départ
    g2.drawImage(this.imgDepart, 220 - this.xPos, 234);

    // Images des objets
    for (let i = 0; i < this.tabObjets.length; i++) {
      g2.drawImage(this.tabObjets[i].getImgObjet(), this.tabObjets[i].getX(), this.tabObjets[i].getY());
    }

    // Images des pièces (Java évalue bouge() avant getX()/getY())
    for (let i = 0; i < this.tabPieces.length; i++) {
      const img = this.tabPieces[i].bouge();
      g2.drawImage(img, this.tabPieces[i].getX(), this.tabPieces[i].getY());
    }

    // Image du drapeau d'arrivée
    g2.drawImage(this.imgDrapeau, 4650 - this.xPos, 115);
    // Image du château d'arrivée
    g2.drawImage(this.imgChateauFin, 5000 - this.xPos, 145);

    // Image de mario (saute(), marche() et meurt() sont évalués avant getX()/getY())
    if (this.mario.isVivant() === true) {
      if (this.mario.isSaut()) {
        const img = this.mario.saute();
        g2.drawImage(img, this.mario.getX(), this.mario.getY());
      } else {
        const img = this.mario.marche('mario', 25);
        g2.drawImage(img, this.mario.getX(), this.mario.getY());
      }
    } else {
      const img = this.mario.meurt();
      g2.drawImage(img, this.mario.getX(), this.mario.getY());
    }

    // Images des champignons
    for (let i = 0; i < this.tabChamps.length; i++) {
      if (this.tabChamps[i].isVivant() === true) {
        const img = this.tabChamps[i].marche('champ', 45);
        g2.drawImage(img, this.tabChamps[i].getX(), this.tabChamps[i].getY());
      } else {
        const img = this.tabChamps[i].meurt();
        g2.drawImage(img, this.tabChamps[i].getX(), this.tabChamps[i].getY() + 20);
      }
    }

    // Images des tortues
    for (let i = 0; i < this.tabTortues.length; i++) {
      if (this.tabTortues[i].isVivant() === true) {
        const img = this.tabTortues[i].marche('tortue', 50);
        g2.drawImage(img, this.tabTortues[i].getX(), this.tabTortues[i].getY());
      } else {
        const img = this.tabTortues[i].meurt();
        g2.drawImage(img, this.tabTortues[i].getX(), this.tabTortues[i].getY() + 30);
      }
    }
    g2.setFont(this.police);
    // Texte exact du Java (sans espace entre le nombre et « pièce(s) »)
    g2.drawString(this.score.getNbPieces() + 'pièce(s) trouvée(s) sur ' + this.score.getNB_TOTAL_PIECES(), 460, 25);
    g2.drawString(this.compteARebours.getStr(), 5, 25);

    if (this.finDePartie() === true) {
      const policeFin = POLICE_FIN;
      g2.setFont(policeFin);
      if (this.partieGagnee() === true) {
        g2.drawString(TEXTE_VICTOIRE, 120, 180);
        this.resultat = 'gagnee';
      } else {
        g2.drawString(TEXTE_DEFAITE, 120, 180);
        this.resultat = 'perdue';
      }
    } else {
      this.resultat = null;
    }
  }
}
