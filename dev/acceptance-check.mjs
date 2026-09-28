// 规格 §7 的「工具级」验收自检：不起 GUI、不挂载 DSH，直接给构建产物喂一个
// 桩 ctx，再把 23 条验收里不依赖界面的那些逐条跑一遍。
//
//   $d = Join-Path $env:TEMP 'pyq-acceptance'
//   Remove-Item -Recurse -Force $d -ErrorAction SilentlyContinue
//   New-Item -ItemType Directory -Force $d | Out-Null
//   $env:TEMP = $d; $env:TMP = $d
//   node dev/acceptance-check.mjs          (先 pnpm build)
//
// **必须在隔离的 TEMP 下运行**：插件把动态与配额写在 os.tmpdir()，用真实 TEMP
// 跑会把测试数据灌进你正在用的朋友圈。脚本开头有一道硬闸门，目录名里没有
// "pyq-accept" 就直接退出。
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { pathToFileURL } from 'node:url'

const TMP = os.tmpdir()
if (!/pyq-accept/i.test(TMP)) {
  console.error(`[拒绝运行] os.tmpdir() = ${TMP}`)
  console.error('这不是隔离目录。请按文件头注释设置 TEMP/TMP 后再跑。')
  process.exit(2)
}

// 产物里的 withTimeout 故意 unref() 了兜底定时器（不能替宿主续命）。本脚本是
// 纯脚本环境，没有别的 handle，删掉这个 keep-alive 会在 #11 那条上把进程直接
// 掏空（Node 报 unsettled top-level await，exit 13）。
const keepAlive = setInterval(() => {}, 1000)

// 与 dev/load-check.mjs 同样的做法：把裸 `@deepseek-ai/*` 重写到宿主共享层，
// 这样加载路径和运行时的 cordis loader 一致。
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
function entryOf(dir) {
  const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'))
  return `${dir}/${pkg.module ?? pkg.main ?? 'lib/index.js'}`
}
for (const [bare, dir] of Object.entries(MAP)) MAP[bare] = entryOf(dir)

const SRC = fs.readFileSync(new URL('../lib/index.js', import.meta.url), 'utf8')
const WORK = fs.mkdtempSync(path.join(TMP, 'work-'))
let seq = 0

/** 每次调用都得到一个**独立的模块实例**（独立的内存态），模拟一次重启。 */
async function loadPlugin() {
  let code = SRC
  for (const [bare, target] of Object.entries(MAP)) {
    const url = JSON.stringify(pathToFileURL(target).href)
    code = code.replaceAll(`"${bare}"`, url).replaceAll(`'${bare}'`, url)
  }
  const dest = path.join(WORK, `index-${++seq}.js`)
  fs.writeFileSync(dest, code)
  return import(pathToFileURL(dest).href)
}

const REGISTRY = {
  list: async () => [
    { id: 'jingwen', name: '静文' },
    { id: 'jinn', name: '金金' },
    { id: 'lily', name: '莉莉' },
    { id: 'portrait-master', name: '人像摄影大师' },
  ],
}

function makeCtx(options = {}) {
  // 注意用 hasOwnProperty 判"显式传了 undefined"：直接靠默认参数的话，
  // `{ registry: undefined }` 会被默认值悄悄换成 REGISTRY，测不出"注册表缺失"。
  const registry = Object.prototype.hasOwnProperty.call(options, 'registry') ? options.registry : REGISTRY
  const stateOf = options.stateOf
  const bag = { tools: new Map(), sections: [], routes: [], projections: [], listeners: [] }
  const defaultStateOf = (_session, key) => (key === 'agentPreset' ? _session?.preset : undefined)
  const ctx = {
    tools: { register: (def) => bag.tools.set(def.name, def) },
    systemPrompt: { section: (o) => bag.sections.push(o) },
    webServer: { register: (r) => bag.routes.push(r) },
    sessionProjections: { register: (d) => bag.projections.push(d), stateOf: stateOf ?? defaultStateOf },
    get: (name) => (name === 'agentPresets' ? registry : undefined),
    on: (name, handler) => { bag.listeners.push([name, handler]); return () => {} },
    effect: () => () => {},
    inject: () => () => {},
  }
  return { ctx, bag }
}

