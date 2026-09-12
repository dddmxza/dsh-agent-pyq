// Scratch load-check: import the built plugin halves with their bare
// `@deepseek-ai/*` specifiers rewritten to the profile-level host copies
// ($DSH_HOME/profiles/node_modules), which is the layer the cordis loader
// resolves them against at runtime. Any missing named export fails here
// exactly the way the loader reported it.
//
//   node dev/load-check.mjs        (run `pnpm build` first)
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { pathToFileURL } from 'node:url'

const DSH_HOME = process.env.DSH_HOME ?? path.join(os.homedir(), '.dsh')
const HOST = path.join(DSH_HOME, 'profiles', 'node_modules', '@deepseek-ai')

const MAP = {
  '@deepseek-ai/dsh-llm': `${HOST}/dsh-llm`,
  '@deepseek-ai/dsh-tools': `${HOST}/dsh-tools`,
  '@deepseek-ai/cordis': `${HOST}/cordis`,
  '@deepseek-ai/schemastery': `${HOST}/schemastery`,
  '@deepseek-ai/dsh-agent-default-model': `${HOST}/dsh-agent-default-model`,
  '@deepseek-ai/dsh-settings': `${HOST}/dsh-settings`,
}

/** Resolve a host package directory to its ESM entry file. */
function entryOf(dir) {
  const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'))
  const rel = pkg.module ?? pkg.main ?? 'lib/index.js'
  return `${dir}/${rel}`
}

for (const [bare, dir] of Object.entries(MAP)) MAP[bare] = entryOf(dir)

const out = fs.mkdtempSync(path.join(os.tmpdir(), 'pyq-load-'))
const entries = ['lib/index.js', 'lib/service.js', 'lib/hook.js']

for (const entry of entries) {
  let code = fs.readFileSync(entry, 'utf8')
  for (const [bare, target] of Object.entries(MAP)) {
    code = code.replaceAll(`"${bare}"`, JSON.stringify(pathToFileURL(target).href))
    code = code.replaceAll(`'${bare}'`, JSON.stringify(pathToFileURL(target).href))
  }
  const dest = path.join(out, path.basename(entry))
  fs.writeFileSync(dest, code)
  try {
    const mod = await import(pathToFileURL(dest).href)
    console.log('OK  ', entry, '->', Object.keys(mod).join(', '))
  } catch (error) {
    console.log('FAIL', entry, '->', error.message)
    process.exitCode = 1
  }
}

fs.rmSync(out, { recursive: true, force: true })
