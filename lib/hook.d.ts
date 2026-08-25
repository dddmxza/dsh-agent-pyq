import { Context } from "@deepseek-ai/cordis";
import Schema from "@deepseek-ai/schemastery";
//#region src/hook.d.ts
/** 插件显示名（诊断日志中使用）。 */
declare const name = "dsh-agent-pyq-permission-gate";
/** 插件配置：禁止模型调用的工具名列表。 */
interface Config {
  denyTools: string[];
}
/** Schemastery 配置 schema：校验 + 默认值，配置非法时加载响亮失败。 */
declare const Config: Schema<Config>;
/**
 * 权限门：返回 deny 会中止该工具调用；其余情况必须调用 next() 把决策交给
 * 下游监听器（水瀑语义：不调用 next() 即短路整条链，这是拦截行为，勿误用）。
 */
declare function apply(ctx: Context, config: Config): void;
//#endregion
export { Config, apply, name };