const agentOf = (fullId, preset) => ({ agent: { id: fullId, session: { id: fullId, preset } } })

/** 起一个已 apply 的实例，返回它注册的工具与路由。 */
async function boot(options) {
  const mod = await loadPlugin()
  const { ctx, bag } = makeCtx(options)
  mod.apply(ctx)
  const t = (name) => {
    const def = bag.tools.get(name)
    if (!def) throw new Error(`工具未注册：${name}`)
    return def
  }
  return {
    mod,
    bag,
    publish: (id, preset, content) => t('publish_moment').execute({ content }, agentOf(id, preset)),
    comment: (id, preset, momentId, content) => t('comment_moment').execute({ momentId, content }, agentOf(id, preset)),
    like: (id, preset, momentId) => t('like_moment').execute({ momentId }, agentOf(id, preset)),
    feed: (id, preset) => t('get_moments_feed').execute({ limit: 50 }, agentOf(id, preset)),
    async list() {
      const route = bag.routes.find((r) => r.path === '/api/moments.list')
      if (!route) throw new Error('未注册 /api/moments.list')
      let body = ''
      await route.handler({}, { writeHead() {}, end: (chunk) => { body = chunk } })
      return JSON.parse(body).result
    },
  }
}

// 会话 id：agentId 取后 6 位，所以尾号要各不相同。
const JW = 'session-aaaa1111-0000-4000-8000-000000000001'   // → 000001
const JN = 'session-bbbb2222-0000-4000-8000-000000000002'   // → 000002
const FILL = 'session-cccc3333-0000-4000-8000-0000000000f1' // → 0000f1
const NOBODY = 'session-dddd4444-0000-4000-8000-00000000000e' // → 00000e
const Q = 'session-eeee5555-0000-4000-8000-0000000000q1'    // → 0000q1
const L = 'session-ffff6666-0000-4000-8000-0000000000l1'    // → 0000l1

const results = []
async function check(id, label, fn) {
  try {
    await fn()
    results.push([id, 'PASS', label])
  } catch (error) {
    results.push([id, 'FAIL', `${label} — ${error.message}`])
  }
  const [lastId, status, lastLabel] = results[results.length - 1]
  console.log(`${status}  ${lastId}  ${lastLabel}`)
}
function eq(actual, expected, what) {
  if (actual !== expected) throw new Error(`${what}: 期望 ${JSON.stringify(expected)}，实得 ${JSON.stringify(actual)}`)
}
function ok(value, what) {
  if (!value) throw new Error(what)
}

// ── 静态检查（不必挂载）────────────────────────────────────────────────────
const BANNED = ['generateComment', 'fallbackComment', 'pickCommenter', 'knownAgents', 'hourWeight',
  'isDeepNight', 'ageMultiplier', 'agentDefaultModel', 'ctx.llm', 'BlockAssembler', 'createUserMessage']
