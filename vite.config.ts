import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  base: '/svg-mkr/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/*.png'],
      manifest: {
        name: 'SVG_MKR — Image to SVG Converter',
        short_name: 'SVG_MKR',
        description: 'Convert raster images to clean SVGs with color separation, halftone, and background removal.',
        start_url: '/svg-mkr/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#000000',
        icons: [
          {
            src: '/svg-mkr/icons/pwa-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/svg-mkr/icons/pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/svg-mkr/icons/pwa-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'CacheFirst',
            options: {
              cacheName: 'images',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  ],
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  build: {
    assetsInlineSize: 0,
  },
});
