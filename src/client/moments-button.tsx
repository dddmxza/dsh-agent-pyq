import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactElement } from 'react'
import type { Context } from '@deepseek-ai/cordis'

interface Comment {
  id: string
  agentId: string
  content: string
  timestamp: number
  /** 写这条评论时解析出的展示名（服务端快照）；老记录没有 → 回退 agentName */
  displayName?: string
  /** 回复的父评论 id；缺省 = 顶层评论 */
  replyTo?: string
  /** 父评论作者的展示名（服务端快照） */
  replyToName?: string
}

interface Moment {
  id: string
  agentId: string
  content: string
  timestamp: number
  likes: string[]
  comments: Comment[]
  /** 发布时解析出的展示名（服务端快照）；老记录没有 → 回退 agentName */
  displayName?: string
  /** { [agentId]: displayName }：点赞者的展示名（解决"只点赞没发过帖"显示哈希） */
  likerNames?: Record<string, string>
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

/**
 * 头像渐变色板：按展示名稳定取色（微信用的是圆角方形头像）。
 * 每个色对的第一档都压在中深区间 —— 旧色板里的 ['#ff9a9e', '#fecfef'] 这类
 * 浅色配白色首字几乎读不出来，深色主题下也偏荧光。
 */
const AVATAR_COLORS: readonly (readonly [string, string])[] = [
  ['#7c8ce8', '#a79bf0'],
  ['#e5839b', '#f0aebe'],
  ['#5cbf9a', '#8fd9bb'],
  ['#e0a06a', '#f0c399'],
  ['#6fb6d9', '#9fd4ea'],
  ['#a081e0', '#c3aaf0'],
  ['#d97fa8', '#eda6c6'],
  ['#5f9f7f', '#8cc4a6'],
]

const FALLBACK_COLORS: readonly [string, string] = ['#7c8ce8', '#a79bf0']

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

/**
 * 兜底展示名：服务端没给 displayName 时（老记录、或无预设会话）用。
 * agentId 是会话 id（形如 session-<uuid>），全量展示太长，截 8 位。
 */
function agentName(agentId: string): string {
  if (agentId === '' || agentId === 'unknown-session') return '匿名智能体'
  const body = agentId.startsWith('session-') ? agentId.slice('session-'.length) : agentId
  return `智能体 ${body.slice(0, 8)}`
}

/**
 * agentId → 角色名。服务端在发布/评论/点赞时把展示名快照进每条记录，
 * 这里只做累积与查找：先看记过的名字，没记过才退回 agentName 的哈希显示。
 * 名单来源只有 feed 与列表接口 —— 不需要额外请求。
 */
const DISPLAY_NAMES = new Map<string, string>()

function rememberNames(list: readonly Moment[] | undefined): void {
  if (!Array.isArray(list)) return
  for (const item of list) {
    if (!item) continue
    if (item.agentId && item.displayName) DISPLAY_NAMES.set(item.agentId, item.displayName)
    const likerNames = item.likerNames ?? {}
    for (const [id, name] of Object.entries(likerNames)) {
      if (typeof name === 'string' && name !== '') DISPLAY_NAMES.set(id, name)
    }
    for (const comment of item.comments ?? []) {
      if (comment?.agentId && comment.displayName) DISPLAY_NAMES.set(comment.agentId, comment.displayName)
    }
  }
}

function nameOf(agentId: string): string {
  return DISPLAY_NAMES.get(agentId) ?? agentName(agentId)
}

/** 头像字符：取展示名的首个标识字符，取不到就退回机器人图标。 */
function avatarGlyph(display: string): string {
  const cleaned = display.replace(/[^0-9a-zA-Z\u4e00-\u9fff]/g, '')
  return cleaned.length > 0 ? cleaned.charAt(0).toUpperCase() : '🤖'
}

/**
 * 内联 SVG 图标：一律 currentColor + 固定像素尺寸。原来用 emoji，跨平台的字形、
 * 基线、彩色样式都不一样，和宿主那套 14px 线性图标也搭不上。
 */
function IconMoments(): ReactElement {
  return (
    <svg
      className="dtpl-moments-icon" width="14" height="14" viewBox="0 0 16 16"
      fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" focusable="false"
    >
      <rect x="1.8" y="2.8" width="12.4" height="10.4" rx="2.4" />
      <circle cx="5.6" cy="6.4" r="1.1" />
      <path d="M2.6 11.7 6.3 8.3 8.9 10.6 11 8.7 13.4 11.2" />
    </svg>
  )
}

function IconRobot(): ReactElement {
  return (
    <svg
      className="dtpl-moments-icon" width="16" height="16" viewBox="0 0 16 16"
      fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" focusable="false"
    >
      <rect x="2.8" y="5.2" width="10.4" height="7.6" rx="2.2" />
      <path d="M8 2.4v2.8" />
      <circle cx="6.1" cy="8.8" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="9.9" cy="8.8" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  )
}

function IconClose(): ReactElement {
  return (
    <svg
      className="dtpl-moments-icon" width="14" height="14" viewBox="0 0 16 16"
      fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"
      aria-hidden="true" focusable="false"
    >
      <path d="M4.2 4.2 11.8 11.8M11.8 4.2 4.2 11.8" />
    </svg>
  )
}

function IconHeart(): ReactElement {
  return (
    <svg
      className="dtpl-moments-icon" width="12" height="12" viewBox="0 0 16 16"
      fill="currentColor" aria-hidden="true" focusable="false"
    >
      <path d="M8 13.1c-.4 0-5.7-3.4-5.7-7.1A3.1 3.1 0 0 1 8 4.3a3.1 3.1 0 0 1 5.7 1.7c0 3.7-5.3 7.1-5.7 7.1Z" />
    </svg>
  )
}

function IconEmptyBox(): ReactElement {
  return (
    <svg
      className="dtpl-moments-icon" width="30" height="30" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" focusable="false"
    >
      <path d="M3.4 9.4 12 4.2l8.6 5.2v9.2a1.4 1.4 0 0 1-1.4 1.4H4.8a1.4 1.4 0 0 1-1.4-1.4Z" />
      <path d="M3.6 9.8h16.8" />
      <path d="M9.6 13.8h4.8" />
    </svg>
  )
}

function IconOffline(): ReactElement {
  return (
    <svg
      className="dtpl-moments-icon" width="30" height="30" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" focusable="false"
    >
      <circle cx="12" cy="12" r="8.2" />
      <path d="M12 7.4v5.2" />
      <circle cx="12" cy="16.2" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  )
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
      rememberNames(v.list)
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
        rememberNames(list as Moment[])
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
        <div className="dtpl-moments-state-icon" aria-hidden="true"><IconOffline /></div>
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
        <div className="dtpl-moments-state-icon" aria-hidden="true"><IconEmptyBox /></div>
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
        <span className="dtpl-moments-trigger-icon" aria-hidden="true"><IconMoments /></span>
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
                    <span aria-hidden="true"><IconRobot /></span>
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
                  <IconClose />
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
  const display = nameOf(item.agentId)
  const [c1, c2] = avatarColor(display)
  const likes = item.likes ?? []
  const comments = item.comments ?? []
  const likeNames = likes.map((id) => nameOf(id)).join('、')
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
        {avatarGlyph(display)}
      </div>
      <div className="dtpl-moments-body">
        <div className="dtpl-moments-line">
          {/* title 保留原始 agentId：悬停能看到会话哈希，方便排查 */}
          <span className="dtpl-moments-name" title={item.agentId}>{display}</span>
          <time className="dtpl-moments-time" dateTime={timestamp.toISOString()} title={timestamp.toLocaleString()}>
            {formatTime(item.timestamp)}
          </time>
        </div>
        <div className="dtpl-moments-text">{item.content}</div>
        {hasBubble && (
          <div className="dtpl-moments-bubble">
            {likes.length > 0 && (
              <div className="dtpl-moments-likes">
                <span className="dtpl-moments-likes-icon" aria-hidden="true"><IconHeart /></span>
                <span className="dtpl-moments-likes-names" title={likeNames}>
                  {likeNames}
                </span>
              </div>
            )}
            {likes.length > 0 && comments.length > 0 && <div className="dtpl-moments-divider" />}
            {comments.map((comment) => (
              <div className="dtpl-moments-comment" key={comment.id}>
                <span className="dtpl-moments-comment-name" title={comment.agentId}>
                  {nameOf(comment.agentId)}
                </span>
                {comment.replyTo ? (
                  <span className="dtpl-moments-comment-rel"> 回复 {comment.replyToName || '某人'}</span>
                ) : null}
                <span>：{comment.content}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </article>
  )
}
