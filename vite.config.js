import { defineConfig } from 'vite';
export default defineConfig({base: './', build: {chunkSizeWarningLimit: 750,rollupOptions:{input:{main:'index.html',vfx:'vfx-lab.html'}}}});
