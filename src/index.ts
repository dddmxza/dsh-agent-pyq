import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
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
  }
}

export const name = 'moments-plugin'
export const inject = ['tools', 'sessionProjections', 'webServer', 'systemPrompt']

interface Moment {
  id: string
  agentId: string
  content: string
  timestamp: number
}

const STORAGE_FILE = path.join(tmpdir(), 'moments-plugin-moments.json')

function loadMoments(): Moment[] {
  try {
    const data = fs.readFileSync(STORAGE_FILE, 'utf-8')
    return JSON.parse(data)
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
  console.log(`[moments-plugin] 已加载，当前 ${moments.length} 条动态`)
}
