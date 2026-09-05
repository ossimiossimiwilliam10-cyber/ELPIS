import { defineConfig, createLogger } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath } from 'url'
import path from 'path'

const ici = path.dirname(fileURLToPath(import.meta.url))

/*
 * La frontière entre le moteur et le navigateur, tenue par une garde.
 *
 * Le moteur est écrit pour Node ; embarqué dans l'application, il tourne dans
 * une WebView. Quand un de ses modules réclame `fs`, `path` ou `crypto`, Vite
 * ne s'arrête pas : il remplace le module par un objet VIDE et se contente d'un
 * avertissement dans le journal de compilation. Le paquet part donc cassé, sans
 * un mot, et la panne n'apparaît qu'à l'exécution sur le téléphone — sous la
 * forme la plus trompeuse qui soit : le rapport du jour lève, l'écran d'accueil
 * affiche « Configure tes cours pour activer le Planificateur », et l'étudiant
 * qui a saisi dix-neuf matières lit qu'il n'a rien saisi.
 *
 * Les croisements ci-dessous sont connus et vérifiés inoffensifs : ils vivent
 * dans des branches que le téléphone n'atteint pas (écriture SQLite) ou sont
 * chargés à la demande derrière un `try`. Tout autre croisement fait désormais
 * échouer la compilation — c'est le seul moment où il est encore bon marché de
 * s'en apercevoir.
 *
 * Pour en ajouter un : s'assurer d'abord que le chemin est réellement mort sur
 * l'appareil, puis inscrire le module ici avec la raison.
 */
const CROISEMENTS_CONNUS = [
  // `crypto.randomUUID()` n'est appelé que par les écritures SQLite, que le
  // téléphone ne prend jamais : il passe par la source de `moteur/stockage.js`.
  'moteur/cours.js:crypto',
  'moteur/historique.js:crypto',
  'moteur/projets.js:crypto',
  // Chargés à la demande, derrière un `try`, et absents sur l'appareil : l'état
  // du moteur de renforcement vit dans un fichier du PC.
  'moteur/rlEngine.js:fs',
  'moteur/rlEngine.js:path',
  // Même procédé : sur le téléphone, le texte du règlement est fourni par
  // `definirTexteReglement` avant toute lecture, et le disque n'est jamais
  // touché. Un règlement introuvable reste une absence déclarée.
  'moteur/repetiteur/reglement.js:fs',
  'moteur/repetiteur/reglement.js:path',
]

const franchissements = new Set()

