import { JeuMarioAhmedAberkan } from '../../games/mario-ahmed-aberkan/JeuMarioAhmedAberkan.ts';
import { surChangementPleinEcran } from '../../shared/plein-ecran.ts';
import '../styles/base.css';
import '../styles/page-jeu.css';

const zone = document.getElementById('zone-jeu')!;
const boutonPartie = document.getElementById('bouton-partie') as HTMLButtonElement;
const boutonPleinEcran = document.getElementById('bouton-plein-ecran') as HTMLButtonElement;

const jeu = new JeuMarioAhmedAberkan({
  conteneur: zone,
  modeTest: new URLSearchParams(location.search).has('test'),
  surChangementPhase(phase) {
    boutonPartie.disabled = phase === 'chargement' || phase === 'erreur';
    boutonPleinEcran.disabled = phase === 'chargement';
    boutonPartie.textContent = phase === 'en-cours' || phase === 'terminee' ? 'Recommencer' : 'Commencer';
  },
});

boutonPartie.addEventListener('click', () => jeu.demarrer());
boutonPleinEcran.addEventListener('click', () => void jeu.basculerPleinEcran());
surChangementPleinEcran(() => {
  const actif = jeu.estEnPleinEcran();
  boutonPleinEcran.setAttribute('aria-pressed', String(actif));
  boutonPleinEcran.textContent = actif ? 'Quitter le plein écran' : 'Plein écran';
});

void jeu.charger();
