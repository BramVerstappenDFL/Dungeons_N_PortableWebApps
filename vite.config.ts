/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages serves the app from /<repo>/. Override with BASE_PATH=/ for other hosts.
const base = process.env.BASE_PATH ?? '/Dungeons_N_PortableWebApps/';

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icons/favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'D&D Assist',
        short_name: 'D&D Assist',
        description: 'Character sheet, dice, combat, rests, inventory, spells and notes for D&D 5e (2024).',
        theme_color: '#f8f0da',
        background_color: '#ece0c4',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,json,woff2}'],
        navigateFallback: 'index.html',
      },
    }),
  ],
  test: { include: ['tests/**/*.test.ts'] },
});
