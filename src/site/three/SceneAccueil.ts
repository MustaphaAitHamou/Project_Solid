import {
  BoxGeometry,
  BufferGeometry,
  Color,
  DirectionalLight,
  DodecahedronGeometry,
  EdgesGeometry,
  Float32BufferAttribute,
  FogExp2,
  GridHelper,
  Group,
  HemisphereLight,
  IcosahedronGeometry,
  LineBasicMaterial,
  LineSegments,
  type Material,
  Mesh,
  MeshStandardMaterial,
  OctahedronGeometry,
  PerspectiveCamera,
  PointLight,
  Points,
  PointsMaterial,
  type PolyhedronGeometry,
  Scene,
  TetrahedronGeometry,
  WebGLRenderer,
} from 'three';

/** Palette provisoire : bleu, vert, jaune (clin d'œil discret aux couleurs amazighes). */
const COULEURS = {
  fond: 0x0a0f1e,
  bleu: 0x4f8df5,
  vert: 0x3fb27f,
  jaune: 0xffd54a,
  blanc: 0xe9edf7,
  ardoise: 0x8aa4d6,
};

interface Solide {
  objet: Group;
  base: { x: number; y: number; z: number };
  rotation: { x: number; y: number };
  phase: number;
}

/**
 * Scène 3D de l'accueil : les cinq solides de Platon (« SOLIDE ») flottant lentement.
 * Sobre et légère : ~1 000 triangles, rendu suspendu hors écran ou onglet masqué,
 * image fixe si l'utilisateur préfère réduire les animations, repli CSS sans WebGL.
 */
export class SceneAccueil {
  private readonly canvas: HTMLCanvasElement;
  private readonly rendu: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(42, 1, 0.1, 100);
  private readonly groupe = new Group();
  private readonly enveloppe: LineSegments;
  private readonly solides: Solide[] = [];
  private readonly mouvementReduit: boolean;
  private readonly pointeur = { x: 0, y: 0 };
  private readonly regard = { x: 0, y: 0 };
  private idRaf = 0;
  private dernier = 0;
  private temps = 0;
  private dansLaVue = true;
  private images = 0;
  private readonly nettoyages: (() => void)[] = [];

  /** Renvoie null (et laisse le fond CSS) si WebGL n'est pas disponible. */
  static creer(canvas: HTMLCanvasElement): SceneAccueil | null {
    try {
      return new SceneAccueil(canvas);
    } catch (erreur) {
      console.warn('Scène 3D indisponible :', erreur);
      canvas.dataset.etat = 'indisponible';
      canvas.hidden = true;
      return null;
    }
  }

  private constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.mouvementReduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.rendu = new WebGLRenderer({ canvas, antialias: dpr < 2, alpha: true, powerPreference: 'default' });
    this.rendu.setPixelRatio(dpr);
    this.rendu.setClearColor(0x000000, 0);

    this.scene.fog = new FogExp2(COULEURS.fond, 0.055);
    this.camera.position.set(0, 0.4, 10);

    this.scene.add(new HemisphereLight(0xbfd4ff, 0x0a0f1e, 1.1));
    const soleil = new DirectionalLight(0xffffff, 2.2);
    soleil.position.set(5, 6, 5);
    this.scene.add(soleil);
    const chaude = new PointLight(COULEURS.jaune, 30, 18, 2);
    chaude.position.set(-3, -2, 4);
    this.scene.add(chaude);

