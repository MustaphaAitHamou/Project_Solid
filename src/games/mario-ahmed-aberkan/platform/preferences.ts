/** Préférences et records du joueur, gardés dans ce navigateur (localStorage). */
export type ModeJeu = 'moderne' | 'classique';

export interface Preferences {
  mode: ModeJeu;
  muet: boolean;
  /** meilleur temps de victoire en mode Moderne (s) */
  meilleurTemps: number | null;
  meilleurScore: number;
}

const CLE = 'kabyle-solide:mario-ahmed-aberkan';
const DEFAUT: Preferences = { mode: 'moderne', muet: false, meilleurTemps: null, meilleurScore: 0 };

export function lirePreferences(): Preferences {
  try {
    const brut = JSON.parse(localStorage.getItem(CLE) ?? '{}') as Partial<Preferences>;
    return {
      mode: brut.mode === 'classique' ? 'classique' : 'moderne',
      muet: brut.muet === true,
      meilleurTemps: typeof brut.meilleurTemps === 'number' ? brut.meilleurTemps : null,
      meilleurScore: typeof brut.meilleurScore === 'number' ? brut.meilleurScore : 0,
    };
  } catch {
    return { ...DEFAUT };
  }
}

export function ecrirePreferences(p: Preferences): void {
  try {
    localStorage.setItem(CLE, JSON.stringify(p));
  } catch {
    /* stockage indisponible (navigation privée…) : sans conséquence */
  }
}
