package harnais;

import com.mosmos.affichage.CompteARebours;
import com.mosmos.affichage.Score;
import com.mosmos.audio.Audio;
import com.mosmos.jeu.Main;
import com.mosmos.jeu.Scene;
import com.mosmos.objets.Piece;
import com.mosmos.personnage.Champ;
import com.mosmos.personnage.Mario;
import com.mosmos.personnage.Personnage;
import com.mosmos.personnage.Tortue;

import javax.imageio.ImageIO;
import java.awt.Graphics2D;
import java.awt.event.KeyEvent;
import java.awt.event.KeyListener;
import java.awt.image.BufferedImage;
import java.io.BufferedWriter;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStreamWriter;
import java.lang.reflect.Field;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.zip.GZIPOutputStream;

/**
 * Harnais de référence : exécute le code Java ORIGINAL (seuls les Thread.start() sont retirés et
 * Audio.playSound journalise au lieu de jouer) avec une horloge déterministe en microsecondes qui
 * reproduit les cadences mesurées du jeu réel :
 *   - Chrono      : un paintComponent toutes les 3160 µs (Thread.sleep(3) + repaint mesurés)
 *   - Champ/Tortue: bouge() à 20120 µs puis toutes les 15120 µs (Thread.sleep(20) puis sleep(15))
 *   - CompteARebours : décrément toutes les 1000150 µs (Thread.sleep(1000))
 * À temps égal : compte à rebours, puis ennemis, puis entrées clavier, puis paintComponent.
 * Sortie : une ligne canonique par tour de paintComponent (état complet + appels de dessin + sons).
 */
public class Harnais {
    static final long PERIODE_PAINT = 3160, DELAI_ENNEMIS = 20120, PERIODE_ENNEMIS = 15120, PERIODE_CAR = 1000150;

    static Field champ(Class<?> c, String nom) throws Exception { Field f = c.getDeclaredField(nom); f.setAccessible(true); return f; }
    static String b(boolean v) { return v ? "1" : "0"; }