const MOTIF_EXTERNALISE = /Module "([^"]+)" has been externalized[\s\S]*?imported by "([^"]+)"/

/**
 * Le message d'origine passe par le journal de Vite, pas par `onwarn` de
 * Rollup : une première version de cette garde branchée sur `onwarn` n'a jamais
 * été appelée, et laissait donc passer exactement ce qu'elle prétendait
 * arrêter. Vérifié en introduisant un `require('fs')` dans `moteur/utils.js` :
 * la compilation réussissait.
 */
const journal = createLogger()
const avertirOrigine = journal.warn.bind(journal)
journal.warn = (message, options) => {
  const trouve = MOTIF_EXTERNALISE.exec(String(message))
  if (trouve) {
    const [, builtin, fichier] = trouve
    const chemin = String(fichier).replace(/\\/g, '/')
    const court = chemin.includes('moteur/') ? chemin.slice(chemin.indexOf('moteur/')) : chemin
    const cle = `${court}:${builtin}`
    if (!CROISEMENTS_CONNUS.includes(cle)) franchissements.add(cle)
    return
  }
  avertirOrigine(message, options)
}

/** Fait échouer la compilation si un croisement inconnu a été rencontré. */
function greffonFrontiere() {
  return {
    name: 'elpis-frontiere-moteur',
    closeBundle() {
      if (franchissements.size === 0) return
      const liste = [...franchissements].map(f => `  • ${f}`).join('\n')
      throw new Error(
        `Frontière moteur/navigateur franchie :\n${liste}\n\n` +
        `Vite remplace ces modules par un objet vide : le paquet serait parti cassé, en silence, ` +
        `et le téléphone aurait affiché « configure tes cours » à un étudiant qui a tout saisi.\n` +
        `Charge le module à la demande (voir moteur/rlEngine.js), ou inscris-le dans ` +
        `CROISEMENTS_CONNUS après avoir vérifié que l'appareil ne l'atteint jamais.`
      )
    },
  }
}


export default defineConfig({
  /*
   * Le moteur est embarqué dans l'application, et il vient tel quel du dossier
   * `interface/bridge/moteur` : un seul moteur pour les deux appareils, jamais
   * une copie. Ses modules importent `db/setup` en tête de fichier, ce qui
   * ferait entrer `better-sqlite3` — un module natif C++ — dans le bundle du
   * navigateur, où il n'a rien à faire et où la compilation échouerait.
   *
   * On l'aiguille donc vers un substitut qui a la bonne forme mais refuse tout
   * usage. Sur le téléphone, la lecture passe par la source déclarée dans
   * `moteur/stockage.js` ; si un chemin lui échappait, l'erreur serait immédiate
   * et nommée, au lieu d'un chiffre venu de nulle part.
   */
  resolve: {
    alias: [
      {
        find: /^\.\.\/db\/setup$/,
        replacement: path.resolve(ici, 'src/moteur/sqliteAbsent.js'),
      },
    ],
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
      '/documents': 'http://localhost:3001',
      '/music': 'http://localhost:3001'
    }
  },
  customLogger: journal,
  plugins: [
    greffonFrontiere(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'favicon.ico', 'robots.txt', 'apple-touch-icon.png'],
      manifest: {
        name: 'ELPIS - Assistant d\'Étude',
        short_name: 'ELPIS',
        description: 'Compagnon IA pour la réussite universitaire',
        theme_color: '#0C1A30',
        background_color: '#0C1A30',
        display: 'standalone',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,ico,png,svg}'],
        navigateFallbackDenylist: [/^\/api\//, /^\/documents\//, /^\/music\//],
        runtimeCaching: [
          {
            // Règle imposée par le système : Network-First pour les pages HTML (SPA)
            urlPattern: ({ request, url }) => request.mode === 'navigate' || url.pathname === '/' || url.pathname.match(/index\.html$/),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'html-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 7 // 1 semaine
              }
            }
          },
          {
            urlPattern: /^https:\/\/elpis-app\.onrender\.com\/api\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 7 // 1 week
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.js',
    /*
     * Les 5 s par défaut suffisent à un test isolé, pas à 85 fichiers montés en
     * parallèle : plusieurs pages de cette application montent un cursus entier
     * dans jsdom. Des tests passaient seuls et échouaient dans la suite, sur un
     * fichier différent à chaque exécution selon la charge de la machine —
     * la pire espèce d'échec, celle qui apprend à ignorer le rouge.
     *
     * Relevé de 20 à 40 s : la suite de fumée monte vingt et une pages, dont
     * deux qui embarquent three.js et recharts. Seule, elle met déjà 90 s ; en
     * parallèle des 85 autres fichiers et sur une machine occupée, quatre de ces
     * montages dépassaient les 20 s. Le code n'était pas en cause — le fichier
     * passe intégralement en isolation.
     */
    testTimeout: 40000,
    // Les répertoires de sortie contiennent des copies compilées du code source.
    // Des fichiers de tests y avaient été générés : Vitest chargeait alors des
    // bundles minifiés, ce qui faisait échouer — et traîner — toute la suite.
    exclude: [
      'tests/**',
      'node_modules/**',
      'dist/**',
      'android/**',
      'coverage/**',
      '**/assets/public/**'
    ]
  }
})
