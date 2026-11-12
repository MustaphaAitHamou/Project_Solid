import { JeuMarioAhmedAberkan, type ModeJeu } from '../../games/mario-ahmed-aberkan/JeuMarioAhmedAberkan.ts';
import { surChangementPleinEcran } from '../../shared/plein-ecran.ts';
import '../styles/base.css';
import '../styles/page-jeu.css';

const zone = document.getElementById('zone-jeu')!;
const boutonPartie = document.getElementById('bouton-partie') as HTMLButtonElement;
const boutonPleinEcran = document.getElementById('bouton-plein-ecran') as HTMLButtonElement;
const optionsMode = [...document.querySelectorAll<HTMLButtonElement>('.ks-bascule__option')];

const jeu = new JeuMarioAhmedAberkan({
  conteneur: zone,
  modeTest: new URLSearchParams(location.search).has('test'),
  surChangement({ phase, mode }) {
    boutonPartie.disabled = phase === 'chargement' || phase === 'erreur';
    boutonPleinEcran.disabled = phase === 'chargement';
    boutonPartie.textContent =
      phase === 'pret' || phase === 'chargement' || phase === 'erreur' ? 'Commencer' : 'Recommencer';
    for (const b of optionsMode) b.setAttribute('aria-pressed', String(b.dataset.mode === mode));
  },
});

boutonPartie.addEventListener('click', () => jeu.demarrer());
boutonPleinEcran.addEventListener('click', () => void jeu.basculerPleinEcran());
for (const b of optionsMode) b.addEventListener('click', () => jeu.choisirMode(b.dataset.mode as ModeJeu));
surChangementPleinEcran(() => {
  const actif = jeu.estEnPleinEcran();
  boutonPleinEcran.setAttribute('aria-pressed', String(actif));
  boutonPleinEcran.textContent = actif ? 'Quitter le plein écran' : 'Plein écran';
});

void jeu.charger();
