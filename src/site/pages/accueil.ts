import { CATALOGUE } from '../catalogue.ts';
import '../styles/accueil.css';
import '../styles/base.css';

/** Cartes des jeux, générées depuis le catalogue (source unique). */
function afficherCatalogue(): void {
  const liste = document.querySelector<HTMLUListElement>('[data-catalogue]');
  if (!liste) return;
  liste.replaceChildren(
    ...CATALOGUE.map((jeu) => {
      const carte = document.createElement('li');
      carte.className = 'ks-carte';
      carte.innerHTML = `
        <div class="ks-carte__vignette" role="img" aria-label="Aperçu du jeu ${jeu.titre}">
          <img class="ks-carte__sprite" alt="" width="${jeu.vignette.largeurSprite}" height="${jeu.vignette.hauteurSprite}">
        </div>
        <div class="ks-carte__corps">
          <h3 class="ks-carte__titre"></h3>
          <p class="ks-carte__description"></p>
          <div class="ks-carte__pied">
            <span class="ks-carte__commandes"></span>
            <a class="ks-bouton ks-bouton--principal">▶ Jouer</a>
          </div>
        </div>`;
      carte.querySelector<HTMLElement>('.ks-carte__vignette')!.style.backgroundImage = `url("${jeu.vignette.fond}")`;
      carte.querySelector<HTMLImageElement>('.ks-carte__sprite')!.src = jeu.vignette.sprite;
      carte.querySelector('.ks-carte__titre')!.textContent = jeu.titre;
      carte.querySelector('.ks-carte__description')!.textContent = jeu.description;
      carte.querySelector('.ks-carte__commandes')!.textContent = `Commandes : ${jeu.commandes}`;
      const lien = carte.querySelector<HTMLAnchorElement>('a')!;
      lien.href = jeu.url;
      lien.setAttribute('aria-label', `Jouer à ${jeu.titre}`);
      return carte;
    }),
    Object.assign(document.createElement('li'), {
      className: 'ks-a-venir',
      textContent: 'D’autres jeux et services arriveront bientôt.',
    }),
  );
}

/** Scène 3D chargée à part : le texte de l'accueil s'affiche sans attendre Three.js. */
async function demarrerScene3d(): Promise<void> {
  const canvas = document.querySelector<HTMLCanvasElement>('.ks-heros__3d');
  if (!canvas) return;
  const { SceneAccueil } = await import('../three/SceneAccueil.ts');
  SceneAccueil.creer(canvas);
}

afficherCatalogue();
void demarrerScene3d();
