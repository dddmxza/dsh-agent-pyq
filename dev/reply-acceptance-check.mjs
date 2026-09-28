// 「回复评论」规格（C:\Users\15221\Desktop\素材\pyq-回复评论实施规格.md）§9 的
// 17 条验收自检：不起 GUI、不挂载 DSH，直接给构建产物喂桩 ctx。
//
//   $d = Join-Path $env:TEMP 'pyq-reply'
//   Remove-Item -Recurse -Force $d -ErrorAction SilentlyContinue
//   New-Item -ItemType Directory -Force $d | Out-Null
//   $env:TEMP = $d; $env:TMP = $d
//   node dev/reply-acceptance-check.mjs        (先 pnpm build)
//
// **必须在隔离的 TEMP 下运行**：插件把动态 / 配额 / 水位线写在 os.tmpdir()，
// 用真实 TEMP 跑会把测试数据灌进你正在用的朋友圈。开头有一道硬闸门。
//
// #13–#15 是客户端渲染：这里真的把 lib/client.js 当浏览器 bundle 跑起来，
// 用「假 React + 自己写的序列化器」把真实组件渲染成 HTML 再断言（不是静态搜字符串）。
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'

const TMP = os.tmpdir()
if (!/pyq-reply/i.test(TMP)) {
  console.error(`[拒绝运行] os.tmpdir() = ${TMP}`)
  console.error('这不是隔离目录。请按文件头注释设置 TEMP/TMP 后再跑。')
  process.exit(2)
}

// 产物的 withTimeout 故意 unref() 了兜底定时器；纯脚本环境需要自己吊住事件循环。
const keepAlive = setInterval(() => {}, 1000)
const realRequire = createRequire(import.meta.url)

// 与 dev/load-check.mjs 同样的做法：把裸 `@deepseek-ai/*` 重写到宿主共享层。
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
const CLIENT_SRC = fs.readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
const WORK = fs.mkdtempSync(path.join(TMP, 'work-'))
let seq = 0

/** 每次调用都拿到**独立模块实例**（独立内存态），模拟一次重启。 */
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
  ],
}

function makeCtx(options = {}) {
  const registry = Object.prototype.hasOwnProperty.call(options, 'registry') ? options.registry : REGISTRY
  const bag = { tools: new Map(), sections: [], routes: [], projections: [], listeners: [] }
  const defaultStateOf = (_session, key) => (key === 'agentPreset' ? _session?.preset : undefined)
  const ctx = {
    tools: { register: (def) => bag.tools.set(def.name, def) },
    systemPrompt: { section: (o) => bag.sections.push(o) },
    webServer: { register: (r) => bag.routes.push(r) },
    sessionProjections: { register: (d) => bag.projections.push(d), stateOf: options.stateOf ?? defaultStateOf },
    get: (name) => (name === 'agentPresets' ? registry : undefined),
    on: (name, handler) => { bag.listeners.push([name, handler]); return () => {} },
    effect: () => () => {},
    inject: () => () => {},
  }
  return { ctx, bag }
}

const agentOf = (fullId, preset) => ({ agent: { id: fullId, session: { id: fullId, preset } } })

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
    comment: (id, preset, momentId, content, replyToCommentId) => t('comment_moment').execute(
      replyToCommentId ? { momentId, content, replyToCommentId } : { momentId, content },
      agentOf(id, preset),
    ),
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

// 会话 id：agentId 取后 6 位。
const JW = 'session-aaaa1111-0000-4000-8000-000000000001'   // 静文 · 会话 A → 000001
const JW2 = 'session-zzzz9999-0000-4000-8000-0000000000b2'  // 静文 · 会话 B → 0000b2（同角色！）
const JN = 'session-bbbb2222-0000-4000-8000-000000000002'   // 金金 → 000002
const FF = 'session-iiii0000-0000-4000-8000-0000000000ff'   // 凑数 → 0000ff
const QQ = 'session-eeee5555-0000-4000-8000-0000000000q1'   // 无预设 → 0000q1
const RR = 'session-hhhh8888-0000-4000-8000-0000000000r1'   // 无预设 → 0000r1

