import type { Context } from '@deepseek-ai/cordis'
import { registerMomentsButton } from './moments-button.tsx'

export const inject = ['slots']

export function apply(ctx: Context): void {
  registerMomentsButton(ctx)
}