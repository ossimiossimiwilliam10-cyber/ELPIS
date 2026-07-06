import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
      '/documents': 'http://localhost:3001',
      '/music': 'http://localhost:3001'
    }
  },
  plugins: [
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
    exclude: ['tests/**', 'node_modules/**']
  }
})
