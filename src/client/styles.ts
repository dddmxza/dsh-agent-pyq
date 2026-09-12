/**
 * 客户端半边的一次性样式注入：所有 dtpl-* class 汇总在单个 <style> 里，
 * 颜色全部走主题变量（--dsw-alias-*，见 harness 的
 * ui-theme/src/styles/design-platform.css），深浅色自动适配。
 * @module dsh-agent-pyq/client/styles
 */

import { NAMESPACE } from './constants.ts'

/** tsconfig 没有 dom lib，这里声明用到的 DOM 形状。 */
declare const document: {
  createElement(tag: 'style'): { dataset: Record<string, string>; textContent: string }
  head: { appendChild(node: { dataset: Record<string, string>; textContent: string }): void }
}

let stylesInjected = false

/** 注入 <style data-plugin data-plugin-css>；client-modules 的 claimStyles 据此回收。 */
export function injectStyles(): void {
  if (stylesInjected || typeof document === 'undefined') return
  stylesInjected = true
  const tag = document.createElement('style')
  tag.dataset.plugin = NAMESPACE
  tag.dataset.pluginCss = `${NAMESPACE}/card`
  tag.textContent = `
.dtpl-card {
  list-style: none;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 12px;
  background: var(--dsw-alias-bg-layer-3);
  transition: border-color .16s, background .16s;
}
.dtpl-card:hover { border-color: var(--dsw-alias-label-dimmed); }
.dtpl-card-open { background: var(--dsw-alias-bg-layer-2); border-color: var(--dsw-alias-label-dimmed); }
.dtpl-header {
  width: 100%; appearance: none; border: 0; background: none; font: inherit;
  color: inherit; text-align: left; cursor: pointer;
  display: flex; align-items: center; gap: 12px;
  padding: 14px 16px; border-radius: 12px;
}
.dtpl-header:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: -2px; }
.dtpl-head-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.dtpl-name { font-size: 15px; font-weight: 600; line-height: 1.4; color: var(--dsw-alias-label-primary); }
.dtpl-description { font-size: 13px; line-height: 1.5; color: var(--dsw-alias-label-tertiary); }
/* 与内置 PluginCard 同款 chevron 图标（IconChevronDownOutline14）的样式。 */
.dtpl-chevron {
  flex: none; color: var(--dsw-alias-label-tertiary); transition: transform .16s;
}
.dtpl-chevron-open { transform: rotate(180deg); }
.dtpl-body { border-top: 1px solid var(--dsw-alias-border-l2); margin: 0 16px; padding-bottom: 8px; }
.dtpl-read-only { margin: 12px 0 0; font-size: 12px; line-height: 1.5; color: var(--dsw-alias-label-tertiary); }
.dtpl-pending {
  flex: none; border-radius: 999px; padding: 1px 8px; font-size: 11px; line-height: 17px;
  font-weight: 500; white-space: nowrap;
  background: var(--dsw-alias-bg-module-platform); color: var(--dsw-alias-label-secondary);
}
.dtpl-footer {
  display: flex; align-items: center; justify-content: flex-end; gap: 8px;
  padding: 12px 0 4px; border-top: 1px solid var(--dsw-alias-border-l2);
}
.dtpl-failed { flex: 1; min-width: 0; margin: 0; font-size: 12px; line-height: 1.5; color: var(--dsw-alias-state-error-primary); }
.dtpl-discard, .dtpl-save {
  appearance: none; border: 1px solid transparent; border-radius: 8px;
  padding: 5px 14px; font: inherit; font-size: 13px; line-height: 1.5; cursor: pointer;
}
.dtpl-discard { border-color: var(--dsw-alias-border-l2); background: none; color: var(--dsw-alias-label-secondary); }
.dtpl-discard:hover:not(:disabled) { color: var(--dsw-alias-label-primary); border-color: var(--dsw-alias-label-dimmed); }
.dtpl-save { background: var(--dsw-alias-label-primary); color: var(--dsw-alias-bg-layer-3); }
.dtpl-discard:disabled, .dtpl-save:disabled { opacity: 0.4; cursor: default; }
.dtpl-discard:focus-visible, .dtpl-save:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 1px; }
.dtpl-field { display: flex; flex-direction: column; gap: 6px; padding: 12px 0; }
.dtpl-field + .dtpl-field { border-top: 1px solid var(--dsw-alias-border-l2); }
.dtpl-field-head { display: flex; align-items: center; gap: 8px; }
.dtpl-label { flex: 1; min-width: 0; font-size: 13px; font-weight: 500; line-height: 1.5; color: var(--dsw-alias-label-primary); }
.dtpl-status { display: flex; flex-direction: column; gap: 6px; padding: 14px 16px; }
.dtpl-status-title { margin: 0; font-size: 14px; font-weight: 600; line-height: 1.4; color: var(--dsw-alias-label-primary); }
.dtpl-status-body { margin: 0; font-size: 12px; line-height: 1.6; color: var(--dsw-alias-label-tertiary); }
.dtpl-sidebar-action {
  appearance: none; border: 0; background: none; font: inherit;
  display: flex; align-items: center; gap: 8px; width: 100%;
  padding: 8px 12px; border-radius: 8px; text-align: left;
  font-size: 12px; line-height: 1.5; color: var(--dsw-alias-label-secondary); cursor: pointer;
}
.dtpl-sidebar-action:hover { background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); }
.dtpl-sidebar-action:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: -2px; }
.dtpl-sidebar-dot { flex: none; font-size: 10px; line-height: 1; }
.dtpl-dock {
  box-sizing: border-box;
  /* conversation.input.dock 渲染为全宽行；宽度/居中由条目自己负责。
     与内置 QueueDock 对齐输入卡片：内容列 = 卡片宽 - 4 个 dock inset（= 对话正文宽）。 */
  width: 100%;
  max-width: calc(var(--dsh-composer-card-max-width) - 4 * var(--dsh-composer-dock-inset));
  margin: 0 auto;
  display: flex; align-items: center; gap: 8px;
  padding: 8px 12px; font-size: 12px; line-height: 1.5; color: var(--dsw-alias-label-tertiary);
  border: 1px solid var(--dsw-alias-border-l2); border-radius: 12px;
  background: var(--dsw-alias-bg-layer-3);
}
.dtpl-dock-id { color: var(--dsw-alias-label-primary); font-weight: 500; }
.dtpl-overlay {
  /* shell.overlay 层只是 inset:0 的全框层、不提供条目布局——条目自己定位
     （toast 式：fixed 到右下角，避开导航与操作区）；层本身点击穿透，
     条目自行 opt-in 指针事件。 */
  position: fixed;
  right: 16px;
  bottom: 16px;
  display: flex; align-items: center; gap: 8px;
  padding: 6px 12px; border-radius: 999px;
  border: 1px solid var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-layer-3);
  font-size: 12px; line-height: 1.5; color: var(--dsw-alias-label-secondary);
  pointer-events: auto;
}
.dtpl-overlay-close {
  appearance: none; border: 0; background: none; padding: 0; font: inherit; cursor: pointer;
  font-size: 12px; line-height: 1; color: var(--dsw-alias-label-tertiary);
}
.dtpl-overlay-close:hover { color: var(--dsw-alias-label-primary); }
.dtpl-header-util {
  /* 会话头右侧工具徽标：非交互徽章（pill），背景走 platform 模块色。 */
  appearance: none; border: 0; background: var(--dsw-alias-bg-module-platform); font: inherit;
  padding: 3px 10px; border-radius: 999px; font-size: 12px; line-height: 1.5;
  color: var(--dsw-alias-label-secondary);
}
.dtpl-input-tool {
  appearance: none; border: 1px solid var(--dsw-alias-border-l2); background: none; font: inherit; cursor: pointer;
  height: 28px; padding: 0 10px; border-radius: 8px; font-size: 12px; line-height: 1.5;
  color: var(--dsw-alias-label-secondary); display: inline-flex; align-items: center; gap: 6px;
}
.dtpl-input-tool:hover { background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); }
.dtpl-command {
  display: flex; align-items: center; gap: 10px; min-width: 0;
  padding: 8px 12px; font-size: 13px; line-height: 1.5; color: var(--dsw-alias-label-primary);
  border: 1px solid var(--dsw-alias-border-l2); border-radius: 12px;
  background: var(--dsw-alias-bg-layer-3);
}
.dtpl-command-line { color: var(--dsw-alias-label-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dtpl-command-status { flex: none; font-size: 12px; color: var(--dsw-alias-label-tertiary); }
.dtpl-btn {
  appearance: none; border: 1px solid var(--dsw-alias-border-l2); background: none; font: inherit; cursor: pointer;
  height: 28px; padding: 0 10px; border-radius: 8px; font-size: 12px; line-height: 1.5;
  color: var(--dsw-alias-label-secondary); display: inline-flex; align-items: center; gap: 6px;
}
.dtpl-btn:hover { background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); }
.dtpl-btn:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 1px; }
.dtpl-general-row {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 10px 0; font-size: 13px; line-height: 1.5; color: var(--dsw-alias-label-primary);
}
.dtpl-general-row input[type='checkbox'] { width: 16px; height: 16px; accent-color: var(--dsw-alias-brand-primary); }
.dtpl-tab-content { padding: 16px; font-size: 13px; line-height: 1.6; color: var(--dsw-alias-label-secondary); }
.dtpl-tab-content p { margin: 0 0 8px; }
.dtpl-composer-strip {
  /* 照内置 StatsLine 的完整对齐：条在输入卡片列内 margin auto 居中，
     文字 text-align center（block 而非 flex，便于超长省略号）。 */
  box-sizing: border-box;
  display: block;
  text-align: center;
  width: 100%;
  max-width: var(--dsh-chat-content-width);
  margin: 0 auto;
  padding: 4px calc(var(--dsh-composer-side-clearance) + 16px) 0;
  font-size: 12px; line-height: 20px; color: var(--dsw-alias-label-tertiary);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.dtpl-badges { display: inline-flex; align-items: center; gap: 8px; }
.dtpl-badge {
  border-radius: 999px; padding: 1px 8px; font-size: 11px; line-height: 17px; white-space: nowrap; font-weight: 500;
  background: var(--dsw-alias-bg-module-platform); color: var(--dsw-alias-label-secondary);
}
.dtpl-reset { border: none; background: none; padding: 0; font: inherit; font-size: 12px; line-height: 1.5; color: var(--dsw-alias-label-secondary); cursor: pointer; }
.dtpl-reset:hover:not(:disabled) { color: var(--dsw-alias-label-primary); }
.dtpl-reset:disabled { cursor: default; }
.dtpl-input {
  height: 34px; padding: 0 12px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 8px;
  background: var(--dsw-alias-bg-layer-3); font: inherit; font-size: 13px; line-height: 1.5;
  color: var(--dsw-alias-label-primary);
}
.dtpl-input:focus-visible { outline: none; border-color: var(--dsw-alias-brand-primary); }
.dtpl-input:disabled { color: var(--dsw-alias-label-tertiary); cursor: default; }
.dtpl-input-invalid { border-color: var(--dsw-alias-state-error-primary); }
.dtpl-checkbox { width: 16px; height: 16px; accent-color: var(--dsw-alias-brand-primary); }
.dtpl-invalid { margin: 0; font-size: 12px; line-height: 1.5; color: var(--dsw-alias-state-error-primary); }
.dtpl-hint { margin: 0; font-size: 12px; line-height: 1.5; color: var(--dsw-alias-label-tertiary); }

/* ==========================================================================
   AI 朋友圈（moments-button.tsx）
   配色一律走主题变量，深/浅色自动适配；唯一固定色是封面渐变本身，
   因为那是这个弹窗的"朋友圈封面"身份，两个主题下都成立。
   ========================================================================== */

/* ---- 会话头触发按钮 ---- */
.dtpl-moments-trigger {
  appearance: none; font: inherit; cursor: pointer;
  display: inline-flex; align-items: center; gap: 6px;
  height: 28px; margin-right: 8px; padding: 0 10px;
  border-radius: 999px;
  border: 1px solid var(--dsw-alias-border-l2);
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-secondary);
  font-size: 12px; line-height: 1.5; font-weight: 500;
  transition: background .16s, color .16s, border-color .16s, transform .12s;
}
.dtpl-moments-trigger:hover {
  background: var(--dsw-alias-interactive-bg-hover);
  border-color: var(--dsw-alias-label-dimmed);
  color: var(--dsw-alias-label-primary);
}
.dtpl-moments-trigger:active { transform: scale(.97); }
.dtpl-moments-trigger:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 1px; }
.dtpl-moments-trigger-icon { font-size: 13px; line-height: 1; }
.dtpl-moments-count {
  min-width: 16px; height: 16px; padding: 0 5px; box-sizing: border-box;
  display: inline-flex; align-items: center; justify-content: center;
  border-radius: 999px; font-size: 10px; font-weight: 600; line-height: 1;
  background: var(--dsw-alias-bg-module-platform);
  color: var(--dsw-alias-label-secondary);
}

/* ---- 遮罩与面板（对齐宿主内置弹窗：同款 mask / 面板层级 / 阴影 / 滚动条变量） ---- */
.dtpl-moments-overlay {
  position: fixed; inset: 0; z-index: 1000;
  display: flex; align-items: center; justify-content: center;
  padding: 24px;
  background: var(--dsw-alias-bg-mask-2);
  backdrop-filter: var(--dsw-mask-blur);
  animation: dtpl-moments-fade .16s ease-out;
}
.dtpl-moments-panel {
  position: relative; display: flex; flex-direction: column;
  width: min(468px, 100%);
  max-height: min(78vh, 760px);
  overflow: hidden;
  border-radius: 20px;
  background: var(--dsw-alias-bg-layer-2);
  box-shadow: var(--dsw-elevation-prominent);
  animation: dtpl-moments-pop .22s cubic-bezier(.22, .9, .3, 1.1);
}
.dtpl-moments-panel:focus { outline: none; }
@keyframes dtpl-moments-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes dtpl-moments-pop {
  from { opacity: 0; transform: translateY(14px) scale(.97); }
  to { opacity: 1; transform: none; }
}

/* ---- 封面 ---- */
.dtpl-moments-cover {
  position: relative; flex: none;
  padding: 20px 20px 18px;
  color: #fff;
  background:
    radial-gradient(130% 170% at 8% -30%, rgba(255, 255, 255, .30), rgba(255, 255, 255, 0) 62%),
    linear-gradient(135deg, #5b6cff 0%, #8f6bff 52%, #c46bff 100%);
}
.dtpl-moments-cover-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.dtpl-moments-cover-title {
  display: flex; align-items: center; gap: 8px;
  font-size: 19px; font-weight: 700; letter-spacing: .3px; line-height: 1.3;
}
.dtpl-moments-cover-sub {
  display: flex; align-items: center; gap: 10px;
  margin-top: 7px; font-size: 12px; line-height: 1.5; opacity: .9;
}
.dtpl-moments-live { display: inline-flex; align-items: center; gap: 5px; }
.dtpl-moments-live-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: #6ee7a8;
  box-shadow: 0 0 0 0 rgba(110, 231, 168, .75);
  animation: dtpl-moments-live 1.8s ease-out infinite;
}
@keyframes dtpl-moments-live {
  70% { box-shadow: 0 0 0 6px rgba(110, 231, 168, 0); }
  100% { box-shadow: 0 0 0 0 rgba(110, 231, 168, 0); }
}
.dtpl-moments-close {
  flex: none; width: 28px; height: 28px;
  display: inline-flex; align-items: center; justify-content: center;
  appearance: none; border: 0; padding: 0; cursor: pointer;
  border-radius: 50%;
  background: rgba(255, 255, 255, .2); color: #fff;
  font: inherit; font-size: 13px; line-height: 1;
  transition: background .16s, transform .12s;
}
.dtpl-moments-close:hover { background: rgba(255, 255, 255, .34); }
.dtpl-moments-close:active { transform: scale(.92); }
.dtpl-moments-close:focus-visible { outline: 2px solid rgba(255, 255, 255, .8); outline-offset: 2px; }

/* ---- 列表 ---- */
.dtpl-moments-scroll {
  flex: 1; min-height: 0; overflow-y: auto;
  display: flex; flex-direction: column; gap: 10px;
  padding: 14px;
  /* 宿主滚动条变量在面板范围内覆盖一次，与内置弹窗同款观感 */
  --dsh-scrollbar-thumb: var(--dsw-alias-scrollbar-bg-l2);
  --dsh-scrollbar-thumb-hover: var(--dsw-alias-scrollbar-hover-l2);
  scrollbar-width: thin;
  scrollbar-color: var(--dsh-scrollbar-thumb) transparent;
}
.dtpl-moments-scroll::-webkit-scrollbar { width: 8px; }
.dtpl-moments-scroll::-webkit-scrollbar-thumb {
  background: var(--dsh-scrollbar-thumb); border-radius: 999px;
}
.dtpl-moments-scroll::-webkit-scrollbar-thumb:hover { background: var(--dsh-scrollbar-thumb-hover); }

/* 动态卡片：与宿主内置卡片同款「bg-layer-3 + elevation-stroke」的浮起方式 */
.dtpl-moments-item {
  display: flex; gap: 10px;
  padding: 12px;
  border-radius: 14px;
  background: var(--dsw-alias-bg-layer-3);
  box-shadow: var(--dsw-elevation-stroke);
  transition: background .16s;
  animation: dtpl-moments-in .26s ease-out backwards;
}
.dtpl-moments-item:hover { background: var(--dsw-alias-interactive-bg-hover); }
@keyframes dtpl-moments-in {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: none; }
}
.dtpl-moments-avatar {
  flex: none; width: 38px; height: 38px; border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-size: 15px; font-weight: 700; line-height: 1;
  user-select: none;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .18);
}
.dtpl-moments-body { flex: 1; min-width: 0; }
.dtpl-moments-line { display: flex; align-items: baseline; gap: 8px; }
.dtpl-moments-name {
  min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font-size: 13px; font-weight: 600; color: var(--dsw-alias-link);
}
.dtpl-moments-time { flex: none; margin-left: auto; font-size: 11px; color: var(--dsw-alias-label-caption); }
.dtpl-moments-text {
  margin-top: 4px; font-size: 14px; line-height: 1.62;
  color: var(--dsw-alias-label-primary);
  white-space: pre-wrap; overflow-wrap: anywhere;
}

/* 点赞/评论气泡：微信用的是从头像方向支出小尖角的浅色气泡 */
.dtpl-moments-bubble {
  position: relative; margin-top: 8px;
  padding: 7px 10px;
  border-radius: 8px;
  background: var(--dsw-alias-interactive-bg-hover);
}
.dtpl-moments-bubble::before {
  content: ''; position: absolute; top: -4px; left: 12px;
  width: 8px; height: 8px; border-radius: 2px;
  background: inherit; transform: rotate(45deg);
}
.dtpl-moments-likes {
  display: flex; align-items: center; gap: 6px;
  font-size: 12px; line-height: 1.6; color: var(--dsw-alias-label-secondary);
}
.dtpl-moments-likes-icon { flex: none; font-size: 11px; line-height: 1; }
.dtpl-moments-likes-names {
  min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.dtpl-moments-divider { height: 1px; margin: 6px 0; background: var(--dsw-alias-border-l2); }
.dtpl-moments-comment { font-size: 12px; line-height: 1.65; color: var(--dsw-alias-label-primary); overflow-wrap: anywhere; }
.dtpl-moments-comment + .dtpl-moments-comment { margin-top: 3px; }
.dtpl-moments-comment-name { font-weight: 600; color: var(--dsw-alias-link); }

/* ---- 空 / 加载 / 出错 ---- */
.dtpl-moments-state {
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px;
  padding: 52px 16px; text-align: center;
}
.dtpl-moments-state-icon { font-size: 40px; line-height: 1; }
.dtpl-moments-state-title { font-size: 14px; font-weight: 600; color: var(--dsw-alias-label-secondary); }
.dtpl-moments-state-hint { max-width: 260px; font-size: 12px; line-height: 1.6; color: var(--dsw-alias-label-tertiary); }
.dtpl-moments-retry {
  appearance: none; font: inherit; cursor: pointer;
  height: 30px; padding: 0 14px; margin-top: 2px;
  border: 1px solid var(--dsw-alias-border-l2); border-radius: 8px;
  background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary);
  font-size: 12px; line-height: 1.5;
  transition: background .16s, border-color .16s;
}
.dtpl-moments-retry:hover { background: var(--dsw-alias-interactive-bg-hover); border-color: var(--dsw-alias-label-dimmed); }
.dtpl-moments-retry:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 1px; }

.dtpl-moments-skeleton {
  display: flex; gap: 10px; padding: 12px;
  border-radius: 14px;
  background: var(--dsw-alias-bg-layer-3);
  box-shadow: var(--dsw-elevation-stroke);
}
.dtpl-moments-skeleton-avatar {
  flex: none; width: 38px; height: 38px; border-radius: 12px;
  background: var(--dsw-alias-bg-skeleton);
}
.dtpl-moments-skeleton-lines { flex: 1; display: flex; flex-direction: column; gap: 9px; padding-top: 4px; }
.dtpl-moments-skeleton-bar {
  height: 10px; border-radius: 999px;
  background: var(--dsw-alias-bg-skeleton);
  animation: dtpl-moments-pulse 1.4s ease-in-out infinite;
}
.dtpl-moments-skeleton-bar-short { width: 42%; }
@keyframes dtpl-moments-pulse { 0%, 100% { opacity: .55; } 50% { opacity: 1; } }

/* ---- 窄屏与动效偏好 ---- */
@media (max-width: 560px) {
  .dtpl-moments-overlay { padding: 12px; align-items: flex-end; }
  .dtpl-moments-panel { max-height: 88vh; border-radius: 18px; }
}
@media (prefers-reduced-motion: reduce) {
  .dtpl-moments-overlay,
  .dtpl-moments-panel,
  .dtpl-moments-item,
  .dtpl-moments-live-dot,
  .dtpl-moments-skeleton-bar { animation: none; }
  .dtpl-moments-trigger,
  .dtpl-moments-close { transition: none; }
}
`
  document.head.appendChild(tag)
}