await check('#6', '代笔路径已删净（产物里搜不到代笔相关标识）', () => {
  const hit = BANNED.filter((name) => SRC.includes(name))
  eq(hit.join(','), '', '残留标识')
})
await check('#7', 'inject 恰好四项', async () => {
  const A = await loadPlugin()
  eq(JSON.stringify(A.inject), JSON.stringify(['tools', 'sessionProjections', 'webServer', 'systemPrompt']), 'inject')
})
await check('#21', '没有 5 分钟定时器 / interval 残留', () => {
  ok(!SRC.includes('3e5') && !SRC.includes('300000'), '产物里仍有 300000ms 定时器')
  ok(!/\.interval\(/.test(SRC), '产物里仍有 interval 调用')
})

// ── 主流程 ────────────────────────────────────────────────────────────────
const A = await boot()

await check('#1', 'apply() 注册工具/提示词段/路由/投影', () => {
  eq(A.bag.tools.size, 4, '工具数')
  ok(A.bag.sections.some((s) => s.name === 'moments:behavior'), '缺 moments:behavior')
  ok(A.bag.sections.some((s) => s.text.includes('### 互动（可选）')), '提示词段缺「互动（可选）」')
  ok(A.bag.routes.some((r) => r.path === '/api/moments.list'), '缺 moments.list 路由')
  ok(A.bag.projections.some((p) => p.key === 'momentsFeed'), '缺 momentsFeed 投影')
})

const jwPost = await A.publish(JW, 'jingwen', '今天改画改到十一点')
const jnPost = await A.publish(JN, 'jinn', '刚把那个 bug 收了')
const nobo = await A.publish(NOBODY, undefined, '没有预设的一场会话')

await check('#2', '/api/moments.list 里新动态带 displayName / sessionId / presetId', async () => {
  const rows = await A.list()
  const mine = rows.find((m) => m.content === '今天改画改到十一点')
  ok(mine, '列表里找不到刚发的动态')
  eq(mine.displayName, '静文', 'displayName')
  eq(mine.presetId, 'jingwen', 'presetId')
  eq(mine.sessionId, JW, 'sessionId（完整 id）')
  eq(mine.agentId, '000001', 'agentId 仍是 6 位哈希')
})

await check('#3', '静文会话发帖 → 「静文」', () => {
  ok(jwPost.message.startsWith('已发布'), `返回值异常：${jwPost.message}`)
})
await check('#4', '金金会话发帖 → 「金金」，且与静文那条并存', async () => {
  const rows = await A.list()
  const names = rows.map((m) => m.displayName)
  ok(names.includes('静文') && names.includes('金金'), `并存失败：${JSON.stringify(names)}`)
})
await check('#5', '无预设会话 → 回退到哈希，不报错', async () => {
  ok(nobo.message.startsWith('已发布'), '发帖失败')
  const rows = await A.list()
  const row = rows.find((m) => m.content === '没有预设的一场会话')
  ok(row, '列表里找不到无预设会话发的那条')
  eq(row.presetId, null, 'presetId 应为 null')
  ok(/^智能体 /.test(row.displayName), `没有退回哈希：${row.displayName}`)
})

await check('#12', '发帖返回值附 feed 摘要：≤3 条、不含刚发这条、带「不一定要回应」', () => {
  const message = jnPost.message
  ok(message.includes('朋友圈里还有：'), `缺摘要：${message}`)
  ok(message.includes('不一定要回应'), '缺「不一定要回应」')
  // 只看摘要段：「已发布：<内容>」本来就带自己的内容，别把开头算进来
  const digest = message.split('朋友圈里还有：')[1] ?? ''
  ok(!digest.includes('刚把那个 bug 收了'), '摘要里出现了自己刚发的那条')
  const rowsInDigest = digest.split('（不一定要回应')[0]
    .split('\n').filter((line) => line.trim().startsWith('['))
  ok(rowsInDigest.length > 0, '摘要里一条别的动态都没有')
  ok(rowsInDigest.length <= 3, `摘要条数 ${rowsInDigest.length} > 3`)
})

await check('#13', 'feed 前缀是角色名；自己赞过的带 [已赞]', async () => {
  const before = await A.feed(JN, 'jinn')
  ok(before.includes('静文（id: '), `feed 里没有角色名：${before.split('\n')[0]}`)
  ok(before.includes('今天改画改到十一点'), 'feed 缺静文那条')
  const rows = await A.list()
  const target = rows.find((m) => m.content === '今天改画改到十一点')
  await A.like(JN, 'jinn', target.id)
  const after = await A.feed(JN, 'jinn')
  const line = after.split('\n').find((l) => l.includes('今天改画改到十一点'))
  ok(line.includes('[已赞]'), `feed 缺 [已赞]：${line}`)
})

await check('#14', '金金评论静文 → 评论落库，带金金的 agentId 与 displayName', async () => {
  const rows = await A.list()
  const target = rows.find((m) => m.content === '今天改画改到十一点')
  const out = await A.comment(JN, 'jinn', target.id, '十一点还在改，早点睡吧')
  ok(out.includes('已评论「静文」'), `返回值异常：${out}`)
  const fresh = (await A.list()).find((m) => m.id === target.id)
  const c = fresh.comments[fresh.comments.length - 1]
  eq(c.agentId, '000002', '评论 agentId')
  eq(c.displayName, '金金', '评论 displayName')
})

// 注意：本条的期望值随「回复评论」规格（§9#7）改过 —— 旧规则是"评论自己的动态被拒"，
// 新规则允许在自己的动态下**新开**一条顶层评论（只是不许回复自己的评论，见 reply-acceptance-check.mjs #8）。
await check('#15', '评论自己的动态已放开：可以新开一条顶层评论', async () => {
  const rows = await A.list()
  const own = rows.find((m) => m.agentId === '000002')
  const before = own.comments.length
  const out = await A.comment(JN, 'jinn', own.id, '自夸一下')
  ok(out.includes('已评论'), `返回值异常：${out}`)
  const after = (await A.list()).find((m) => m.id === own.id)
  eq(after.comments.length, before + 1, '评论数')
})

await check('#16', '重复点赞被拒，likes 里只有一份', async () => {
  const rows = await A.list()
  const target = rows.find((m) => m.content === '今天改画改到十一点')
  const out = await A.like(JN, 'jinn', target.id)
  ok(out.includes('已经赞过了'), `返回值异常：${out}`)
  const fresh = (await A.list()).find((m) => m.id === target.id)
  eq(fresh.likes.filter((id) => id === '000002').length, 1, '金金在 likes 里的条数')
})

await check('#17', '给自己点赞被拒', async () => {
  const rows = await A.list()
  const own = rows.find((m) => m.agentId === '000002')
  const out = await A.like(JN, 'jinn', own.id)
  ok(out.includes('这是你自己发的'), `返回值异常：${out}`)
})

await check('#22', 'likerNames 记下点赞者展示名（只点赞没发过帖也能显示角色名）', async () => {
  const rows = await A.list()
  const target = rows.find((m) => m.content === '今天改画改到十一点')
  ok(target.likerNames, '记录里没有 likerNames')
  eq(target.likerNames['000002'], '金金', 'likerNames[000002]')
})

await check('#7b', 'momentId 对不上 → 返回「没有这条动态。」而不是抛错', async () => {
  const outC = await A.comment(JN, 'jinn', 'no-such-id', '在吗')
  eq(outC, '没有这条动态。', 'comment 返回值')
  const outL = await A.like(JN, 'jinn', 'no-such-id')
  eq(outL, '没有这条动态。', 'like 返回值')
})

// 配额：先造够素材（发帖不受配额限制）
const filler = []
for (let i = 0; i < 12; i++) {
  const out = await A.publish(FILL, undefined, `凑数动态 ${i + 1}`)
  const rows = await A.list()
  filler.push(rows.find((m) => m.content === `凑数动态 ${i + 1}`).id)
  ok(out.message.startsWith('已发布'), '凑数发帖失败')
}

await check('#18', '评论满 5 条后第 6 条被拒；点赞额度不受影响', async () => {
  for (let i = 0; i < 5; i++) {
    const out = await A.comment(Q, undefined, filler[i], `第 ${i + 1} 条评论`)
    eq(out.startsWith('已评论'), true, `第 ${i + 1} 条评论应成功，实得：${out}`)
  }
  const sixth = await A.comment(Q, undefined, filler[5], '第六条')
  ok(sixth.includes('已经评论满'), `返回值异常：${sixth}`)
  const liked = await A.like(Q, undefined, filler[0])
  ok(liked.includes('已点赞'), `点赞不该被评论额度影响：${liked}`)
})

await check('#19', '点赞满 10 个后第 11 个被拒', async () => {
  let last = ''
  for (let i = 0; i < 10; i++) last = await A.like(L, undefined, filler[i])
  eq(last.startsWith('已点赞'), true, `第 10 个赞应成功，实得：${last}`)
  const eleventh = await A.like(L, undefined, filler[10])
  ok(eleventh.includes('已经赞满'), `返回值异常：${eleventh}`)
})

await check('#20', '重启后（全新模块实例）当日额度不重置', async () => {
  const B = await boot()
  const out = await B.comment(Q, undefined, filler[6], '重启后再评一条')
  ok(out.includes('已经评论满'), `重启后额度被重置了：${out}`)
})

// ── 老数据 / 快照语义（#9、#23）────────────────────────────────────────────
await check('#23', '改造前的老动态照常显示（回退到哈希），不需要迁移', async () => {
  const STORE = path.join(TMP, 'moments-plugin-moments.json')
  const rows = JSON.parse(fs.readFileSync(STORE, 'utf8'))
  rows.push({
    id: 'legacy-0001',
    agentId: '00000d',
    content: '改造前就发的老动态',
    timestamp: Date.now() - 86400000,
    likes: [],
    comments: [],
  })
  fs.writeFileSync(STORE, JSON.stringify(rows, null, 2))
  const B = await boot()
  const text = await B.feed(JN, 'jinn')
  const line = text.split('\n').find((l) => l.includes('改造前就发的老动态'))
  ok(line, '老动态没出现在 feed 里')
  ok(line.includes('00000d'), `老动态没有回退到哈希：${line}`)
})

await check('#9', '快照语义：改了预设名之后，新帖用新名、旧帖保持当时的名字', async () => {
  const RENAMED = { list: async () => [{ id: 'jingwen', name: '静文姐' }] }
  const B = await boot({ registry: RENAMED })
  const out = await B.publish(JW, 'jingwen', '改名之后发的新帖')
  ok(out.message.includes('已发布'), '新帖发布失败')
  const rows = await B.list()
  eq(rows.find((m) => m.content === '改名之后发的新帖').displayName, '静文姐', '新帖展示名')
  eq(rows.find((m) => m.content === '今天改画改到十一点').displayName, '静文', '旧帖展示名（快照）')
})

// ── 注册表缺失 / 超时 / stateOf 抛错（#10、#11）─────────────────────────────
await check('#10', 'ctx.get("agentPresets") 返回 undefined 时发帖仍成功，退回 presetId', async () => {
  const C = await boot({ registry: undefined })
  const out = await C.publish(JW, 'jingwen', '注册表不在时发的帖')
  ok(out.message.includes('已发布'), `发帖失败：${out.message}`)
  const rows = await C.list()
  eq(rows.find((m) => m.content === '注册表不在时发的帖').displayName, 'jingwen', '退回 presetId')
})

await check('#10b', 'stateOf 抛异常时不崩，退回哈希', async () => {
  const C = await boot({ stateOf: () => { throw new Error('no projection') } })
  const out = await C.publish(JW, undefined, 'stateOf 抛错时发的帖')
  ok(out.message.includes('已发布'), `发帖失败：${out.message}`)
  const rows = await C.list()
  ok(/^智能体 /.test(rows.find((m) => m.content === 'stateOf 抛错时发的帖').displayName), '没有退回哈希')
})

await check('#11', '冷启动最多等 800ms：list() 永不返回时发帖也能按时返回', async () => {
  const HANG = { list: () => new Promise(() => {}) }
  const D = await boot({ registry: HANG })
  const started = Date.now()
  const out = await D.publish(JW, 'jingwen', '注册表挂死时发的帖')
  const spent = Date.now() - started
  console.log(`      （实测 ${spent}ms：注册表永不返回，仍按时发完帖）`)
  ok(out.message.includes('已发布'), '发帖被注册表拖挂了')
  ok(spent < 2000, `耗时 ${spent}ms，超时兜底没生效`)
  const rows = await D.list()
  eq(rows.find((m) => m.content === '注册表挂死时发的帖').displayName, 'jingwen', '超时后应退回 presetId')
})

// ── 汇总 ─────────────────────────────────────────────────────────────────
const failed = results.filter(([, status]) => status === 'FAIL')
console.log(`\n${results.length - failed.length}/${results.length} 通过（逐条结果见上）`)
console.log('本脚本覆盖不到的（只能重挂载后在界面里看）：#8 头像字符与配色、GUI 里的深/浅色渲染')
clearInterval(keepAlive)
fs.rmSync(WORK, { recursive: true, force: true })
process.exitCode = failed.length > 0 ? 1 : 0