    // Les cinq solides de Platon
    const ajouter = (geo: PolyhedronGeometry | BoxGeometry, couleur: number, x: number, y: number, z: number): void => {
      const objet = new Group();
      objet.add(
        new Mesh(
          geo,
          new MeshStandardMaterial({ color: couleur, flatShading: true, roughness: 0.42, metalness: 0.12 }),
        ),
      );
      objet.add(
        new LineSegments(
          new EdgesGeometry(geo),
          new LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.28 }),
        ),
      );
      objet.position.set(x, y, z);
      this.groupe.add(objet);
      this.solides.push({
        objet,
        base: { x, y, z },
        rotation: { x: 0.12 + Math.random() * 0.18, y: 0.18 + Math.random() * 0.22 },
        phase: Math.random() * Math.PI * 2,
      });
    };
    ajouter(new IcosahedronGeometry(1.35), COULEURS.bleu, 0, 0.1, 0);
    ajouter(new DodecahedronGeometry(0.82), COULEURS.vert, -2.1, -1.0, -1.1);
    ajouter(new OctahedronGeometry(0.78), COULEURS.jaune, 2.0, 1.25, -0.7);
    ajouter(new TetrahedronGeometry(0.72), COULEURS.blanc, 1.7, -1.45, 0.7);
    ajouter(new BoxGeometry(0.95, 0.95, 0.95), COULEURS.ardoise, -1.5, 1.55, -1.9);
    this.scene.add(this.groupe);

    // Grande enveloppe filaire et sol quadrillé : profondeur discrète
    this.enveloppe = new LineSegments(
      new EdgesGeometry(new IcosahedronGeometry(9, 1)),
      new LineBasicMaterial({ color: COULEURS.bleu, transparent: true, opacity: 0.07 }),
    );
    this.scene.add(this.enveloppe);
    const sol = new GridHelper(60, 60, COULEURS.bleu, COULEURS.bleu);
    const materiauSol = sol.material as Material;
    materiauSol.transparent = true;
    materiauSol.opacity = 0.09;
    sol.position.y = -3.2;
    this.scene.add(sol);

    // Poussière d'étoiles
    const positions: number[] = [];
    for (let i = 0; i < 420; i++) {
      const r = 12 + Math.random() * 14;
      const t = Math.random() * Math.PI * 2;
      const p = Math.acos(2 * Math.random() - 1);
      positions.push(r * Math.sin(p) * Math.cos(t), r * Math.cos(p) * 0.6 + 2, r * Math.sin(p) * Math.sin(t) - 6);
    }
    const geoEtoiles = new BufferGeometry();
    geoEtoiles.setAttribute('position', new Float32BufferAttribute(positions, 3));
    this.scene.add(
      new Points(
        geoEtoiles,
        new PointsMaterial({ color: new Color(0xa9bfff), size: 0.05, transparent: true, opacity: 0.7 }),
      ),
    );

    this.installerEcouteurs();
    this.redimensionner();
    canvas.dataset.etat = this.mouvementReduit ? 'statique' : 'actif';
    this.rendre();
    if (!this.mouvementReduit) this.reprendre();
  }

  private installerEcouteurs(): void {
    const observateur = new ResizeObserver(() => {
      this.redimensionner();
      if (!this.idRaf) this.rendre();
    });
    observateur.observe(this.canvas);
    const vue = new IntersectionObserver(([e]) => {
      this.dansLaVue = e.isIntersecting;
      this.majBoucle();
    });
    vue.observe(this.canvas);
    const visibilite = (): void => this.majBoucle();
    document.addEventListener('visibilitychange', visibilite);
    const pointeur = (e: PointerEvent): void => {
      this.pointeur.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.pointeur.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener('pointermove', pointeur, { passive: true });
    const perte = (e: Event): void => {
      e.preventDefault();
      this.suspendre();
    };
    const restauration = (): void => this.majBoucle();
    this.canvas.addEventListener('webglcontextlost', perte);
    this.canvas.addEventListener('webglcontextrestored', restauration);
    this.nettoyages.push(
      () => observateur.disconnect(),
      () => vue.disconnect(),
      () => document.removeEventListener('visibilitychange', visibilite),
      () => window.removeEventListener('pointermove', pointeur),
      () => this.canvas.removeEventListener('webglcontextlost', perte),
      () => this.canvas.removeEventListener('webglcontextrestored', restauration),
    );
  }

  private majBoucle(): void {
    if (this.mouvementReduit) return;
    if (this.dansLaVue && !document.hidden) this.reprendre();
    else this.suspendre();
  }

  private reprendre(): void {
    if (this.idRaf) return;
    this.dernier = performance.now();
    this.idRaf = requestAnimationFrame(this.boucle);
    this.canvas.dataset.etat = 'actif';
  }

  private suspendre(): void {
    cancelAnimationFrame(this.idRaf);
    this.idRaf = 0;
    if (this.canvas.dataset.etat === 'actif') this.canvas.dataset.etat = 'pause';
  }

  private readonly boucle = (maintenant: number): void => {
    this.idRaf = requestAnimationFrame(this.boucle);
    const dt = Math.min((maintenant - this.dernier) / 1000, 0.1);
    this.dernier = maintenant;
    this.temps += dt;
    for (const s of this.solides) {
      s.objet.rotation.x += s.rotation.x * dt;
      s.objet.rotation.y += s.rotation.y * dt;
      s.objet.position.y = s.base.y + Math.sin(this.temps * 0.7 + s.phase) * 0.14;
    }
    this.groupe.rotation.y = Math.sin(this.temps * 0.12) * 0.25;
    this.enveloppe.rotation.y += dt * 0.02;
    // Parallaxe douce selon le pointeur
    this.regard.x += (this.pointeur.x - this.regard.x) * Math.min(1, dt * 2.5);
    this.regard.y += (this.pointeur.y - this.regard.y) * Math.min(1, dt * 2.5);
    this.camera.position.x = this.regard.x * 0.7;
    this.camera.position.y = 0.4 - this.regard.y * 0.45;
    this.camera.lookAt(this.groupe.position.x * 0.35, 0, 0);
    this.rendre();
  };

  /** Composition adaptée au format : solides à droite du texte (large) ou au-dessus (étroit). */
  private redimensionner(): void {
    const largeur = this.canvas.clientWidth || 1;
    const hauteur = this.canvas.clientHeight || 1;
    this.rendu.setSize(largeur, hauteur, false);
    const format = largeur / hauteur;
    this.camera.aspect = format;
    this.camera.updateProjectionMatrix();
    if (format > 1.15) {
      this.groupe.position.set(Math.min(3.6, 1.5 + format * 1.1), 0, 0);
      this.groupe.scale.setScalar(1);
    } else {
      // format portrait : les solides au-dessus du titre
      this.groupe.position.set(0, 2.75, -2.5);
      this.groupe.scale.setScalar(0.62);
    }
    if (this.mouvementReduit) this.camera.lookAt(this.groupe.position.x * 0.35, 0, 0);
  }

  private rendre(): void {
    this.rendu.render(this.scene, this.camera);
    this.images++;
    if (this.images % 30 === 1) this.canvas.dataset.images = String(this.images);
  }

  detruire(): void {
    this.suspendre();
    for (const n of this.nettoyages) n();
    this.scene.traverse((o) => {
      const objet = o as Partial<Mesh>;
      objet.geometry?.dispose();
      const m = objet.material;
      if (Array.isArray(m)) m.forEach((x) => x.dispose());
      else m?.dispose();
    });
    this.rendu.dispose();
  }
}
