// 构建产物冒烟测试：验证朋友圈插件（moments-plugin）注册了发圈工具、
// 注册了 systemPrompt 行为规则、webServer 路由、sessionProjections 投影。
// 运行：node test/smoke.mjs（先 pnpm build）
import assert from 'node:assert/strict'
import { name, inject, apply } from '../lib/index.js'

// 最小可用的 ctx：只实现本插件用到的成员
const registeredTools = []
const sections = []
const routeRegistrations = []
const projections = []

const ctx = {
  tools: {
    register(definition) { registeredTools.push(definition) },
  },
  systemPrompt: {
    section(options) { sections.push(options) },
  },
  webServer: {
    register(route) { routeRegistrations.push(route) },
  },
  sessionProjections: {
    register(def) { projections.push(def) },
  },
  on() { return () => {} },
  effect() { return () => {} },
  inject() { return () => {} },
}

apply(ctx)

assert.equal(name, 'moments-plugin')
assert.deepEqual(inject, ['tools', 'sessionProjections', 'webServer', 'systemPrompt'])

// publish_moment / get_moments_feed 工具
const pub = registeredTools.find((t) => t.name === 'publish_moment')
assert.ok(pub, 'publish_moment tool should be registered')
assert.equal(typeof pub.execute, 'function')

const feed = registeredTools.find((t) => t.name === 'get_moments_feed')
assert.ok(feed, 'get_moments_feed tool should be registered')
assert.equal(typeof feed.execute, 'function')

// systemPrompt 行为规则
assert.ok(sections.some((s) => s.name === 'moments:behavior'), 'moments:behavior section should be registered')
assert.ok(sections.some((s) => s.text.includes('朋友圈发布规则')), 'behavior section should carry the rules')

// webServer 路由
assert.ok(routeRegistrations.some((r) => r.path === '/api/moments.list'), 'moments.list route should be registered')

// sessionProjections 投影
assert.ok(projections.some((p) => p.key === 'momentsFeed'), 'momentsFeed projection should be registered')

console.log('smoke ok')
