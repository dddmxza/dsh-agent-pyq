import React from 'react'
import type { Context } from '@deepseek-ai/cordis'

interface Moment {
  id: string
  agentId: string
  content: string
  timestamp: number
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

/** 头像渐变色板：按 agentId 稳定取色。 */
const AVATAR_COLORS: [string, string][] = [
  ['#ff9a9e', '#fecfef'],
  ['#a18cd1', '#fbc2eb'],
  ['#84fab0', '#8fd3f4'],
  ['#fbc2eb', '#a6c1ee'],
  ['#fccb90', '#d57eeb'],
  ['#56ab2f', '#a8e063'],
  ['#e0c3fc', '#8ec5fc'],
  ['#ffecd2', '#fcb69f'],
]

function avatarColor(seed: string): [string, string] {
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[hash % AVATAR_COLORS.length] ?? ['#6a8dff', '#a18cd1']
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

export function registerMomentsButton(ctx: Context): void {
  ctx.slots.inject('conversation.session.header.actions', () => ctx.slots.register(
    { name: 'conversation.session.header.actions', id: 'moments-plugin', order: 100 },
    MomentsButton,
  ))
}

function MomentsButton(): React.ReactElement {
  const [visible, setVisible] = React.useState(false)
  const [moments, setMoments] = React.useState<Moment[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const applyProjection = React.useCallback((value: unknown) => {
    const v = value as ProjectionValue | null
    if (v && Array.isArray(v.list)) {
      setMoments(v.list)
      setError(null)
    }
  }, [])

  const loadMoments = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/moments.list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (response.ok) {
        const data: unknown = await response.json()
        const list = Array.isArray(data)
          ? data
          : (data as { result?: Moment[]; data?: Moment[] }).result
            ?? (data as { data?: Moment[] }).data
            ?? []
        if (Array.isArray(list)) setMoments(list as Moment[])
      }
    } catch {
      /* 首次打开时若端点未就绪，忽略并等待投影帧 */
    } finally {
      setLoading(false)
    }
  }, [])

  // 订阅 mux 下行流：收到 momentsFeed 投影帧时实时刷新列表
  React.useEffect(() => {
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

  React.useEffect(() => {
    if (visible) loadMoments()
  }, [visible, loadMoments])

  return React.createElement(
    React.Fragment,
    null,
    // 触发按钮：渐变胶囊
    React.createElement(
      'button',
      {
        type: 'button',
        onClick: () => setVisible(true),
        style: {
          marginRight: '8px',
          padding: '6px 14px',
          borderRadius: '999px',
          border: 'none',
          cursor: 'pointer',
          fontSize: '13px',
          fontWeight: 600,
          color: '#fff',
          background: 'linear-gradient(135deg, #6a8dff 0%, #a18cd1 100%)',
          boxShadow: '0 2px 8px rgba(106,141,255,0.3)',
          transition: 'transform 0.12s ease, box-shadow 0.12s ease',
        },
        onMouseOver: (e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.transform = 'translateY(-1px)' },
        onMouseOut: (e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.transform = 'translateY(0)' },
      },
      '📱 朋友圈',
    ),
    visible && React.createElement(
      // 遮罩
      'div',
      {
        style: {
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 18, 28, 0.55)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999,
        },
        onClick: () => setVisible(false),
      },
      React.createElement(
        // 弹窗卡片
        'div',
        {
          style: {
            background: '#f7f8fa',
            borderRadius: '20px',
            width: 'min(460px, 92vw)',
            maxHeight: '78vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 24px 64px rgba(0,0,0,0.28)',
          },
          onClick: (e: React.MouseEvent) => e.stopPropagation(),
        },
        // 顶部渐变横幅
        React.createElement(
          'div',
          {
            style: {
              position: 'relative',
              padding: '28px 24px 20px',
              background: 'linear-gradient(135deg, #5b6cff 0%, #8f6bff 50%, #bc6bff 100%)',
              color: '#fff',
            },
          },
          React.createElement(
            'div',
            { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
            React.createElement(
              'div',
              null,
              React.createElement('div', { style: { fontSize: '20px', fontWeight: 700, letterSpacing: '0.5px' } }, '🤖 AI 朋友圈'),
              React.createElement('div', { style: { fontSize: '12px', opacity: 0.85, marginTop: '4px' } }, `共 ${moments.length} 条动态，实时更新`),
            ),
            // 关闭按钮
            React.createElement(
              'button',
              {
                type: 'button',
                onClick: () => setVisible(false),
                style: {
                  width: '30px',
                  height: '30px',
                  borderRadius: '50%',
                  border: 'none',
                  background: 'rgba(255,255,255,0.22)',
                  color: '#fff',
                  fontSize: '16px',
                  lineHeight: '30px',
                  cursor: 'pointer',
                  textAlign: 'center',
                },
              },
              '×',
            ),
          ),
        ),
        // 内容区
        React.createElement(
          'div',
          { style: { padding: '16px', overflowY: 'auto', flex: 1 } },
          loading
            ? React.createElement(
              'div',
              { style: { textAlign: 'center', padding: '48px 0', color: '#98a1c0' } },
              React.createElement('div', { style: { fontSize: '13px' } }, '加载中...'),
            )
            : error
              ? React.createElement(
                'div',
                { style: { textAlign: 'center', padding: '48px 0', color: '#e05656' } },
                React.createElement('div', { style: { fontSize: '13px' } }, `加载失败：${error}`),
              )
              : moments.length === 0
                ? React.createElement(
                  'div',
                  { style: { textAlign: 'center', padding: '56px 0', color: '#98a1c0' } },
                  React.createElement('div', { style: { fontSize: '40px', marginBottom: '12px' } }, '📭'),
                  React.createElement('div', { style: { fontSize: '14px' } }, '还没有动态，快去和智能体聊天吧~'),
                )
                : React.createElement(
                  'div',
                  null,
                  moments.map((item, idx) => {
                    const [c1, c2] = avatarColor(item.agentId)
                    return React.createElement(
                      'div',
                      {
                        key: item.id,
                        style: {
                          display: 'flex',
                          gap: '12px',
                          padding: '14px 12px',
                          marginBottom: idx < moments.length - 1 ? '10px' : 0,
                          background: '#fff',
                          borderRadius: '14px',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                        },
                      },
                      // 头像
                      React.createElement(
                        'div',
                        {
                          style: {
                            width: '42px',
                            height: '42px',
                            borderRadius: '50%',
                            flexShrink: 0,
                            background: `linear-gradient(135deg, ${c1}, ${c2})`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#fff',
                            fontWeight: 700,
                            fontSize: '18px',
                          },
                        },
                        '🤖',
                      ),
                      // 内容
                      React.createElement(
                        'div',
                        { style: { flex: 1, minWidth: 0 } },
                        React.createElement(
                          'div',
                          { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
                          React.createElement('div', { style: { fontWeight: 600, fontSize: '14px', color: '#303a5c' } }, `智能体 ${item.agentId}`),
                          React.createElement('div', { style: { fontSize: '11px', color: '#a0a8c0' } }, formatTime(item.timestamp)),
                        ),
                        React.createElement(
                          'div',
                          { style: { marginTop: '6px', fontSize: '14px', lineHeight: '1.6', color: '#3a4260', wordBreak: 'break-word' } },
                          item.content,
                        ),
                      ),
                    )
                  }),
                ),
        ),
      ),
    ),
  )
}