const STORE = path.join(TMP, 'moments-plugin-moments.json')
const SEEN = path.join(TMP, 'moments-plugin-seen.json')
const store = () => JSON.parse(fs.readFileSync(STORE, 'utf8'))
const momentIn = (id) => store().find((m) => m.id === id)
const commentsOf = (id) => momentIn(id).comments
const lastComment = (id) => commentsOf(id)[commentsOf(id).length - 1]

const headerLine = (text) => text.split('\n').find((l) => /^　└ 评论 \d+ 条/.test(l)) ?? '(无评论头)'
const cidsIn = (text) => [...text.matchAll(/（cid: ([^）]+)）/g)].map((m) => m[1])

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

// ── 主流程 ────────────────────────────────────────────────────────────────
const A = await boot()

/** publish_moment 只返回 { success, message }，不带 id —— 要拿 id 得去朋友圈列表里找。 */
const idOf = async (content) => {
  const row = (await A.list()).find((m) => m.content === content)
  if (!row) throw new Error(`列表里找不到刚发的动态「${content}」`)
  return row.id
}

const m1Post = await A.publish(JW, 'jingwen', '今天改画改到十一点')
const m1 = await idOf('今天改画改到十一点')
let c1Id = ''

await check('#1', '发一条动态 → 返回值里没有「有新评论」段', () => {
  ok(m1Post.message.startsWith('已发布'), `发帖失败：${m1Post.message}`)
  ok(!m1Post.message.includes('你发过的动态有新评论'), `不该有提醒段：${m1Post.message}`)
})

await check('#2', '另一角色评论这条动态 → 成功', async () => {
  const out = await A.comment(JN, 'jinn', m1, '十一点还在改，早点睡吧')
  ok(out.includes('已评论「静文」'), `返回值异常：${out}`)
  const c = lastComment(m1)
  eq(c.agentId, '000002', '评论 agentId')
  eq(c.displayName, '金金', '评论 displayName')
  eq(c.presetId, 'jinn', '评论 presetId')
  ok(!('replyTo' in c), '顶层评论不该带 replyTo 键')
  c1Id = c.id
})

await check('#3', '原角色刷 feed →「评论 1 条 · 新 1 条」且评论行带 cid', async () => {
  const text = await A.feed(JW, 'jingwen')
  eq(headerLine(text), '　└ 评论 1 条 · 新 1 条', '评论头')
  ok(cidsIn(text).includes(c1Id), `cid 没给出来：${cidsIn(text).join(',')}`)
  ok(text.includes(`金金`), '评论行没有作者名')
})

await check('#4', '别人的动态 → 不显示任何评论行（只展开自己的）', async () => {
  await A.publish(JN, 'jinn', '刚把那个 bug 收了')
  const m2 = await idOf('刚把那个 bug 收了')
  const c2 = await A.comment(JW, 'jingwen', m2, '厉害')
  const text = await A.feed(JN, 'jinn')
  ok(text.includes('今天改画改到十一点'), '别人的动态正文应当照常显示')
  const cids = cidsIn(text)
  eq(cids.length, 1, `只该展开自己那条的评论，实得 ${cids.length} 条 cid`)
  ok(text.includes('　└ 评论 1 条 · 新 1 条'), `自己那条应当展开：${text}`)
  ok(!cids.includes(c1Id), '别人的动态下的评论被展开了')
  ok(cids[0] !== undefined, '自己那条的 cid 没给出来')
  void c2
})

await check('#5', '再刷一次 →「评论 1 条」，「新 N 条」消失', async () => {
  const text = await A.feed(JW, 'jingwen')
  eq(headerLine(text), '　└ 评论 1 条', '评论头（水位线应已推进）')
})

let replyId = ''
let topId = ''

await check('#6', '带 replyToCommentId 回一句 → 成功，replyTo 指向父评论', async () => {
  const out = await A.comment(JW, 'jingwen', m1, '我知道，马上收', c1Id)
  eq(out, '已回复「金金」的评论。', '返回值')
  const c = lastComment(m1)
  eq(c.replyTo, c1Id, 'replyTo')
  eq(c.replyToName, '金金', 'replyToName 快照')
  eq(c.presetId, 'jingwen', 'presetId')
  eq(c.agentId, '000001', 'agentId')
  replyId = c.id
})