    public static void main(String[] args) throws Exception {
        String scenario = args[0], sortie = args[1];
        String dossierCaptures = args.length > 2 ? args[2] : null;

        // --- lecture du scénario ---
        int ticks = 0;
        Map<Integer, List<String[]>> entrees = new HashMap<>();
        List<Integer> captures = new ArrayList<>();
        for (String ligne : Files.readAllLines(Paths.get(scenario), StandardCharsets.UTF_8)) {
            ligne = ligne.trim();
            if (ligne.isEmpty() || ligne.startsWith("#")) continue;
            String[] p = ligne.split("\\s+");
            if (p[0].equals("ticks")) ticks = Integer.parseInt(p[1]);
            else if (p[0].equals("capture")) { for (int i = 1; i < p.length; i++) captures.add(Integer.parseInt(p[i])); }
            else entrees.computeIfAbsent(Integer.parseInt(p[0]), k -> new ArrayList<>()).add(new String[]{p[1], p[2]});
        }

        // --- construction de la scène, comme Main.main() ---
        Main.scene = new Scene();
        Scene scene = Main.scene;
        scene.setSize(700, 360);
        KeyListener clavier = scene.getKeyListeners()[0];
        Journal journal = new Journal();

        Field fFond1 = champ(Scene.class, "xFond1"), fFond2 = champ(Scene.class, "xFond2"), fOk = champ(Scene.class, "ok");
        Field fPieces = champ(Scene.class, "tabPieces"), fChamps = champ(Scene.class, "tabChamps"), fTortues = champ(Scene.class, "tabTortues");
        Field fScore = champ(Scene.class, "score"), fCar = champ(Scene.class, "compteARebours");
        Field fCompteurSaut = champ(Mario.class, "compteurSaut"), fCompteurMort = champ(Mario.class, "compteurMort");
        Field fCompteurPiece = champ(Piece.class, "compteur");
        Field fCarTemps = champ(CompteARebours.class, "compteurTemps"), fCarStr = champ(CompteARebours.class, "str");
        @SuppressWarnings("unchecked") List<Champ> champs = (List<Champ>) fChamps.get(scene);
        @SuppressWarnings("unchecked") List<Tortue> tortues = (List<Tortue>) fTortues.get(scene);
        CompteARebours car = (CompteARebours) fCar.get(scene);
        Score score = (Score) fScore.get(scene);

        BufferedImage ecran = new BufferedImage(700, 360, BufferedImage.TYPE_INT_RGB);
        BufferedWriter out = new BufferedWriter(new OutputStreamWriter(
                sortie.endsWith(".gz") ? new GZIPOutputStream(new FileOutputStream(sortie)) : new FileOutputStream(sortie), StandardCharsets.UTF_8));

        long prochainPaint = PERIODE_PAINT, prochainEnnemis = DELAI_ENNEMIS, prochainCar = PERIODE_CAR;
        int tick = 0;
        while (tick < ticks) {
            long t = Math.min(prochainPaint, Math.min(prochainEnnemis, prochainCar));
            if (prochainCar == t) { // CompteARebours.run()
                int v = fCarTemps.getInt(car) - 1;
                fCarTemps.setInt(car, v);
                fCarStr.set(car, "Temps restant : " + v);
                prochainCar += PERIODE_CAR;
                continue;
            }
            if (prochainEnnemis == t) { // Champ.run() / Tortue.run()
                for (Champ c : champs) if (c.isVivant()) c.bouge();
                for (Tortue c : tortues) if (c.isVivant()) c.bouge();
                prochainEnnemis += PERIODE_ENNEMIS;
                continue;
            }
            // Chrono : un tour de paintComponent
            tick++;
            int nbSonsAvant = Audio.journal.size();
            List<String[]> ev = entrees.get(tick);
            if (ev != null) for (String[] e : ev) {
                int code = e[1].equals("DROITE") ? KeyEvent.VK_RIGHT : e[1].equals("GAUCHE") ? KeyEvent.VK_LEFT : KeyEvent.VK_SPACE;
                KeyEvent ke = new KeyEvent(scene, e[0].equals("appui") ? KeyEvent.KEY_PRESSED : KeyEvent.KEY_RELEASED, 0, 0, code, KeyEvent.CHAR_UNDEFINED);
                if (e[0].equals("appui")) clavier.keyPressed(ke); else clavier.keyReleased(ke);
            }
            journal.vider();
            Graphics2D g = ecran.createGraphics();
            g.setColor(scene.getForeground()); // comme JComponent.getComponentGraphics()
            g.setFont(scene.getFont());
            scene.paintComponent(new GraphiqueJournal(g, journal));
            g.dispose();
            prochainPaint += PERIODE_PAINT;

            // --- ligne canonique ---
            StringBuilder sb = new StringBuilder();
            sb.append(tick).append('|')
              .append(scene.getxPos()).append(',').append(scene.getDx()).append(',').append(fFond1.getInt(scene)).append(',')
              .append(fFond2.getInt(scene)).append(',').append(scene.getySol()).append(',').append(scene.getHautPlafond()).append(',')
              .append(b(fOk.getBoolean(scene))).append('|');
            Mario m = scene.mario;
            sb.append('M').append(m.getX()).append(',').append(m.getY()).append(',').append(b(m.isSaut())).append(',')
              .append(fCompteurSaut.getInt(m)).append(',').append(b(m.isMarche())).append(',').append(b(m.isVersDroite())).append(',')
              .append(b(m.isVivant())).append(',').append(m.getCompteur()).append(',').append(fCompteurMort.getInt(m)).append('|');
            sb.append('C'); personnages(sb, champs); sb.append('|');
            sb.append('T'); personnages(sb, tortues); sb.append('|');
            sb.append('P');
            @SuppressWarnings("unchecked") List<Piece> pieces = (List<Piece>) fPieces.get(scene);
            for (int i = 0; i < pieces.size(); i++) {
                Piece p = pieces.get(i);
                if (i > 0) sb.append(';');
                sb.append(p.getX()).append(',').append(p.getY()).append(',').append(fCompteurPiece.getInt(p));
            }
            sb.append('|').append(score.getNbPieces()).append('|').append(car.getCompteurTemps()).append('|');
            for (int i = nbSonsAvant; i < Audio.journal.size(); i++) { if (i > nbSonsAvant) sb.append('+'); sb.append(Audio.journal.get(i)); }
            sb.append('|').append(journal.dessins).append('|').append(journal.textes);
            out.write(sb.toString());
            out.write('\n');
            if (dossierCaptures != null && captures.contains(tick))
                ImageIO.write(ecran, "png", new File(dossierCaptures, "java-" + tick + ".png"));
        }
        out.close();
        System.exit(0); // les threads Personnage ne sont pas démarrés, mais par sécurité
    }

    static void personnages(StringBuilder sb, List<? extends Personnage> liste) {
        for (int i = 0; i < liste.size(); i++) {
            Personnage p = liste.get(i);
            if (i > 0) sb.append(';');
            sb.append(p.getX()).append(',').append(p.getY()).append(',').append(b(p.isVersDroite())).append(',')
              .append(b(p.isVivant())).append(',').append(b(p.isMarche())).append(',').append(p.getCompteur());
        }
    }
}
