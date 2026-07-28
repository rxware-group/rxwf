import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import type { Server as ProxyServer } from 'http-proxy';

const repoRoot = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));

const apiTarget = process.env.RXWF_API_PROXY_TARGET ?? 'http://127.0.0.1:8787';

function apiProxy() {
  return {
    target: apiTarget,
    changeOrigin: true,
    configure(proxy: ProxyServer) {
      proxy.on('error', (_err, _req, res) => {
        if (res && typeof res.writeHead === 'function' && !res.headersSent) {
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'API not ready' }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'isolated-vm': path.resolve(repoRoot, 'apps/web/src/stubs/isolated-vm.ts'),
      piscina: path.resolve(repoRoot, 'apps/web/src/stubs/empty-node-module.ts'),
    },
  },
  optimizeDeps: {
    exclude: ['isolated-vm', '@rxwf/expression', 'piscina'],
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    allowedHosts: ['host.docker.internal'],
    fs: {
      allow: [repoRoot],
    },
    proxy: {
      '/api': apiProxy(),
      '/webhook': apiProxy(),
    },
  },
});
