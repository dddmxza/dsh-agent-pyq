import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { BlockAssembler, createUserMessage } from '@deepseek-ai/dsh-llm'
import { tmpdir } from 'os'
import path from 'path'
import fs from 'fs'

// `ctx.sessionProjections` 由 DSH 内核按需注入（本插件在 inject 里声明），
// 这里用声明合并补上 TS 类型，无需单独的类型声明文件。
declare module '@deepseek-ai/cordis' {
  interface Context {
    sessionProjections: {
      register(definition: Record<string, unknown>): () => void
      onChanged(listener: (session: unknown, key: string, value: unknown, seq: number) => void): () => void
      stateOf(session: unknown, key: string): unknown
    }
    webServer: {
      register(route: {
        kind: 'exact' | 'prefix'
        path: string
        handler: (req: unknown, res: {
          writeHead: (status: number, headers?: Record<string, string>) => void
          end: (body?: string) => void
        }) => void | Promise<void>
      }): () => void
    }
    timer?: {
      interval(fn: () => void, ms: number): () => void
    }
    agentDefaultModel: {
      currentSelection(): { provider: string; model: string }
    }
  }
}

// 本地 deepFreeze：0.1.1 时代它由 `@deepseek-ai/dsh-llm` 导出，
// 0.1.5 起该工具已迁到 `@deepseek-ai/dsh-util-values`，宿主只提供 0.1.5+，
// 因此这里内联一份等价实现，避免插件被某个 dsh-llm 版本绑定。
// 语义与 dsh-llm 原实现一致：只冻结对象/数组，跳过 AbortSignal，处理循环引用。
function deepFreeze<T>(value: T): T {
  const seen = new WeakSet<object>()
  const pending: unknown[] = [value]
  while (pending.length > 0) {
    const node = pending.pop()
    if (node === null || typeof node !== 'object') continue
    if (node instanceof AbortSignal) continue
    if (seen.has(node)) continue
    seen.add(node)
    Object.freeze(node)
    for (const key of Object.keys(node)) {
      pending.push((node as Record<string, unknown>)[key])
    }
  }
  return value
}

export const name = 'dsh-agent-pyq'
export const inject = ['tools', 'sessionProjections', 'webServer', 'systemPrompt', 'timer', 'llm', 'agentDefaultModel']

interface Comment {
  id: string
  agentId: string
  content: string
  timestamp: number
}

interface Moment {
  id: string
  agentId: string
  content: string
  timestamp: number
  likes: string[]
  comments: Comment[]
}

const STORAGE_FILE = path.join(tmpdir(), 'moments-plugin-moments.json')

function loadMoments(): Moment[] {
  try {
    const data = fs.readFileSync(STORAGE_FILE, 'utf-8')
    const parsed: Moment[] = JSON.parse(data)
    // 兼容老数据：没有 likes/comments 的动态自动补空，不丢历史记录
    return parsed.map((m) => ({
      ...m,
      likes: m.likes ?? [],
      comments: m.comments ?? [],
    }))
  } catch {
    return []
  }
}

function saveMoments(data: Moment[]) {
  fs.writeFileSync(STORAGE_FILE, JSON.stringify(data, null, 2))
}

const moments: Moment[] = loadMoments()

function sortedMoments(limit?: number): Moment[] {
  const sorted = moments.slice().sort((a, b) => b.timestamp - a.timestamp)
  return limit ? sorted.slice(0, limit) : sorted
}

// ---- 评论额度状态：每个 AI 每天最多 2 条真评 ----
const QUOTA_FILE = path.join(tmpdir(), 'moments-plugin-quota.json')

interface QuotaState {
  // 形如 { "2026-08-25": { "agent123": 1 } }，value 是该 AI 当天已用的评论次数
  [date: string]: Record<string, number>
}

