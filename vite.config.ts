import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

/** The only hosts the app may talk to: the three price services. */
const API_HOSTS = ['https://api.coingecko.com', 'https://www.alphavantage.co', 'https://api.frankfurter.dev'];

/**
 * Adds a strict Content-Security-Policy to the built page: only the inlined
 * app script and stylesheet (pinned by hash) may run, and network requests are
 * limited to the price services. Injected code could neither load nor send data elsewhere.
 */
function contentSecurityPolicy(): Plugin {
  const hashes = (html: string, re: RegExp) =>
    [...html.matchAll(re)].map((m) => `'sha256-${createHash('sha256').update(m[1]).digest('base64')}'`);
  let outDir = 'dist';
  return {
    name: 'content-security-policy',
    apply: 'build',
    enforce: 'post',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    // Runs on the finished file, after everything has been inlined into it.
    closeBundle() {
      const file = resolve(outDir, 'index.html');
      const html = readFileSync(file, 'utf8');
      const scripts = hashes(html, /<script[^>]*>([\s\S]*?)<\/script>/g);
      const styles = hashes(html, /<style[^>]*>([\s\S]*?)<\/style>/g);
      if (/<script[^>]*\ssrc=/.test(html) || /<link[^>]*rel="stylesheet"/.test(html)) {
        throw new Error('CSP: the build still references external scripts or stylesheets');
      }
      if (scripts.length === 0 || styles.length === 0 || !html.includes('<head>')) {
        throw new Error('CSP: expected inlined script and style in dist/index.html');
      }
      const csp = [
        "default-src 'none'",
        `script-src ${scripts.join(' ')}`,
        `style-src ${styles.join(' ')}`,
        "style-src-attr 'unsafe-inline'", // React sets bar widths and colors via style attributes
        'img-src data:',
        `connect-src ${API_HOSTS.join(' ')}`,
        "base-uri 'none'",
        "form-action 'none'",
      ].join('; ');
      writeFileSync(file, html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${csp}" />`));
    },
  };
}

// The build is a single self-contained index.html, so it also works
// when opened directly from disk (file://) on the Mac.
export default defineConfig({
  plugins: [react(), viteSingleFile(), contentSecurityPolicy()],
  base: './',
  test: { environment: 'node' },
});
