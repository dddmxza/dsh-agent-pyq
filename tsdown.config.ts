import { defineConfig } from 'tsdown'

// tsdown only does transpile and bundle; typecheck is handled by `pnpm typecheck`.
// fixedExtension: false —— the package declares "type": "module", keeping .js/.d.ts
// extensions to match package.json exports.

/** Host half: Node library, output lib/, loaded by cordis plugin rows by package name. */
const lib = {
  entry: ['src/index.ts', 'src/service.ts', 'src/hook.ts'],
  outDir: 'lib',
  format: ['esm'],
  platform: 'node',
  target: 'es2022',
  dts: true,
  clean: true,
  fixedExtension: false,
}

// Client half: browser bundle distributed by dsh client-modules.
// 这两项都来自宿主 __ModuleLoader__ 的共享模块表（见 dsh-web-frontend 里
// 定义共享模块对象的那个函数）；打进包里会复制一份 React，所以必须 external。
const CLIENT_EXTERNALS = ['react', 'react/jsx-runtime']

/** Client half: browser config card bundle, output lib/client.js. */
const client = {
  name: 'dsh-agent-pyq/client',
  entry: { client: 'src/client/index.ts' },
  outDir: 'lib',
  format: 'cjs',
  platform: 'browser',
  dts: false,
  clean: false,
  sourcemap: true,
  external: CLIENT_EXTERNALS,
  noExternal: (id) => (CLIENT_EXTERNALS.includes(id) ? undefined : true),
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
  },
  outputOptions: {
    entryFileNames: 'client.js',
    banner: 'window.__ModuleLoader__.load({ id: "dsh-agent-pyq", factory: (require) => {',
    footer: 'return module.exports; } });',
    intro: 'var module = { exports: {} }; var exports = module.exports;',
  },
}

export default defineConfig([lib, client])