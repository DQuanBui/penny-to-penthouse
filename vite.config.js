import { defineConfig } from 'vite';
import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// Optional-asset hook: lists whatever the user dropped into public/models/* and
// public/audio so the game can load those files without ever requesting a
// missing URL (no 404 noise in the console). Served live in dev and emitted
// as asset-manifest.json at build time.
function assetManifest() {
  const scan = () => {
    const list = (dir, exts) => {
      const abs = join(process.cwd(), 'public', dir);
      if (!existsSync(abs)) return [];
      return readdirSync(abs).filter((f) => exts.some((e) => f.toLowerCase().endsWith(e))).sort();
    };
    const models = ['.glb', '.gltf'];
    return {
      characters: list('models/characters', models),
      animations: list('models/characters/animations', models),
      vehicles: list('models/vehicles', models),
      furniture: list('models/furniture', models),
      audio: list('audio', ['.mp3', '.ogg', '.wav', '.m4a']),
    };
  };
  return {
    name: 'p2p-asset-manifest',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url || !req.url.split('?')[0].endsWith('/asset-manifest.json')) return next();
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(scan()));
      });
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'asset-manifest.json', source: JSON.stringify(scan()) });
    },
  };
}

// base './' keeps every asset URL relative, so the build works on
// GitHub Pages under any repository name.
export default defineConfig({
  base: './',
  plugins: [assetManifest()],
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1500,
  },
  server: { port: 5173 },
});
