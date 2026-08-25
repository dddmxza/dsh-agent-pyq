import Schema from "@deepseek-ai/schemastery";
//#region src/hook.ts
/** 插件显示名（诊断日志中使用）。 */
const name = "dsh-plugin-template-permission-gate";
/** Schemastery 配置 schema：校验 + 默认值，配置非法时加载响亮失败。 */
const Config = Schema.object({ denyTools: Schema.array(Schema.string()).default([]) });
/**
* 权限门：返回 deny 会中止该工具调用；其余情况必须调用 next() 把决策交给
* 下游监听器（水瀑语义：不调用 next() 即短路整条链，这是拦截行为，勿误用）。
*/
function apply(ctx, config) {
	ctx.on("tools/pre-execute", async (exec, next) => {
		if (config.denyTools.includes(exec.name)) return {
			kind: "deny",
			reason: `Tool "${exec.name}" is denied by policy.`
		};
		return next();
	});
}
//#endregion
export { Config, apply, name };
