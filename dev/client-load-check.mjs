// Client-half smoke test: evaluate the built browser bundle the way
// dsh client-modules does (window.__ModuleLoader__.load + factory(require)),
// then run apply() against a stub slots service and check the injected CSS.
//
//   node dev/client-load-check.mjs      (run pnpm build first)
import fs from 'node:fs'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

// ---- 浏览器环境最小替身 ----
const injected = []
const fakeDocument = {
  createElement(tag) {
    const node = { tagName: tag, dataset: {}, textContent: '' }
    return node
  },
  head: {
    appendChild(node) { injected.push(node) },
  },
}
globalThis.window = {
  __ModuleLoader__: {
    load(definition) { globalThis.__loaded = definition },
  },
}

const code = fs.readFileSync('lib/client.js', 'utf8')
const previousDocument = globalThis.document
globalThis.document = fakeDocument
// eslint-disable-next-line no-new-func -- 就是要把构建产物当脚本跑
new Function('require', code)(require)

const definition = globalThis.__loaded
assert.ok(definition, 'bundle must call window.__ModuleLoader__.load')
assert.equal(definition.id, 'dsh-agent-pyq')

const mod = definition.factory(require)
assert.deepEqual(mod.inject, ['slots'], 'client half injects slots')

// ---- apply() 打桩：必须注册一个组件 + 注入一份样式 ----
const slots = []
const ctx = {
  slots: {
    inject(name, register) { assert.equal(name, 'conversation.session.header.actions'); register() },
    register(options, component) { slots.push({ options, component }) },
  },
}
mod.apply(ctx)
globalThis.document = previousDocument

assert.equal(slots.length, 1, 'exactly one header action registered')
const [entry] = slots
assert.equal(entry.options.id, 'moments-plugin')
assert.equal(typeof entry.component, 'function', 'component must be a function component')
console.log('OK   bundle loads, apply() registers', entry.options.id)

// ---- 样式注入 ----
assert.equal(injected.length, 1, 'exactly one <style> injected')
const [style] = injected
assert.equal(style.tagName, 'style')
assert.equal(style.dataset.plugin, 'dsh-agent-pyq')
assert.ok(style.textContent.includes('.dtpl-moments-panel'), 'moments styles present')
console.log('OK   injectStyles() wrote', style.textContent.length, 'chars of CSS')

// ---- 一致性：TSX 里用到的 class 必须在注入的 CSS 里有定义 ----
const cssClasses = new Set([...style.textContent.matchAll(/\.(dtpl-moments-[a-z0-9-]+)/g)].map((m) => m[1]))
const usedClasses = new Set([...code.matchAll(/"(dtpl-moments-[a-z0-9-]+(?:\s+dtpl-moments-[a-z0-9-]+)*)"/g)]
  .flatMap((m) => m[1].split(/\s+/)))
const missing = [...usedClasses].filter((c) => !cssClasses.has(c))
assert.deepEqual(missing, [], `classes used without CSS: ${missing.join(', ')}`)
const unused = [...cssClasses].filter((c) => !usedClasses.has(c))
console.log('OK   ', usedClasses.size, 'moments classes used, all defined in CSS')
if (unused.length > 0) console.log('note: CSS classes not referenced from the bundle:', unused.join(', '))
