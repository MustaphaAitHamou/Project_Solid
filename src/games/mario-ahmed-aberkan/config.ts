/**
 * Configuration du jeu « Mario Ahmed Aberkan ».
 * Toutes les valeurs de gameplay proviennent du code Java d'origine ou de mesures du jeu original.
 */

/** Surface de jeu : le JPanel Java fait 700 px de large ; le décor (fondEcran.png) fait 350 px de haut. */
export const LARGEUR_JEU = 700;
export const HAUTEUR_JEU = 350;

/** Couleur de fond du JPanel (Metal/Ocean : Panel.background), peinte par super.paintComponent(). */
export const COULEUR_FOND_PANNEAU = '#eeeeee';
/** Couleur du texte : Graphics initialisé avec getForeground() du JPanel (Metal/Ocean : #333333). */
export const COULEUR_TEXTE = '#333333';

/**
 * Cadences des « threads » du jeu Java, en microsecondes.
 *
 * Le jeu Java n'a pas de vitesse fixe : chaque appel à paintComponent() fait avancer la logique
 * d'un pas, et ces appels sont déclenchés par Chrono (repaint() puis Thread.sleep(3)).
 * Les ennemis ont leur propre thread (sleep(20) puis sleep(15)) et le compte à rebours aussi
 * (sleep(1000)). Valeurs MESURÉES en exécutant le jeu original non modifié (JDK 21, Linux, Xvfb,
 * moyenne de 3 mesures de 12 s) :
 *   - paintComponent : 316,5 appels/s, soit une période de 3,16 ms (sleep(3) réel ≈ 3,12 ms + repaint)
 *   - pas des ennemis : période de 15,12 ms
 *   - compte à rebours : période de 1000,15 ms
 */
export interface CadencesHorloge {
  periodeRafraichissementUs: number;
  delaiInitialEnnemisUs: number;
  periodeEnnemisUs: number;
  periodeCompteAReboursUs: number;
}

export const CADENCES_MESUREES: CadencesHorloge = {
  periodeRafraichissementUs: 3160,
  delaiInitialEnnemisUs: 20120,
  periodeEnnemisUs: 15120,
  periodeCompteAReboursUs: 1_000_150,
};

/**
 * Corrections de bugs techniques du code Java. Chacune est documentée et désactivable :
 * avec AUCUNE_CORRECTION, le moteur reproduit le comportement Java à l'identique
 * (c'est ce mode qui est comparé, tour par tour, aux traces du jeu Java original).
 */
export interface Corrections {
  /**
   * Clavier : en Java, relâcher N'IMPORTE QUELLE touche arrête Mario, et la reprise du mouvement
   * dépend de la répétition automatique du clavier du système (qui s'interrompt dès qu'on appuie
   * sur Espace). Résultat : impossible de garder → enfoncée et de sauter en avançant.
   * Corrigé : tant qu'une flèche est maintenue, son appui est renouvelé avant chaque tour
   * (comme une répétition automatique continue). La logique de Clavier.java est inchangée.
   */
  maintienDesTouches: boolean;
  /**
   * Clavier.java, flèche gauche quand xPos == 4431 : le code appelle trois fois setxPos
   * (4430, -50, 750) au lieu de setxPos/setxFond1/setxFond2. xPos passe à 750 et le niveau se
   * désynchronise (château et drapeau disparaissent, victoire repoussée de ~3900 px).
   * Corrigé selon l'intention du commentaire « Annule le décalage de 1 » : xPos = 4430 et le
   * fond est recalé d'un pixel.
   */
  retourDepuisLaFinDuNiveau: boolean;
  /**
   * Le thread du compte à rebours ne s'arrête jamais : le temps devient négatif et, 100 s après
   * le lancement, le message de victoire « arwu cḍaḥ !! » se transforme en « Tqarseḍ akk ziɣ ».
   * Corrigé : le compte à rebours s'arrête dès que la partie est gagnée ou perdue.
   */
  compteAReboursFigeEnFinDePartie: boolean;
  /**
   * Musique de thème (Scene.finDePartie) : le même indicateur `ok` sert à lancer la musique et à
   * jouer le son de victoire. La musique le consomme au premier tour, donc partieGagnee.wav n'est
   * JAMAIS joué. Et Audio.stopSound() crée un nouveau Clip au lieu d'arrêter celui qui joue : la
   * musique ne s'arrête jamais en fin de partie.
   * Corrigé : la musique a son propre indicateur, elle s'arrête en fin de partie et le son de
   * victoire est joué.
   */
  musiqueEtSonDeVictoire: boolean;
}

export const CORRECTIONS_PAR_DEFAUT: Corrections = {
  maintienDesTouches: true,
  retourDepuisLaFinDuNiveau: true,
  compteAReboursFigeEnFinDePartie: true,
  musiqueEtSonDeVictoire: true,
};

export const AUCUNE_CORRECTION: Corrections = {
  maintienDesTouches: false,
  retourDepuisLaFinDuNiveau: false,
  compteAReboursFigeEnFinDePartie: false,
  musiqueEtSonDeVictoire: false,
};

/** Au-delà de cet écart entre deux images (onglet en arrière-plan, gel), le jeu ne rattrape pas le temps. */
export const RATTRAPAGE_MAX_MS = 100;
