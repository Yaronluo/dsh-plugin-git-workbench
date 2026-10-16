import { build } from 'esbuild'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = fileURLToPath(new URL('../', import.meta.url))
const libDir = resolve(rootDir, 'lib')
// The client Loader resolves modules by package name, not by our UI IDs.
const { name: packageName } = JSON.parse(readFileSync(resolve(rootDir, 'package.json'), 'utf8'))
if (typeof packageName !== 'string' || !packageName) throw new Error('package.json must declare a package name')

mkdirSync(libDir, { recursive: true })

console.log('[build] Compiling Host bundle (lib/index.js)...')
await build({
  entryPoints: [resolve(rootDir, 'src/index.ts')],
  outfile: resolve(libDir, 'index.js'),
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node20',
  external: [
    'node:*',
    '@deepseek-ai/*',
    'cordis',
  ],
  sourcemap: true,
})

console.log('[build] Compiling Client bundle (lib/client.js)...')
await build({
  entryPoints: [resolve(rootDir, 'src/client/index.tsx')],
  outfile: resolve(libDir, 'client.js'),
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  jsx: 'transform',
  loader: {
    '.ts': 'ts',
    '.tsx': 'tsx',
  },
  external: [
    'react',
    'react-dom',
    'react/jsx-runtime',
    '@deepseek-ai/*',
  ],
  banner: {
    js: `window.__ModuleLoader__.load({
  id: ${JSON.stringify(packageName)},
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
`,
  },
  footer: {
    js: `
    return module.exports;
  }
});`,
  },
  sourcemap: true,
})

// Generate index.d.ts
writeFileSync(
  resolve(libDir, 'index.d.ts'),
  `export declare const inject: string[];
export declare function apply(ctx: any): void;
`
)

console.log('[build] Build completed successfully!')
