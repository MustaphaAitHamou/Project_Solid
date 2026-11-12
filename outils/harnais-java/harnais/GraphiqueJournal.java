package harnais;
@SuppressWarnings({"rawtypes","unchecked"})
public class GraphiqueJournal extends java.awt.Graphics2D {
  public final java.awt.Graphics2D cible; public final Journal journal;
  public GraphiqueJournal(java.awt.Graphics2D cible, Journal journal){this.cible=cible;this.journal=journal;}
  @Override public void scale(double a0, double a1) { cible.scale(a0, a1); }
  @Override public void fill(java.awt.Shape a0) { cible.fill(a0); }
  @Override public void transform(java.awt.geom.AffineTransform a0) { cible.transform(a0); }
  @Override public void rotate(double a0, double a1, double a2) { cible.rotate(a0, a1, a2); }
  @Override public void rotate(double a0) { cible.rotate(a0); }
  @Override public boolean hit(java.awt.Rectangle a0, java.awt.Shape a1, boolean a2) { return cible.hit(a0, a1, a2); }
  @Override public void drawImage(java.awt.image.BufferedImage a0, java.awt.image.BufferedImageOp a1, int a2, int a3) { cible.drawImage(a0, a1, a2, a3); }
  @Override public boolean drawImage(java.awt.Image a0, java.awt.geom.AffineTransform a1, java.awt.image.ImageObserver a2) { return cible.drawImage(a0, a1, a2); }
  @Override public java.awt.Paint getPaint() { return cible.getPaint(); }
  @Override public void setPaint(java.awt.Paint a0) { cible.setPaint(a0); }
  @Override public void draw(java.awt.Shape a0) { cible.draw(a0); }
  @Override public void drawRenderedImage(java.awt.image.RenderedImage a0, java.awt.geom.AffineTransform a1) { cible.drawRenderedImage(a0, a1); }
  @Override public void drawRenderableImage(java.awt.image.renderable.RenderableImage a0, java.awt.geom.AffineTransform a1) { cible.drawRenderableImage(a0, a1); }
  @Override public void drawString(java.text.AttributedCharacterIterator a0, int a1, int a2) { cible.drawString(a0, a1, a2); }
  @Override public void drawString(java.text.AttributedCharacterIterator a0, float a1, float a2) { cible.drawString(a0, a1, a2); }
  @Override public void drawString(java.lang.String a0, float a1, float a2) { cible.drawString(a0, a1, a2); }
  @Override public void drawString(java.lang.String a0, int a1, int a2) { journal.texte(a0, a1, a2, cible.getFont(), cible.getColor()); cible.drawString(a0, a1, a2); }
  @Override public void drawGlyphVector(java.awt.font.GlyphVector a0, float a1, float a2) { cible.drawGlyphVector(a0, a1, a2); }
  @Override public java.awt.GraphicsConfiguration getDeviceConfiguration() { return cible.getDeviceConfiguration(); }
  @Override public void setComposite(java.awt.Composite a0) { cible.setComposite(a0); }
  @Override public void setStroke(java.awt.Stroke a0) { cible.setStroke(a0); }
  @Override public void setRenderingHint(java.awt.RenderingHints.Key a0, java.lang.Object a1) { cible.setRenderingHint(a0, a1); }
  @Override public java.lang.Object getRenderingHint(java.awt.RenderingHints.Key a0) { return cible.getRenderingHint(a0); }
  @Override public void setRenderingHints(java.util.Map a0) { cible.setRenderingHints(a0); }
  @Override public void addRenderingHints(java.util.Map a0) { cible.addRenderingHints(a0); }
  @Override public java.awt.RenderingHints getRenderingHints() { return cible.getRenderingHints(); }
  @Override public void translate(double a0, double a1) { cible.translate(a0, a1); }
  @Override public void translate(int a0, int a1) { cible.translate(a0, a1); }
  @Override public void shear(double a0, double a1) { cible.shear(a0, a1); }
  @Override public void setTransform(java.awt.geom.AffineTransform a0) { cible.setTransform(a0); }
  @Override public java.awt.geom.AffineTransform getTransform() { return cible.getTransform(); }
  @Override public java.awt.Composite getComposite() { return cible.getComposite(); }
  @Override public void setBackground(java.awt.Color a0) { cible.setBackground(a0); }
  @Override public java.awt.Color getBackground() { return cible.getBackground(); }
  @Override public java.awt.Stroke getStroke() { return cible.getStroke(); }
  @Override public void clip(java.awt.Shape a0) { cible.clip(a0); }
  @Override public java.awt.font.FontRenderContext getFontRenderContext() { return cible.getFontRenderContext(); }
  @Override public java.awt.Graphics create() { return new GraphiqueJournal((java.awt.Graphics2D) cible.create(), journal); }
  @Override public void setColor(java.awt.Color a0) { cible.setColor(a0); }
  @Override public void dispose() { cible.dispose(); }
  @Override public boolean drawImage(java.awt.Image a0, int a1, int a2, int a3, int a4, java.awt.Color a5, java.awt.image.ImageObserver a6) { return cible.drawImage(a0, a1, a2, a3, a4, a5, a6); }
  @Override public boolean drawImage(java.awt.Image a0, int a1, int a2, java.awt.Color a3, java.awt.image.ImageObserver a4) { return cible.drawImage(a0, a1, a2, a3, a4); }
  @Override public boolean drawImage(java.awt.Image a0, int a1, int a2, int a3, int a4, java.awt.image.ImageObserver a5) { return cible.drawImage(a0, a1, a2, a3, a4, a5); }
  @Override public boolean drawImage(java.awt.Image a0, int a1, int a2, java.awt.image.ImageObserver a3) { journal.image(a0, a1, a2); return cible.drawImage(a0, a1, a2, a3); }
  @Override public boolean drawImage(java.awt.Image a0, int a1, int a2, int a3, int a4, int a5, int a6, int a7, int a8, java.awt.image.ImageObserver a9) { return cible.drawImage(a0, a1, a2, a3, a4, a5, a6, a7, a8, a9); }
  @Override public boolean drawImage(java.awt.Image a0, int a1, int a2, int a3, int a4, int a5, int a6, int a7, int a8, java.awt.Color a9, java.awt.image.ImageObserver a10) { return cible.drawImage(a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10); }
  @Override public java.awt.Color getColor() { return cible.getColor(); }
  @Override public void fillRect(int a0, int a1, int a2, int a3) { cible.fillRect(a0, a1, a2, a3); }
  @Override public void clipRect(int a0, int a1, int a2, int a3) { cible.clipRect(a0, a1, a2, a3); }
  @Override public java.awt.Font getFont() { return cible.getFont(); }
  @Override public java.awt.FontMetrics getFontMetrics(java.awt.Font a0) { return cible.getFontMetrics(a0); }
  @Override public void drawLine(int a0, int a1, int a2, int a3) { cible.drawLine(a0, a1, a2, a3); }
  @Override public void drawPolygon(int[] a0, int[] a1, int a2) { cible.drawPolygon(a0, a1, a2); }
  @Override public void fillPolygon(int[] a0, int[] a1, int a2) { cible.fillPolygon(a0, a1, a2); }
  @Override public java.awt.Rectangle getClipBounds() { return cible.getClipBounds(); }
  @Override public void setPaintMode() { cible.setPaintMode(); }
  @Override public void setXORMode(java.awt.Color a0) { cible.setXORMode(a0); }
  @Override public void setFont(java.awt.Font a0) { cible.setFont(a0); }
  @Override public void setClip(java.awt.Shape a0) { cible.setClip(a0); }
  @Override public void setClip(int a0, int a1, int a2, int a3) { cible.setClip(a0, a1, a2, a3); }
  @Override public java.awt.Shape getClip() { return cible.getClip(); }
  @Override public void copyArea(int a0, int a1, int a2, int a3, int a4, int a5) { cible.copyArea(a0, a1, a2, a3, a4, a5); }
  @Override public void clearRect(int a0, int a1, int a2, int a3) { cible.clearRect(a0, a1, a2, a3); }
  @Override public void drawRoundRect(int a0, int a1, int a2, int a3, int a4, int a5) { cible.drawRoundRect(a0, a1, a2, a3, a4, a5); }
  @Override public void fillRoundRect(int a0, int a1, int a2, int a3, int a4, int a5) { cible.fillRoundRect(a0, a1, a2, a3, a4, a5); }
  @Override public void drawOval(int a0, int a1, int a2, int a3) { cible.drawOval(a0, a1, a2, a3); }
  @Override public void fillOval(int a0, int a1, int a2, int a3) { cible.fillOval(a0, a1, a2, a3); }
  @Override public void drawArc(int a0, int a1, int a2, int a3, int a4, int a5) { cible.drawArc(a0, a1, a2, a3, a4, a5); }
  @Override public void fillArc(int a0, int a1, int a2, int a3, int a4, int a5) { cible.fillArc(a0, a1, a2, a3, a4, a5); }
  @Override public void drawPolyline(int[] a0, int[] a1, int a2) { cible.drawPolyline(a0, a1, a2); }
}
