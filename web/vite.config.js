import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { FAQ } from './src/lib/faq.js';
import { FACTS } from './src/lib/facts.js';

// FAQ and tool description as structured data, so search engines and AI assistants
// can quote the same answers the page shows.
const jsonLd = [
  {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
  },
  {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Verificare de compatibilitate pentru celula de paletizare UR20',
    url: FACTS.site.url,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    inLanguage: 'ro',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
    provider: { '@type': 'Organization', name: 'Tech-Con Industry', url: 'https://tech-con.ro' },
  },
];

const structuredData = {
  name: 'structured-data',
  transformIndexHtml(html, ctx) {
    if (ctx?.path?.includes('admin')) return html; // the owners' page stays unlisted
    const tags = jsonLd.map((d) => `<script type="application/ld+json">${JSON.stringify(d)}</script>`).join('\n    ');
    return html.replace('</head>', `    ${tags}\n  </head>`).replaceAll('%SITE_URL%', FACTS.site.url);
  },
};

// Relative base so the build works from any sub-path (GitHub Pages serves under /<repo>/).
export default defineConfig({
  base: './',
  plugins: [
    react(),
    structuredData,
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png', 'llms.txt', 'og.jpg'],
      manifest: {
        name: 'Verificare UR20 · Tech-Con',
        short_name: 'Verificare UR20',
        description: 'Verifică în două minute dacă o celulă de paletizare UR20 se potrivește liniei tale.',
        lang: 'ro',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#EAF1F9',
        theme_color: '#1226AA',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,jpg,svg,woff2,txt}'],
        navigateFallbackDenylist: [/\/admin\//], // the owners' page is its own document
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
    }),
  ],
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        admin: fileURLToPath(new URL('./admin/index.html', import.meta.url)),
      },
    },
  },
  server: { host: true, port: 5173, strictPort: true },
});
