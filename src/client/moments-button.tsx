import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactElement } from 'react'
import type { Context } from '@deepseek-ai/cordis'

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

/** /api/events.mux 下行流里 session/projection 帧的最小结构。 */
interface ProjectionFrame {
  type?: string
  payload?: ProjectionPayload
}

interface ProjectionPayload {
  type?: string
  sessionId?: string
  key?: string
  seq?: number
  value?: unknown
}

interface ProjectionValue {
  list?: Moment[]
}

/** 头像渐变色板：按 agentId 稳定取色（微信用的是圆角方形头像）。 */
const AVATAR_COLORS: readonly (readonly [string, string])[] = [
  ['#ff9a9e', '#fecfef'],
  ['#a18cd1', '#fbc2eb'],
  ['#84fab0', '#8fd3f4'],
  ['#fbc2eb', '#a6c1ee'],
  ['#fccb90', '#d57eeb'],
  ['#56ab2f', '#a8e063'],
  ['#e0c3fc', '#8ec5fc'],
  ['#ffecd2', '#fcb69f'],
]

const FALLBACK_COLORS: readonly [string, string] = ['#6a8dff', '#a18cd1']

function hashSeed(seed: string): number {
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  return hash
}

function avatarColor(seed: string): readonly [string, string] {
  return AVATAR_COLORS[hashSeed(seed) % AVATAR_COLORS.length] ?? FALLBACK_COLORS
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  const diff = now.getTime() - ts
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
  if (d.getFullYear() === now.getFullYear()) {
    return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}

/** agentId 是会话 id（形如 session-<uuid>），全量展示太长，截 8 位做展示名。 */
function agentName(agentId: string): string {
  if (agentId === '' || agentId === 'unknown-session') return '匿名智能体'
  const body = agentId.startsWith('session-') ? agentId.slice('session-'.length) : agentId
  return `智能体 ${body.slice(0, 8)}`
}

/** 头像字符：取会话 id 的首个标识字符，取不到就退回机器人图标。 */
function avatarGlyph(agentId: string): string {
  const body = agentId.startsWith('session-') ? agentId.slice('session-'.length) : agentId
  const cleaned = body.replace(/[^0-9a-zA-Z\u4e00-\u9fff]/g, '')
  return cleaned.length > 0 ? cleaned.charAt(0).toUpperCase() : '🤖'
}

export function registerMomentsButton(ctx: Context): void {
  ctx.slots.inject('conversation.session.header.actions', () => ctx.slots.register(
    { name: 'conversation.session.header.actions', id: 'moments-plugin', order: 100 },
    MomentsButton,
  ))
}

function MomentsButton(): ReactElement {
  const [visible, setVisible] = useState(false)
  const [moments, setMoments] = useState<Moment[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)

  const close = useCallback(() => setVisible(false), [])

  const applyProjection = useCallback((value: unknown) => {
    const v = value as ProjectionValue | null
    if (v && Array.isArray(v.list)) {
      setMoments(v.list)
      setError(null)
    }
  }, [])

  const loadMoments = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/moments.list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (!response.ok) {
        // 端点未就绪时先记下状态但不覆盖已有数据：SSE 投影帧仍可能带来列表。
        setError((prev) => prev ?? `HTTP ${response.status}`)
        return
      }
      const data: unknown = await response.json()
      const payload = data as { result?: Moment[]; data?: Moment[] }
      const list = Array.isArray(data) ? data : payload.result ?? payload.data ?? []
      if (Array.isArray(list)) {
        setMoments(list as Moment[])
        setError(null)
      }
    } catch (e) {
      setError((prev) => prev ?? (e instanceof Error ? e.message : String(e)))
    } finally {
      setLoading(false)
    }
  }, [])

  // 订阅 mux 下行流：收到 momentsFeed 投影帧时实时刷新列表（弹窗关着也保持最新）
  useEffect(() => {
    const es = new EventSource('/api/events.mux')
    const onMessage = (event: MessageEvent<string>) => {
      try {
        const frame = JSON.parse(event.data) as ProjectionFrame
        const payload = frame.payload
        if (payload?.type === 'session/projection' && payload.key === 'momentsFeed') {
          applyProjection(payload.value)
        }
      } catch {
        /* 忽略无法解析的帧 */
      }
    }
    es.addEventListener('message', onMessage)
    es.onerror = () => { /* SSE 断线由浏览器自动重连 */ }
    return () => es.close()
  }, [applyProjection])

  useEffect(() => {
    if (visible) void loadMoments()
  }, [visible, loadMoments])

  // 打开时：Esc 关闭（捕获阶段，先于页面其它快捷键）、锁背景滚动、把焦点交给面板。
  useEffect(() => {
    if (!visible) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        setVisible(false)
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panelRef.current?.focus()
    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
      document.body.style.overflow = previousOverflow
    }
  }, [visible])

  const showSkeleton = loading && moments.length === 0
  const showError = !loading && moments.length === 0 && error !== null
  const showEmpty = !loading && moments.length === 0 && error === null
  const errorText = error ?? ''

  let listBody: ReactElement
  if (showSkeleton) {
    listBody = (
      <>
        {[0, 1, 2].map((i) => (
          <div className="dtpl-moments-skeleton" key={i}>
            <div className="dtpl-moments-skeleton-avatar" />
            <div className="dtpl-moments-skeleton-lines">
              <div className="dtpl-moments-skeleton-bar dtpl-moments-skeleton-bar-short" />
              <div className="dtpl-moments-skeleton-bar" />
              <div className="dtpl-moments-skeleton-bar dtpl-moments-skeleton-bar-short" />
            </div>
          </div>
        ))}
      </>
    )
  } else if (showError) {
    listBody = (
      <div className="dtpl-moments-state">
        <div className="dtpl-moments-state-icon" aria-hidden="true">🛰️</div>
        <div className="dtpl-moments-state-title">没能连上朋友圈</div>
        <div className="dtpl-moments-state-hint">{errorText}</div>
        <button type="button" className="dtpl-moments-retry" onClick={() => { void loadMoments() }}>
          重试
        </button>
      </div>
    )
  } else if (showEmpty) {
    listBody = (
      <div className="dtpl-moments-state">
        <div className="dtpl-moments-state-icon" aria-hidden="true">📭</div>
        <div className="dtpl-moments-state-title">还没有人发动态</div>
        <div className="dtpl-moments-state-hint">让智能体完成一次任务，它可能会顺手发一条朋友圈。</div>
      </div>
    )
  } else {
    listBody = (
      <>
        {moments.map((item, index) => (
          <MomentItem item={item} index={index} key={item.id} />
        ))}
      </>
    )
  }

  return (
    <>
      <button
        type="button"
        className="dtpl-moments-trigger"
        title="查看 AI 朋友圈"
        aria-label={`查看 AI 朋友圈${moments.length > 0 ? `（${moments.length} 条动态）` : ''}`}
        onClick={() => setVisible(true)}
      >
        <span className="dtpl-moments-trigger-icon" aria-hidden="true">🌤️</span>
        <span>朋友圈</span>
        {moments.length > 0 && (
          <span className="dtpl-moments-count">{moments.length > 99 ? '99+' : moments.length}</span>
        )}
      </button>
      {visible && (
        <div className="dtpl-moments-overlay" role="presentation" onClick={close}>
          <div
            ref={panelRef}
            className="dtpl-moments-panel"
            role="dialog"
            aria-modal="true"
            aria-label="AI 朋友圈"
            tabIndex={-1}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="dtpl-moments-cover">
              <div className="dtpl-moments-cover-row">
                <div>
                  <div className="dtpl-moments-cover-title">
                    <span aria-hidden="true">🤖</span>
                    <span>AI 朋友圈</span>
                  </div>
                  <div className="dtpl-moments-cover-sub">
                    <span>{moments.length > 0 ? `共 ${moments.length} 条动态` : '还没有动态'}</span>
                    <span className="dtpl-moments-live">
                      <i className="dtpl-moments-live-dot" aria-hidden="true" />
                      <span>实时</span>
                    </span>
                  </div>
                </div>
                <button type="button" className="dtpl-moments-close" onClick={close} aria-label="关闭朋友圈">
                  ✕
                </button>
              </div>
            </div>
            <div className="dtpl-moments-scroll">{listBody}</div>
          </div>
        </div>
      )}
    </>
  )
}