await check('#7', '不带 replyToCommentId 评论自己的动态 → 成功（守卫已放开）', async () => {
  const out = await A.comment(JW, 'jingwen', m1, '补一句说明')
  eq(out, '已评论「静文」的动态。', '返回值')
  const c = lastComment(m1)
  ok(!('replyTo' in c), '顶层评论不该带 replyTo 键（exactOptionalPropertyTypes）')
  ok(!('replyToName' in c), '顶层评论不该带 replyToName 键')
  topId = c.id
})

await check('#8', '回复自己的评论 →「不用回复自己的评论。」', async () => {
  const before = commentsOf(m1).length
  const out = await A.comment(JW, 'jingwen', m1, '再补一句', topId)
  eq(out, '不用回复自己的评论。', '返回值')
  eq(commentsOf(m1).length, before, '不该写入')
})

await check('#9', '回复"已经是回复"的评论 →「只回一层，这条不用再接了。」', async () => {
  const before = commentsOf(m1).length
  // 别人来回复不会命中"自己"分支，先确认一层为限生效
  eq(await A.comment(JN, 'jinn', m1, '收到', replyId), '只回一层，这条不用再接了。', '异角色')
  // 同角色也必须是「一层为限」而不是「不用回复自己的评论。」——证明守卫顺序
  eq(await A.comment(JW, 'jingwen', m1, '那我也再说一句', replyId), '只回一层，这条不用再接了。', '同角色')
  eq(commentsOf(m1).length, before, '不该写入')
})

await check('#10', 'replyToCommentId 传不存在的 cid →「没有这条评论。」', async () => {
  const before = commentsOf(m1).length
  eq(await A.comment(JN, 'jinn', m1, '在吗', 'no-such-cid'), '没有这条评论。', '返回值')
  eq(commentsOf(m1).length, before, '不该写入')
})

// 凑数动态：给配额那两条测试用（发帖不占评论额度）
const filler = []
for (let i = 0; i < 6; i++) {
  await A.publish(FF, undefined, `凑数动态 ${i + 1}`)
  filler.push((await A.list()).find((m) => m.content === `凑数动态 ${i + 1}`).id)
}

await check('#11', '连续评论到第 6 条 →「你今天已经评论满 5 条了，明天再说。」', async () => {
  for (let i = 0; i < 5; i++) {
    const out = await A.comment(QQ, undefined, filler[i], `第 ${i + 1} 条评论`)
    ok(out.startsWith('已评论'), `第 ${i + 1} 条应成功，实得：${out}`)
  }
  const sixth = await A.comment(QQ, undefined, filler[5], '第六条')
  eq(sixth, '你今天已经评论满 5 条了，明天再说。', '第 6 条返回值')
})

await check('#12', '空内容 →「评论内容不能为空。」且不消耗配额', async () => {
  eq(await A.comment(RR, undefined, filler[0], '   '), '评论内容不能为空。', '空内容返回值')
  // 空的那次没吃掉额度：后面还能连评 5 条
  for (let i = 0; i < 5; i++) {
    const out = await A.comment(RR, undefined, filler[i], `补第 ${i + 1} 条`)
    ok(out.startsWith('已评论'), `空内容之后第 ${i + 1} 条应成功（说明没扣额度），实得：${out}`)
  }
  eq(await A.comment(RR, undefined, filler[5], '第六条'), '你今天已经评论满 5 条了，明天再说。', '第 6 条')
})

// ── 同角色两个会话（#16 / #17）─────────────────────────────────────────────
await check('#17', '同角色两个会话：B 在 A 的帖子下不能当"别人"（角色键生效）', async () => {
  // B 发帖时，A 那条帖子下的新评论应当被认成"自己发过的动态"
  const m3 = await A.publish(JW2, 'jingwen', '同角色另一个会话发的帖')
  ok(m3.message.includes('你发过的动态有新评论'), `B 没把自己的动态算成自己的：${m3.message}`)
  ok(m3.message.includes('新 2 条'), `新评论条数不对：${m3.message.split('你发过的动态有新评论')[1] ?? ''}`)
  // B 回复 A（同一角色）写的顶层评论 → 必须被认成"自己的评论"
  const before = commentsOf(m1).length
  eq(await A.comment(JW2, 'jingwen', m1, '换个会话接着说', topId), '不用回复自己的评论。', 'B 回复同角色的评论')
  eq(commentsOf(m1).length, before, '不该写入')
})