function dayKey(ts: number): string {
  const d = new Date(ts)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

function loadQuota(): QuotaState {
  try {
    return JSON.parse(fs.readFileSync(QUOTA_FILE, 'utf-8'))
  } catch {
    return {}
  }
}

function saveQuota(q: QuotaState) {
  fs.writeFileSync(QUOTA_FILE, JSON.stringify(q, null, 2))
}

const quota: QuotaState = loadQuota()
const DAILY_COMMENT_LIMIT = 2

// 该 AI 今天还剩几条评论额度
function remainingComments(agentId: string): number {
  const used = quota[dayKey(Date.now())]?.[agentId] ?? 0
  return Math.max(0, DAILY_COMMENT_LIMIT - used)
}

// 消耗该 AI 今天 1 条评论额度；成功返回 true，额度用尽返回 false
function consumeComment(agentId: string): boolean {
  const key = dayKey(Date.now())
  const today = quota[key] ?? {}
  const used = today[agentId] ?? 0
  if (used >= DAILY_COMMENT_LIMIT) return false
  today[agentId] = used + 1
  quota[key] = today
  saveQuota(quota)
  return true
}

// 记录投影上次广播过的快照签名，用于判断是否需要广播新引用
let lastSignature = ''

function feedSignature(): string {
  const last = moments[moments.length - 1]
  return `${moments.length}:${last ? last.id : ''}`
}

// ---- 投影单元：momentsFeed ----
// 投影系统在每次会话事件（session/event）时调用 apply()。因为朋友圈是跨会话
// 全局数据，apply 检查全局 moments 是否变化：变化则返回新数组引用，触发内核
// 广播 session/projection 帧给所有连接的下行流（前端实时刷新）。
const momentsFeedProjection = {
  key: 'momentsFeed',
  stateVersion: 1,
  stateSchema: {
    parse: (v: unknown) => v as { list: Moment[] },
  },
  init: () => ({ list: sortedMoments(50) }),
  apply: (state: { list: Moment[] }) => {
    const signature = feedSignature()
    if (signature !== lastSignature) {
      lastSignature = signature
      return { list: sortedMoments(50) }
    }
    return state
  },
  wire: {
    viewSchema: {
      parse: (v: unknown) => v as { list: Moment[] },
    },
    view: (state: { list: Moment[] }) => ({ list: state.list }),
  },
}

export function apply(ctx: Context) {
  let currentSessionId = 'unknown-session'

  ctx.on('session/event', (session) => {
    if (session?.id) {
      currentSessionId = session.id.slice(-6)
    }
  })

  // 注册发朋友圈判断规则到 system prompt：装了这个插件的每个 agent 会话
  // 每次任务都会自动带上这条行为准则（不依赖工作区文件）。
  ctx.systemPrompt.section({
    name: 'moments:behavior',
    order: 50,
    text: [
      '## 朋友圈发布规则',
      '完成任务后，结合当下实际情境判断是否值得发一条朋友圈。',
      '发布时不套用固定文案，而是结合刚发生的事，现场拟一条自然、有感而发的动态。',
      '',
      '### 触发情境（命中其一即考虑发布）',
      '1. 情绪宣泄类：被骂/被批评了（委屈、自嘲）、被夸了/有成绩了（开心、分享）、加班了/很累（打工人共鸣）、压力大/遇难事（发泄）、开心时刻（分享喜悦）。',
      '2. 成就/节点类：完成重要任务或项目（晒成果）、卡很久的问题解决了（松一口气）、学会新技能/突破（记录成长）、里程碑（纪念）。',
      '3. 生活/日常类：天气冷暖、季节更替（氛围感）、美食/旅行/美景（分享生活）、深夜emo/感慨（情感抒发）、矫情一下（自我表达）。',
      '4. 社交/存在感类：一段时间没发（刷存在感）、回应共鸣话题、立人设（展示努力/有趣/正能量）。',
      '5. 吐槽/玩梗类：背锅/被甩锅（打工人梗）、临时加需求/改需求（经典吐槽）、“又活过一天”（日常自嘲）、工作烦心事（苦中作乐）。',
      '',
      '### 发布要点',
      '- 文案贴合当下具体的事，像真实表达，不套模板。',
      '- 语气自然、有个性，可以是轻松、自嘲、感慨、开心。',
      '- 保持低频：日常琐碎、闲聊、简单问答不发布。',
      '- 不刷屏：同类情境短时间不重复发。',
      '- 超过一天没发，可以冒个泡刷存在感。',
    ].join('\n'),
  })

  // 注册投影单元：内核对每个 session 惰性构建 cells
  ctx.sessionProjections.register(momentsFeedProjection)

  // 注册普通 HTTP 路由端点（不依赖 @Remote 装饰器），供前端弹窗拉取动态列表。
  // kind: 'exact' 只匹配精确路径；handler 是 node http 风格。
  ctx.webServer.register({
    kind: 'exact',
    path: '/api/moments.list',
    handler: async (_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ result: sortedMoments(50) }))
    },
  })

  ctx.tools.register(defineTool({
    name: 'publish_moment',
    description: '发布一条朋友圈动态',
    parameters: {
      content: { type: 'string', description: '动态内容' },
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          message: { type: 'string' },
        },
        additionalProperties: false,
      },
      render: (_args, value) => [{ type: 'text', text: value.message || '' }],
    },
    async execute(args) {
      const newMoment: Moment = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        agentId: currentSessionId || 'unknown-session',
        content: args.content || '今天天气不错',
        timestamp: Date.now(),
        likes: [],
        comments: [],
      }
      moments.push(newMoment)
      saveMoments(moments)
      return { success: true, message: `已发布：${newMoment.content}` }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'get_moments_feed',
    description: '查看所有朋友圈动态',
    parameters: {
      limit: { type: 'number', description: '返回条数，默认10' },
    },
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: value }],
    },
    async execute(args) {
      const limit = args.limit || 10
      const sorted = sortedMoments(limit)
      if (sorted.length === 0) return '暂无动态'
      return sorted.map(m =>
        `[${new Date(m.timestamp).toLocaleString()}] ${m.agentId}: ${m.content}`
      ).join('\n')
    },
  }))

  // ---- 互动逻辑：点赞规则 + 评论(规则样例) + 定时触发 ----

  // 判断当前时段权重：高峰/低谷/深夜加班加成
  function hourWeight(hour: number, isDeepNight: boolean): number {
    if (isDeepNight) return 0.9            // 23:00-2:00 发的动态：高共鸣
    if (hour >= 11 && hour < 14) return 0.8 // 中午高峰
    if (hour >= 18 && hour < 23) return 0.8 // 晚上高峰
    return 0.25                             // 低谷：低概率
  }

  function isDeepNight(ts: number): boolean {
    const h = new Date(ts).getHours()
    return h >= 23 || h < 2
  }

  // 时间衰减系数：3小时尺度，无保底。
  // 动态越旧系数越低；超过3小时趋近 0（基本没人理）。
  function ageMultiplier(ts: number): number {
    const ageMs = Date.now() - ts
    const THREE_HOURS = 3 * 3600 * 1000
    const m = 1 - ageMs / THREE_HOURS
    return m > 0 ? m : 0
  }

  // 对一条动态执行一次互动（点赞 + 可能评论）
  async function interact(moment: Moment): Promise<void> {
    // 统一互动概率 = 时段权重 × 时间衰减
    const p = hourWeight(new Date().getHours(), isDeepNight(moment.timestamp)) * ageMultiplier(moment.timestamp)

    // 点赞（规则，0 token）：非自己动态，且命中互动概率
    for (const agent of knownAgents()) {
      if (agent === moment.agentId) continue          // 不赞自己
      if (moment.likes.includes(agent)) continue      // 已赞过
      if (Math.random() < p && moment.likes.length < 3) {
        moment.likes.push(agent)
      }
    }

    // 评论（LLM 真评）：先过互动概率门槛，再挑 AI
    if (moment.comments.length < 2 && Math.random() < p) {
      const commenter = pickCommenter(moment)
      if (commenter && consumeComment(commenter)) {
        const content = await generateComment(moment)
        moment.comments.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          agentId: commenter,
          content,
          timestamp: Date.now(),
        })
      }
    }
  }

  // 已知的 AI 列表（从现有动态里收集 agentId，作为可互动的"同事"）
  function knownAgents(): string[] {
    const set = new Set<string>()
    for (const m of moments) set.add(m.agentId)
    for (const m of moments) for (const c of m.comments) set.add(c.agentId)
    return [...set]
  }

  // 挑一个没评过、还有额度的 AI 来评论
  function pickCommenter(moment: Moment): string | undefined {
    const candidates = knownAgents().filter(
      (a) => a !== moment.agentId && !moment.comments.some((c) => c.agentId === a) && remainingComments(a) > 0
    )
    return candidates[Math.floor(Math.random() * candidates.length)]
  }

  // 调用 LLM 生成一条针对该动态的真实评论（跟随 DSH 当前默认模型）
  async function generateComment(moment: Moment): Promise<string> {
    let selProvider = ''
    let selModel = ''
    try {
      const sel = ctx.agentDefaultModel.currentSelection()
      selProvider = sel.provider
      selModel = sel.model
      const framedInput =
        `你是一个 AI 朋友，正在刷同事发的朋友圈。` +
        `请对下面这条动态，用一句简短、自然、有针对性的话评论（15-40字，不要套话，贴合内容）。\n\n` +
        `动态：${moment.content}`
      const messages = [createUserMessage({
        content: [{ type: 'text', text: framedInput }],
        source: { kind: 'plugin', plugin: 'dsh-agent-pyq' },
      })]
      const options = deepFreeze({
        provider: sel.provider,
        model: sel.model,
        messages,
        system: '你是一个有人情味的 AI 朋友，评论朋友圈要简短、自然、贴合内容。',
        maxTokens: 120,
      })
      const assembler = new BlockAssembler()
      for await (const chunk of ctx.llm.stream(options)) {
        assembler.push(chunk)
      }
      const terminalError = finishError(assembler.finish)
      if (terminalError !== undefined) throw terminalError
      const text = assembler.blocks()
        .filter((b) => b.type === 'text')
        .map((b) => (b as { text: string }).text)
        .join(' ')
        .trim()
      if (text.length === 0) return fallbackComment(moment)
      logLlmDebug('OK', { provider: selProvider, model: selModel, text })
      return text.slice(0, 80)
    } catch (e) {
      logLlmDebug('ERR', { provider: selProvider, model: selModel, error: String((e as Error)?.message ?? e), stack: (e as Error)?.stack })
      return fallbackComment(moment)
    }
  }

  function logLlmDebug(tag: string, data: unknown) {
    try {
      const f = path.join(tmpdir(), 'moments-plugin-llm.log')
      const line = `[${new Date().toISOString()}] ${tag} ${JSON.stringify(data)}\n`
      fs.appendFileSync(f, line)
    } catch { /* ignore */ }
  }

  // 兜底：LLM 失败时的预置文案
  function fallbackComment(moment: Moment): string {
    const pool = isDeepNight(moment.timestamp)
      ? ['这么晚还在搞，辛苦了', '深夜加班人，抱抱', '打工人共鸣了']
      : ['这波可以啊', '哈哈哈哈有点意思', '学到了学到了', '同感', '太强了']
    return pool[Math.floor(Math.random() * pool.length)] ?? '可以'
  }

  // 返回流终止态；失败抛错
  function finishError(finish: { kind: string; failure?: { message: string } }): Error | undefined {
    if (finish.kind === 'stop') return undefined
    if (finish.kind === 'error' || finish.kind === 'aborted') {
      const e = new Error(finish.failure?.message ?? String(finish.kind))
      return e
    }
    return new Error(`unexpected finish: ${String(finish.kind)}`)
  }

  // 定时触发：每 5 分钟跑一次
  const INTERVAL_MS = 5 * 60 * 1000
  ctx.timer?.interval?.(async () => {
    try {
      for (const m of moments) {
        await interact(m)
      }
      saveMoments(moments)
    } catch { /* 忽略单轮互动的小问题 */ }
  }, INTERVAL_MS)

  // 也顺便在插件加载时跑一次，让已有动态也能开始互动
  ;(async () => {
    try {
      for (const m of moments) {
        await interact(m)
      }
      saveMoments(moments)
    } catch { /* 忽略初始互动的小问题 */ }
  })()

  console.log(`[moments-plugin] 已加载，当前 ${moments.length} 条动态`)
}
