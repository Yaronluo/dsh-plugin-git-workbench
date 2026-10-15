import { build } from 'esbuild'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = fileURLToPath(new URL('../', import.meta.url))
const libDir = resolve(rootDir, 'lib')

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
  id: "dsh-plugin-git",
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
