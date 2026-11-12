/**
 * Types partagés par le moteur. Le moteur est du TypeScript pur, sans DOM ni Three.js :
 * il tourne aussi bien dans le navigateur que dans Node (tests de fidélité).
 */

/** Préfixes utilisés par Personnage.marche(nom, frequence) dans le code Java. */
export type NomPersonnage = 'mario' | 'champ' | 'tortue';

/** Nom (sans extension) de chacune des 28 images originales de src/images. */
export type NomImage =
  | `${NomPersonnage}${'Arret' | 'Marche'}${'Droite' | 'Gauche'}`
  | 'bloc'
  | 'boom'
  | 'champEcraseDroite'
  | 'champEcraseGauche'
  | 'chateau1'
  | 'chateauFin'
  | 'depart'
  | 'drapeau'
  | 'fondEcran'
  | 'marioMeurt'
  | 'marioSautDroite'
  | 'marioSautGauche'
  | 'piece1'
  | 'piece2'
  | 'tortueFermee'
  | 'tuyauRouge';

/** Chemins des sons, écrits exactement comme dans les appels Audio.playSound(...) du Java. */
export type CheminSon =
  | '/audio/saut.wav'
  | '/audio/issordiyen.wav'
  | '/audio/cheikhLdjama3.wav'
  | '/audio/A3rav.wav'
  | '/audio/boum.wav'
  | '/audio/partieGagnee.wav'
  | '/audio/partiePerdue.wav'
  | '/audio/themeSong.wav';

/** Touches gérées par Clavier.java (KeyEvent.VK_RIGHT, VK_LEFT, VK_SPACE). */
export type Touche = 'DROITE' | 'GAUCHE' | 'ESPACE';
export type Direction = Exclude<Touche, 'ESPACE'>;

/** Équivalent de java.awt.Font : style 0 = Font.PLAIN, 1 = Font.BOLD ; taille en pixels Java2D. */
export interface Police {
  readonly nom: string;
  readonly style: 0 | 1;
  readonly taille: number;
}

/** Sous-ensemble de java.awt.Graphics utilisé par Scene.paintComponent(). */
export interface Graphiques {
  drawImage(img: NomImage, x: number, y: number): void;
  setFont(police: Police): void;
  drawString(str: string, x: number, y: number): void;
}

/** Remplace les appels statiques Audio.playSound(son) et Audio.stopSound(son) du Java. */
export interface SortieAudio {
  playSound(son: CheminSon): void;
  stopSound(son: CheminSon): void;
}

export type ResultatPartie = 'gagnee' | 'perdue';
