import java.awt.*;
import java.lang.reflect.*;
import java.util.*;
/** Génère une sous-classe de Graphics2D qui délègue tout à une cible et journalise drawImage(img,x,y,obs) et drawString(str,x,y). */
public class Generateur {
    static String type(Class<?> c) { return c.getCanonicalName(); }
    public static void main(String[] a) {
        StringBuilder sb = new StringBuilder();
        sb.append("package harnais;\n@SuppressWarnings({\"rawtypes\",\"unchecked\"})\npublic class GraphiqueJournal extends java.awt.Graphics2D {\n");
        sb.append("  public final java.awt.Graphics2D cible; public final Journal journal;\n");
        sb.append("  public GraphiqueJournal(java.awt.Graphics2D cible, Journal journal){this.cible=cible;this.journal=journal;}\n");
        Set<String> vus = new HashSet<>();
        for (Class<?> k : new Class<?>[]{Graphics2D.class, Graphics.class}) {
            for (Method m : k.getDeclaredMethods()) {
                if (!Modifier.isAbstract(m.getModifiers()) || !Modifier.isPublic(m.getModifiers())) continue;
                String sig = m.getName() + Arrays.toString(m.getParameterTypes());
                if (!vus.add(sig)) continue;
                StringBuilder p = new StringBuilder(), n = new StringBuilder();
                Class<?>[] pt = m.getParameterTypes();
                for (int i = 0; i < pt.length; i++) { if (i > 0) { p.append(", "); n.append(", "); } p.append(type(pt[i])).append(" a").append(i); n.append("a").append(i); }
                String ret = type(m.getReturnType());
                sb.append("  @Override public ").append(ret).append(" ").append(m.getName()).append("(").append(p).append(") {");
                String appel = "cible." + m.getName() + "(" + n + ")";
                if (m.getName().equals("drawImage") && sig.equals("drawImage[class java.awt.Image, int, int, interface java.awt.image.ImageObserver]"))
                    sb.append(" journal.image(a0, a1, a2);");
                if (sig.equals("drawString[class java.lang.String, int, int]"))
                    sb.append(" journal.texte(a0, a1, a2, cible.getFont(), cible.getColor());");
                if (m.getName().equals("create") && pt.length == 0) appel = "new GraphiqueJournal((java.awt.Graphics2D) cible.create(), journal)";
                sb.append(ret.equals("void") ? " " + appel + "; }\n" : " return " + appel + "; }\n");
            }
        }
        sb.append("}\n");
        System.out.print(sb);
    }
}
