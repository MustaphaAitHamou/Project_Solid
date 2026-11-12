/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

/** Pages du site (application multi-pages : chaque route est un vrai fichier HTML). */
const PAGES = {
  accueil: 'index.html',
  'mario-ahmed-aberkan': 'jeux/mario-ahmed-aberkan/index.html',
  introuvable: '404.html',
};

/**
 * En développement et en prévisualisation, sert /jeux/mario-ahmed-aberkan (sans barre oblique
 * finale) comme sur Vercel, où la configuration vercel.json fait de même.
 */
function routesSansBarreFinale(): Plugin {
  const reecrire = (req: { url?: string }, _res: unknown, next: () => void): void => {
    if (req.url) {
      const [chemin, requete] = req.url.split('?');
      if (chemin === '/jeux/mario-ahmed-aberkan') {
        req.url = '/jeux/mario-ahmed-aberkan/' + (requete ? `?${requete}` : '');
      }
    }
    next();
  };
  return {
    name: 'kabyle-solide:routes-sans-barre-finale',
    configureServer(server) {
      server.middlewares.use(reecrire);
    },
    configurePreviewServer(server) {
      server.middlewares.use(reecrire);
    },
  };
}

/**
 * Fragments HTML partagés : `<!-- @inclure entete -->` est remplacé par src/site/fragments/entete.html.
 * Le lien de navigation de la page courante reçoit aria-current="page".
 */
function fragmentsHtml(): Plugin {
  return {
    name: 'kabyle-solide:fragments-html',
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        const page = ctx.path.replace(/index\.html$/, '').replace(/\/$/, '') || '/';
        return html.replace(/<!--\s*@inclure\s+([\w-]+)\s*-->/g, (_, nom: string) => {
          const fragment = readFileSync(resolve(import.meta.dirname, 'src/site/fragments', `${nom}.html`), 'utf8');
          return fragment.replace(/<a ([^>]*)data-route="([^"]+)"/g, (_lien, attributs: string, route: string) =>
            route === page || (route !== '/' && page.startsWith(route))
              ? `<a ${attributs}aria-current="page"`
              : `<a ${attributs}`,
          );
        });
      },
    },
  };
}

export default defineConfig({
  appType: 'mpa',
  plugins: [fragmentsHtml(), routesSansBarreFinale()],
  build: {
    target: 'es2022',
    // Three.js (≈550 ko minifié) est chargé en différé, uniquement sur l'accueil
    chunkSizeWarningLimit: 600,
    rolldownOptions: {
      input: Object.fromEntries(
        Object.entries(PAGES).map(([nom, fichier]) => [nom, resolve(import.meta.dirname, fichier)]),
      ),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    testTimeout: 120_000,
  },
});
