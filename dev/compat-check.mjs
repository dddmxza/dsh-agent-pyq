// 版本兼容闸门自检：复刻 dsh-app-boot 的 evaluatePluginCompatibility
//   （resources/app/node_modules/@deepseek-ai/dsh-app-boot/lib/index.js 的 evaluatePluginCompatibility）
//
// 规则：只检查名字是 `@deepseek-ai/dsh` 或 `@deepseek-ai/dsh-` 前缀的 peerDependencies；
// `semver.satisfies(运行时版本, 范围, { includePrerelease: true })` 有一条不满足，
// **整个 bundle 会在加载前被跳过**（工具不会注册，界面不会出现，日志里只有一行 skipping）。
//
// 用法：
//   node dev/compat-check.mjs                 # 运行时版本取自 profile 共享层的 @deepseek-ai/dsh
//   node dev/compat-check.mjs 0.2.0-rc.1      # 手工指定运行时版本
//   DSH_HOME=D:/other/.dsh node dev/compat-check.mjs
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const pkg = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'))
const dshHome = process.env.DSH_HOME ?? path.join(homedir(), '.dsh')

/** 运行时版本：命令行参数优先，否则读 profile 共享层里 @deepseek-ai/dsh 的版本。 */
function resolveRuntimeVersion() {
  const explicit = process.argv[2]
  if (explicit) return explicit
  const candidates = [
    path.join(dshHome, 'profiles', 'node_modules', '@deepseek-ai', 'dsh', 'package.json'),
    path.join(dshHome, 'node_modules', '@deepseek-ai', 'dsh', 'package.json'),
  ]
  for (const file of candidates) {
    try {
      return JSON.parse(readFileSync(file, 'utf8')).version
    } catch {
      /* 继续找下一个 */
    }
  }
  return null
}

const runtime = resolveRuntimeVersion()
if (!runtime) {
  console.error(`✗ 拿不到运行时版本；请显式传入，例如：node dev/compat-check.mjs 0.2.0-rc.1`)
  process.exit(2)
}

const require = createRequire(path.join(dshHome, 'profiles', 'desktop', 'package.json'))
let semver
try {
  semver = require('semver')
} catch {
  semver = null
}
if (!semver) {
  console.error('✗ 找不到 semver（期望在 profile 的 node_modules 里）；无法自检')
  process.exit(2)
}

// 与宿主同一条筛选规则
const isDshPeer = (name) => name === '@deepseek-ai/dsh' || name.startsWith('@deepseek-ai/dsh-')
const peers = Object.entries(pkg.peerDependencies ?? {}).filter(([name]) => isDshPeer(name))

console.log(`${pkg.name}@${pkg.version}  vs  dsh ${runtime}`)
if (peers.length === 0) {
  console.log('（没有 dsh* peer，闸门不会拦它）')
  process.exit(0)
}

const bad = []
for (const [name, range] of peers) {
  const ok = semver.satisfies(runtime, range, { includePrerelease: true })
  console.log(`${ok ? 'PASS   ' : 'BLOCKED'}  ${name.padEnd(38)} ${range}`)
  if (!ok) bad.push(name)
}

if (bad.length > 0) {
  console.error(`\n✗ 会被跳过：${bad.length} 条 peer 不满足 dsh ${runtime}`)
  console.error(`  它会打印：dsh: skipping profile bundle "${pkg.name}": Error: Plugin ${pkg.name}@${pkg.version} is incompatible with dsh ${runtime}: peerDependencies {...}`)
  process.exit(1)
}
console.log('\n✓ 全部满足：bundle 会正常加载')
