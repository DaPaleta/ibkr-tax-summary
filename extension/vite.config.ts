import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import { resolve } from 'node:path';
import manifest from './manifest.json' with { type: 'json' };

export default defineConfig({
  plugins: [crx({ manifest })],
  build: {
    target: 'es2022',
    rollupOptions: {
      // The classic-script content-script (`content.ts`) dynamically imports
      // `content-main.js` via chrome.runtime.getURL. To make that path stable
      // we add `content-main` as an explicit rollup input and disable hashing
      // for that one chunk.
      input: {
        'content-main': resolve(__dirname, 'src/content/content-main.ts'),
      },
      output: {
        entryFileNames: (chunk) =>
          chunk.name === 'content-main' ? 'content-main.js' : 'assets/[name]-[hash].js',
      },
    },
  },
  server: {
    port: 5174,
    strictPort: true,
    hmr: { port: 5174 },
  },
});
