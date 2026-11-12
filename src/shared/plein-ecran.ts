/**
 * Plein écran d'un élément, avec repli « simulé » (élément étendu à toute la fenêtre en CSS)
 * quand l'API n'est pas disponible (iPhone notamment).
 */
interface DocumentPrefixe {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
  webkitFullscreenEnabled?: boolean;
}
interface ElementPrefixe {
  webkitRequestFullscreen?: () => Promise<void> | void;
}

const CLASSE_SIMULE = 'ks-plein-ecran-simule';

export function elementPleinEcran(): Element | null {
  const d = document as Document & DocumentPrefixe;
  return d.fullscreenElement ?? d.webkitFullscreenElement ?? document.querySelector(`.${CLASSE_SIMULE}`);
}

export function apiPleinEcranDisponible(): boolean {
  const d = document as Document & DocumentPrefixe;
  return Boolean(d.fullscreenEnabled ?? d.webkitFullscreenEnabled);
}

export async function entrerPleinEcran(element: HTMLElement): Promise<void> {
  const el = element as HTMLElement & ElementPrefixe;
  try {
    if (apiPleinEcranDisponible()) {
      if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' });
      else await el.webkitRequestFullscreen?.();
      // Sur mobile, privilégie l'orientation paysage (ignoré si non pris en charge)
      const orientation = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
      orientation?.lock?.('landscape').catch(() => undefined);
      return;
    }
  } catch {
    /* refusé : repli simulé */
  }
  element.classList.add(CLASSE_SIMULE);
  document.documentElement.classList.add('ks-defilement-bloque');
  element.dispatchEvent(new Event('ks-plein-ecran', { bubbles: true }));
}

export async function quitterPleinEcran(): Promise<void> {
  const d = document as Document & DocumentPrefixe;
  const simule = document.querySelector(`.${CLASSE_SIMULE}`);
  if (simule) {
    simule.classList.remove(CLASSE_SIMULE);
    document.documentElement.classList.remove('ks-defilement-bloque');
    simule.dispatchEvent(new Event('ks-plein-ecran', { bubbles: true }));
    return;
  }
  if (d.fullscreenElement) await document.exitFullscreen();
  else if (d.webkitFullscreenElement) await d.webkitExitFullscreen?.();
}

export async function basculerPleinEcran(element: HTMLElement): Promise<boolean> {
  if (elementPleinEcran() === element) {
    await quitterPleinEcran();
    return false;
  }
  await entrerPleinEcran(element);
  return true;
}

/** Appelle `rappel` à chaque entrée/sortie du plein écran (réel ou simulé). Renvoie le désabonnement. */
export function surChangementPleinEcran(rappel: () => void): () => void {
  document.addEventListener('fullscreenchange', rappel);
  document.addEventListener('webkitfullscreenchange', rappel);
  document.addEventListener('ks-plein-ecran', rappel);
  const echap = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' && document.querySelector(`.${CLASSE_SIMULE}`)) void quitterPleinEcran();
  };
  document.addEventListener('keydown', echap);
  return () => {
    document.removeEventListener('fullscreenchange', rappel);
    document.removeEventListener('webkitfullscreenchange', rappel);
    document.removeEventListener('ks-plein-ecran', rappel);
    document.removeEventListener('keydown', echap);
  };
}
