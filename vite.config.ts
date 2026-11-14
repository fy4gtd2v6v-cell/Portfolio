import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// The build is a single self-contained index.html, so it also works
// when opened directly from disk (file://) on the Mac.
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  base: './',
  test: { environment: 'node' },
});
