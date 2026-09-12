import type { Context } from '@deepseek-ai/cordis'
import { registerMomentsButton } from './moments-button.tsx'
import { injectStyles } from './styles.ts'

export const inject = ['slots']

export function apply(ctx: Context): void {
  // 一次性注入 <style>：朋友圈弹窗与触发按钮全部靠 class 着色（主题变量），
  // 这样深浅色自动适配，也能用上 hover / focus / 动画 / 滚动条等内联样式写不了的东西。
  injectStyles()
  registerMomentsButton(ctx)
}