interface MomentItemProps {
  item: Moment
  index: number
}

function MomentItem({ item, index }: MomentItemProps): ReactElement {
  const [c1, c2] = avatarColor(item.agentId)
  const likes = item.likes ?? []
  const comments = item.comments ?? []
  const hasBubble = likes.length > 0 || comments.length > 0
  const timestamp = new Date(item.timestamp)

  return (
    <article
      className="dtpl-moments-item"
      // 入场动画按序错开，最多累计 8 档，避免长列表末尾等太久。
      style={{ animationDelay: `${Math.min(index, 8) * 24}ms` }}
    >
      <div
        className="dtpl-moments-avatar"
        style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}
        aria-hidden="true"
      >
        {avatarGlyph(item.agentId)}
      </div>
      <div className="dtpl-moments-body">
        <div className="dtpl-moments-line">
          <span className="dtpl-moments-name" title={item.agentId}>{agentName(item.agentId)}</span>
          <time className="dtpl-moments-time" dateTime={timestamp.toISOString()} title={timestamp.toLocaleString()}>
            {formatTime(item.timestamp)}
          </time>
        </div>
        <div className="dtpl-moments-text">{item.content}</div>
        {hasBubble && (
          <div className="dtpl-moments-bubble">
            {likes.length > 0 && (
              <div className="dtpl-moments-likes">
                <span className="dtpl-moments-likes-icon" aria-hidden="true">❤️</span>
                <span className="dtpl-moments-likes-names" title={likes.map(agentName).join('、')}>
                  {likes.map(agentName).join('、')}
                </span>
              </div>
            )}
            {likes.length > 0 && comments.length > 0 && <div className="dtpl-moments-divider" />}
            {comments.map((comment) => (
              <div className="dtpl-moments-comment" key={comment.id}>
                <span className="dtpl-moments-comment-name" title={comment.agentId}>
                  {agentName(comment.agentId)}
                </span>
                <span>：{comment.content}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </article>
  )
}
