// Bundles src/serverless.ts (the Vercel entry) into a single flat CJS file.
//
// Why this exists: Vercel's @vercel/node builder traces and copies files
// rather than bundling them, so it can't resolve the @vpay/* workspace
// packages — their package.json "exports" point straight at raw .ts source
// (no compiled dist/), which Node's runtime module resolver can't load,
// crashing the function at cold start with ERR_MODULE_NOT_FOUND. esbuild
// (with the same workspace-packages resolver plugin used by build.mjs)
// inlines those imports into one file, leaving only real npm packages for
// Vercel to trace. The output is committed (see vercel-build/ in git) since
// vercel.json's legacy `builds` key skips the Project's Build Command.
import { build } from 'esbuild';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '../..');

await build({
  entryPoints: ['src/serverless.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  outfile: 'vercel-build/serverless.js',
  sourcemap: false,
  external: [
    // Node built-ins
    'crypto', 'fs', 'path', 'os', 'stream', 'http', 'https', 'net', 'tls',
    'url', 'util', 'events', 'buffer', 'querystring', 'zlib', 'child_process',
    // Keep heavy native deps external for faster cold starts
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

console.log('Vercel serverless bundle complete → vercel-build/serverless.js');