await check('#16', '同角色两个会话：B 刷 feed 能看到 A 那条是自己的（水位线也按角色）', async () => {
  const text = await A.feed(JW2, 'jingwen')
  // m1 现在有 3 条评论（c1 + 回复 + 顶层），水位线是角色级、A 刷过 1 条 → 新 2 条
  eq(headerLine(text), '　└ 评论 3 条 · 新 2 条', 'B 看到的评论头')
  const cids = cidsIn(text)
  eq(cids.length, 3, `只该展开自己那条（m1）的 3 条评论，实得 ${cids.length}`)
  ok(cids.includes(c1Id) && cids.includes(replyId) && cids.includes(topId), 'cid 不全')
  const seen = JSON.parse(fs.readFileSync(SEEN, 'utf8'))
  ok(seen.jingwen && seen.jingwen[m1] === 3, `水位线应记在 jingwen 键下：${JSON.stringify(seen)}`)
})

// ── 客户端渲染 #13 / #14 / #15 ─────────────────────────────────────────────
const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ESCAPES[c])
const ATTR = { className: 'class', dateTime: 'datetime', tabIndex: 'tabindex' }

/** 极简序列化器：把「假 React」产出的元素树渲染成 HTML 字符串。 */
function renderNode(node) {
  if (node === null || node === undefined || node === false || node === true) return ''
  if (Array.isArray(node)) return node.map(renderNode).join('')
  if (typeof node === 'string' || typeof node === 'number') return esc(node)
  if (typeof node !== 'object') return ''
  const { type, props } = node
  if (typeof type === 'function') return renderNode(type(props ?? {}))
  if (typeof type === 'symbol') return renderNode(props?.children)   // Fragment
  const attrs = Object.entries(props ?? {})
    .filter(([k, v]) => k !== 'children' && !k.startsWith('on') && v !== null && v !== undefined && v !== false && typeof v !== 'object')
    .map(([k, v]) => ` ${ATTR[k] ?? k}="${esc(v)}"`)
    .join('')
  return `<${type}${attrs}>${renderNode(props?.children)}</${type}>`
}

const CLIENT_MOMENTS = [
  {
    id: 'm-a', agentId: '000001', displayName: '静文', presetId: 'jingwen',
    content: '今天改画改到十一点', timestamp: Date.now(), likes: [], likerNames: {},
    comments: [
      { id: 'c-1', agentId: '000002', displayName: '金金', content: '早点睡', timestamp: Date.now() - 100 },
      {
        id: 'c-2', agentId: '000001', displayName: '静文', content: '知道了',
        timestamp: Date.now() - 50, replyTo: 'c-1', replyToName: '金金',
      },
    ],
  },
  {
    id: 'm-b', agentId: '000003', displayName: '莉莉',
    content: '老动态', timestamp: Date.now() - 1000, likes: [], likerNames: {},
    comments: [
      // 老数据：没有 displayName、没有 replyTo
      { id: 'c-3', agentId: '00000d', content: '改造前的老评论', timestamp: Date.now() - 900 },
    ],
  },
]

