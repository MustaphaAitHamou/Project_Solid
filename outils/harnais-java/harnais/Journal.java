package harnais;

import java.awt.Color;
import java.awt.Font;
import java.awt.Image;
import java.awt.Toolkit;
import java.io.File;
import java.net.URL;
import java.util.ArrayList;
import java.util.IdentityHashMap;
import java.util.List;

/** Journalise les appels de dessin d'un tour de paintComponent, en identifiant chaque Image par son nom de fichier. */
public class Journal {
    private final IdentityHashMap<Image, String> noms = new IdentityHashMap<>();
    private final List<Image> retenues = new ArrayList<>(); // références fortes : le cache SoftCache du Toolkit ne se vide pas
    public final StringBuilder dessins = new StringBuilder();
    public final StringBuilder textes = new StringBuilder();

    public Journal() {
        File dossier = new File("src/images");
        for (String f : dossier.list()) {
            if (!f.endsWith(".png")) continue;
            String nom = f.substring(0, f.length() - 4);
            URL url = com.mosmos.jeu.Scene.class.getResource("/images/" + f);
            Image parUrl = Toolkit.getDefaultToolkit().getImage(url);             // new ImageIcon(getClass().getResource(...))
            Image parFichier = Toolkit.getDefaultToolkit().getImage("src/images/" + f); // new ImageIcon("src/images/...") (Mario.marche)
            noms.put(parUrl, nom);
            noms.put(parFichier, nom);
            retenues.add(parUrl);
            retenues.add(parFichier);
        }
    }

    public void image(Image img, int x, int y) {
        String nom = img == null ? "null" : noms.get(img);
        if (nom == null) nom = "?" + System.identityHashCode(img);
        if (dessins.length() > 0) dessins.append(';');
        dessins.append(nom).append('@').append(x).append(',').append(y);
    }

    public void texte(String s, int x, int y, Font f, Color c) {
        if (textes.length() > 0) textes.append(';');
        textes.append(s).append('@').append(x).append(',').append(y).append(',')
              .append(f.getName()).append(',').append(f.getStyle()).append(',').append(f.getSize()).append(',')
              .append(String.format("%06x", c.getRGB() & 0xffffff));
    }

    public void vider() { dessins.setLength(0); textes.setLength(0); }
}
