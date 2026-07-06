import { build } from 'esbuild';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '../..');

await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  outfile: 'dist/index.js',
  sourcemap: true,
  external: [
    // Node built-ins
    'crypto', 'fs', 'path', 'os', 'stream', 'http', 'https', 'net', 'tls',
    'url', 'util', 'events', 'buffer', 'querystring', 'zlib', 'child_process',
    // Keep heavy native deps external for faster startup
    'ioredis', 'bull',
    // pino-pretty's transport spawns a worker thread by file path — that path
    // doesn't survive being flattened into a single bundle, so both must stay
    // external regardless of which log transport is active at runtime.
    'pino', 'pino-pretty',
  ],
  plugins: [
    {
      name: 'workspace-packages',
      setup(build) {
        // Resolve @vpay/* workspace packages to their TS source
        build.onResolve({ filter: /^@vpay\// }, (args) => {
          const pkg = args.path.replace('@vpay/', '');
          return { path: resolve(root, `packages/${pkg}/src/index.ts`) };
        });
      },
    },
  ],
});

console.log('API build complete → dist/index.js');