/** 把 lib/client.js 当浏览器 bundle 跑起来，拿到注册进去的组件并渲染。 */
function loadClient() {
  let hookIndex = 0
  let hookValues = []
  const elements = []
  const REACT = {
    useState(initial) {
      const i = hookIndex++
      const value = i < hookValues.length ? hookValues[i] : (typeof initial === 'function' ? initial() : initial)
      return [value, () => {}]
    },
    // 效果立即执行：让 loadMoments() 真的把展示名记进 DISPLAY_NAMES（fetch 已打桩）
    useEffect(fn) { try { fn() } catch { /* 效果里的 DOM 细节不在本脚本验证范围 */ } },
    useLayoutEffect() {}, useInsertionEffect() {},
    useRef(value) { return { current: value } },
    useCallback(fn) { return fn },
    useMemo(fn) { return fn() },
    createElement(type, props, ...children) {
      return { type, props: { ...(props ?? {}), children: children.length <= 1 ? children[0] : children } }
    },
    Fragment: Symbol('Fragment'),
  }
  const el = (type, config, key) => {
    const props = { ...(config ?? {}) }
    delete props.key
    delete props.ref
    return { type, props, key: key ?? null }
  }
  const JSX = { jsx: el, jsxs: el, jsxDEV: el, Fragment: Symbol('Fragment') }

  const styles = []
  globalThis.window = {
    __ModuleLoader__: { load(definition) { globalThis.__clientDef = definition } },
    addEventListener() {}, removeEventListener() {},
  }
  globalThis.document = {
    createElement: (tag) => ({ tagName: tag, dataset: {}, textContent: '' }),
    head: { appendChild: (node) => styles.push(node) },
    body: { style: {} },
    addEventListener() {}, removeEventListener() {},
  }
  globalThis.EventSource = class { addEventListener() {} close() {} }
  globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({ result: CLIENT_MOMENTS }) })

  const require = (id) => (id === 'react' ? REACT : id === 'react/jsx-runtime' ? JSX : realRequire(id))
  // eslint-disable-next-line no-new-func -- 就是要把构建产物当浏览器脚本跑
  new Function('require', CLIENT_SRC)(require)

  const definition = globalThis.__clientDef
  if (!definition) throw new Error('bundle 没有调用 window.__ModuleLoader__.load')
  const mod = definition.factory(require)
  const slots = []
  mod.apply({
    slots: {
      inject(_name, register) { register() },
      register(options, component) { slots.push({ options, component }) },
    },
  })
  // 注意：**不要**在这里还原 window / document / fetch / EventSource ——
  // 组件要等到下面 render() 时才真的去 fetch 列表（effects 在第一次渲染里跑）。
  if (slots.length !== 1) throw new Error(`注册的组件数应为 1，实得 ${slots.length}`)

  return {
    styles,
    render(list) {
      hookIndex = 0
      hookValues = [true, list, false, null]   // visible / moments / loading / error
      return renderNode({ type: slots[0].component, props: {} })
    },
  }
}

const client = loadClient()
client.render(CLIENT_MOMENTS)                          // 第一遍：触发 loadMoments()，记下展示名
await new Promise((resolve) => setTimeout(resolve, 20))
ok(client.styles.length === 1, '应当注入恰好一份样式')
const html = client.render(CLIENT_MOMENTS)              // 第二遍：展示名已就位

await check('#13', '客户端：回复的那条渲染成「A 回复 B：内容」', () => {
  const expected = '<span class="dtpl-moments-comment-name" title="000001">静文</span>'
    + '<span class="dtpl-moments-comment-rel"> 回复 金金</span>'
    + '<span>：知道了</span>'
  ok(html.includes(expected), `渲染结果里找不到「A 回复 B：内容」\n期望片段：${expected}`)
})

await check('#14', '客户端：顶层评论渲染不变（没有多余的「回复」字样）', () => {
  const expected = '<span class="dtpl-moments-comment-name" title="000002">金金</span>'
    + '<span>：早点睡</span>'
  ok(html.includes(expected), `顶层评论渲染变了\n期望片段：${expected}`)
  eq((html.match(/dtpl-moments-comment-rel/g) ?? []).length, 1, '「回复」前缀出现次数')
})

await check('#15', '客户端：老数据（无 replyTo）照常渲染', () => {
  const expected = '<span class="dtpl-moments-comment-name" title="00000d">智能体 00000d</span>'
    + '<span>：改造前的老评论</span>'
  ok(html.includes(expected), `老数据渲染变了\n期望片段：${expected}`)
})

// ── 规格外的静态核对：样式里确实有这一条 ────────────────────────────────────
await check('#13b', '客户端：.dtpl-moments-comment-rel 在注入的 CSS 里有定义', () => {
  const css = client.styles[0].textContent
  const rule = css.match(/\.dtpl-moments-comment-rel\s*\{[^}]*\}/)?.[0]
  ok(rule, '注入的 CSS 里没有 .dtpl-moments-comment-rel')
  ok(/color:\s*var\(--dsw-/.test(rule), `这条规则没有走主题令牌：${rule}`)
})

// ── 汇总 ─────────────────────────────────────────────────────────────────
const failed = results.filter(([, status]) => status === 'FAIL')
console.log(`\n${results.length - failed.length}/${results.length} 通过（逐条结果见上）`)
console.log('本脚本覆盖不到的（只能重挂载后在界面里看）：真实浏览器里的深浅色渲染、字体与间距。')
clearInterval(keepAlive)
fs.rmSync(WORK, { recursive: true, force: true })
process.exitCode = failed.length > 0 ? 1 : 0
