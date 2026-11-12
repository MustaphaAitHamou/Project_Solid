/**
 * Disposition du niveau, recopiée du constructeur de Scene.java (mêmes valeurs, même ordre :
 * l'ordre compte car il détermine l'ordre des tests de collision et des dessins).
 */
type Position = readonly [x: number, y: number];

/** mario = new Mario(300, 245) */
export const MARIO: Position = [300, 245];

/** tuyauRouge1 … tuyauRouge8 */
export const TUYAUX_ROUGES: readonly Position[] = [
  [600, 230],
  [1000, 230],
  [1600, 230],
  [1900, 230],
  [2500, 230],
  [3000, 230],
  [3800, 230],
  [4500, 230],
];

/** bloc1 … bloc12 */
export const BLOCS: readonly Position[] = [
  [400, 180],
  [1200, 180],
  [1270, 170],
  [1340, 160],
  [2000, 180],
  [2600, 160],
  [2650, 180],
  [3500, 160],
  [3550, 140],
  [4000, 170],
  [4200, 200],
  [4300, 210],
];

/** piece1 … piece10 */
export const PIECES: readonly Position[] = [
  [402, 145],
  [1202, 140],
  [1272, 95],
  [1342, 40],
  [1650, 145],
  [2650, 145],
  [3000, 135],
  [3400, 125],
  [4200, 145],
  [4600, 40],
];

/** champ1 … champ8 */
export const CHAMPS: readonly Position[] = [
  [800, 263],
  [1100, 263],
  [2100, 263],
  [2400, 263],
  [3200, 263],
  [3500, 263],
  [3700, 263],
  [4500, 263],
];

/** tortue1 … tortue9 */
export const TORTUES: readonly Position[] = [
  [950, 243],
  [1500, 243],
  [1800, 243],
  [2400, 243],
  [3100, 243],
  [3600, 243],
  [3900, 243],
  [4200, 243],
  [4400, 243],
];
