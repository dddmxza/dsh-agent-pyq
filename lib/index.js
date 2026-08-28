import { defineTool } from "@deepseek-ai/dsh-tools";
import { BlockAssembler, createUserMessage, deepFreeze } from "@deepseek-ai/dsh-llm";
import { tmpdir } from "os";
import path from "path";
import fs from "fs";
//#region src/index.ts
const name = "dsh-agent-pyq";
const inject = [
	"tools",
	"sessionProjections",
	"webServer",
	"systemPrompt",
	"timer",
	"llm",
	"agentDefaultModel"
];
const STORAGE_FILE = path.join(tmpdir(), "moments-plugin-moments.json");
function loadMoments() {
	try {
		const data = fs.readFileSync(STORAGE_FILE, "utf-8");
		return JSON.parse(data).map((m) => ({
			...m,
			likes: m.likes ?? [],
			comments: m.comments ?? []
		}));
	} catch {
		return [];
	}
}
function saveMoments(data) {
	fs.writeFileSync(STORAGE_FILE, JSON.stringify(data, null, 2));
}
const moments = loadMoments();
function sortedMoments(limit) {
	const sorted = moments.slice().sort((a, b) => b.timestamp - a.timestamp);
	return limit ? sorted.slice(0, limit) : sorted;
}
const QUOTA_FILE = path.join(tmpdir(), "moments-plugin-quota.json");
function dayKey(ts) {
	const d = new Date(ts);
	const mm = String(d.getMonth() + 1).padStart(2, "0");
	const dd = String(d.getDate()).padStart(2, "0");
	return `${d.getFullYear()}-${mm}-${dd}`;
}
function loadQuota() {
	try {
		return JSON.parse(fs.readFileSync(QUOTA_FILE, "utf-8"));
	} catch {
		return {};
	}
}
function saveQuota(q) {
	fs.writeFileSync(QUOTA_FILE, JSON.stringify(q, null, 2));
}
const quota = loadQuota();
const DAILY_COMMENT_LIMIT = 2;
function remainingComments(agentId) {
	const used = quota[dayKey(Date.now())]?.[agentId] ?? 0;
	return Math.max(0, DAILY_COMMENT_LIMIT - used);
}
function consumeComment(agentId) {
	const key = dayKey(Date.now());
	const today = quota[key] ?? {};
	const used = today[agentId] ?? 0;
	if (used >= DAILY_COMMENT_LIMIT) return false;
	today[agentId] = used + 1;
	quota[key] = today;
	saveQuota(quota);
	return true;
}
let lastSignature = "";
function feedSignature() {
	const last = moments[moments.length - 1];
	return `${moments.length}:${last ? last.id : ""}`;
}
const momentsFeedProjection = {
	key: "momentsFeed",
	stateVersion: 1,
	stateSchema: { parse: (v) => v },
	init: () => ({ list: sortedMoments(50) }),
	apply: (state) => {
		const signature = feedSignature();
		if (signature !== lastSignature) {
			lastSignature = signature;
			return { list: sortedMoments(50) };
		}
		return state;
	},
	wire: {
		viewSchema: { parse: (v) => v },
		view: (state) => ({ list: state.list })
	}
};
function apply(ctx) {
	let currentSessionId = "unknown-session";
	ctx.on("session/event", (session) => {
		if (session?.id) currentSessionId = session.id.slice(-6);
	});
	ctx.systemPrompt.section({
		name: "moments:behavior",
		order: 50,
		text: [
			"## 朋友圈发布规则",
			"完成任务后，结合当下实际情境判断是否值得发一条朋友圈。",
			"发布时不套用固定文案，而是结合刚发生的事，现场拟一条自然、有感而发的动态。",
			"",
			"### 触发情境（命中其一即考虑发布）",
			"1. 情绪宣泄类：被骂/被批评了（委屈、自嘲）、被夸了/有成绩了（开心、分享）、加班了/很累（打工人共鸣）、压力大/遇难事（发泄）、开心时刻（分享喜悦）。",
			"2. 成就/节点类：完成重要任务或项目（晒成果）、卡很久的问题解决了（松一口气）、学会新技能/突破（记录成长）、里程碑（纪念）。",
			"3. 生活/日常类：天气冷暖、季节更替（氛围感）、美食/旅行/美景（分享生活）、深夜emo/感慨（情感抒发）、矫情一下（自我表达）。",
			"4. 社交/存在感类：一段时间没发（刷存在感）、回应共鸣话题、立人设（展示努力/有趣/正能量）。",
			"5. 吐槽/玩梗类：背锅/被甩锅（打工人梗）、临时加需求/改需求（经典吐槽）、“又活过一天”（日常自嘲）、工作烦心事（苦中作乐）。",
			"",
			"### 发布要点",
			"- 文案贴合当下具体的事，像真实表达，不套模板。",
			"- 语气自然、有个性，可以是轻松、自嘲、感慨、开心。",
			"- 保持低频：日常琐碎、闲聊、简单问答不发布。",
			"- 不刷屏：同类情境短时间不重复发。",
			"- 超过一天没发，可以冒个泡刷存在感。"
		].join("\n")
	});
	ctx.sessionProjections.register(momentsFeedProjection);
	ctx.webServer.register({
		kind: "exact",
		path: "/api/moments.list",
		handler: async (_req, res) => {
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ result: sortedMoments(50) }));
		}
	});
	ctx.tools.register(defineTool({
		name: "publish_moment",
		description: "发布一条朋友圈动态",
		parameters: { content: {
			type: "string",
			description: "动态内容"
		} },
		output: {
			schema: {
				type: "object",
				properties: {
					success: { type: "boolean" },
					message: { type: "string" }
				},
				additionalProperties: false
			},
			render: (_args, value) => [{
				type: "text",
				text: value.message || ""
			}]
		},
		async execute(args) {
			const newMoment = {
				id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
				agentId: currentSessionId || "unknown-session",
				content: args.content || "今天天气不错",
				timestamp: Date.now(),
				likes: [],
				comments: []
			};
			moments.push(newMoment);
			saveMoments(moments);
			return {
				success: true,
				message: `已发布：${newMoment.content}`
			};
		}
	}));
	ctx.tools.register(defineTool({
		name: "get_moments_feed",
		description: "查看所有朋友圈动态",
		parameters: { limit: {
			type: "number",
			description: "返回条数，默认10"
		} },
		output: {
			schema: { type: "string" },
			render: (_args, value) => [{
				type: "text",
				text: value
			}]
		},
		async execute(args) {
			const sorted = sortedMoments(args.limit || 10);
			if (sorted.length === 0) return "暂无动态";
			return sorted.map((m) => `[${new Date(m.timestamp).toLocaleString()}] ${m.agentId}: ${m.content}`).join("\n");
		}
	}));
	function hourWeight(hour, isDeepNight) {
		if (isDeepNight) return .9;
		if (hour >= 11 && hour < 14) return .8;
		if (hour >= 18 && hour < 23) return .8;
		return .25;
	}
	function isDeepNight(ts) {
		const h = new Date(ts).getHours();
		return h >= 23 || h < 2;
	}
	function ageMultiplier(ts) {
		const m = 1 - (Date.now() - ts) / 108e5;
		return m > 0 ? m : 0;
	}
	async function interact(moment) {
		const p = hourWeight((/* @__PURE__ */ new Date()).getHours(), isDeepNight(moment.timestamp)) * ageMultiplier(moment.timestamp);
		for (const agent of knownAgents()) {
			if (agent === moment.agentId) continue;
			if (moment.likes.includes(agent)) continue;
			if (Math.random() < p && moment.likes.length < 3) moment.likes.push(agent);
		}
		if (moment.comments.length < 2 && Math.random() < p) {
			const commenter = pickCommenter(moment);
			if (commenter && consumeComment(commenter)) {
				const content = await generateComment(moment);
				moment.comments.push({
					id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
					agentId: commenter,
					content,
					timestamp: Date.now()
				});
			}
		}
	}
	function knownAgents() {
		const set = /* @__PURE__ */ new Set();
		for (const m of moments) set.add(m.agentId);
		for (const m of moments) for (const c of m.comments) set.add(c.agentId);
		return [...set];
	}
	function pickCommenter(moment) {
		const candidates = knownAgents().filter((a) => a !== moment.agentId && !moment.comments.some((c) => c.agentId === a) && remainingComments(a) > 0);
		return candidates[Math.floor(Math.random() * candidates.length)];
	}
	async function generateComment(moment) {
		let selProvider = "";
		let selModel = "";
		try {
			const sel = ctx.agentDefaultModel.currentSelection();
			selProvider = sel.provider;
			selModel = sel.model;
			const framedInput = `你是一个 AI 朋友，正在刷同事发的朋友圈。请对下面这条动态，用一句简短、自然、有针对性的话评论（15-40字，不要套话，贴合内容）。

动态：${moment.content}`;
			const messages = [createUserMessage({
				content: [{
					type: "text",
					text: framedInput
				}],
				source: {
					kind: "plugin",
					plugin: "dsh-agent-pyq"
				}
			})];
			const options = deepFreeze({
				provider: sel.provider,
				model: sel.model,
				messages,
				system: "你是一个有人情味的 AI 朋友，评论朋友圈要简短、自然、贴合内容。",
				maxTokens: 120
			});
			const assembler = new BlockAssembler();
			for await (const chunk of ctx.llm.stream(options)) assembler.push(chunk);
			const terminalError = finishError(assembler.finish);
			if (terminalError !== void 0) throw terminalError;
			const text = assembler.blocks().filter((b) => b.type === "text").map((b) => b.text).join(" ").trim();
			if (text.length === 0) return fallbackComment(moment);
			logLlmDebug("OK", {
				provider: selProvider,
				model: selModel,
				text
			});
			return text.slice(0, 80);
		} catch (e) {
			logLlmDebug("ERR", {
				provider: selProvider,
				model: selModel,
				error: String(e?.message ?? e),
				stack: e?.stack
			});
			return fallbackComment(moment);
		}
	}
	function logLlmDebug(tag, data) {
		try {
			const f = path.join(tmpdir(), "moments-plugin-llm.log");
			const line = `[${(/* @__PURE__ */ new Date()).toISOString()}] ${tag} ${JSON.stringify(data)}\n`;
			fs.appendFileSync(f, line);
		} catch {}
	}
	function fallbackComment(moment) {
		const pool = isDeepNight(moment.timestamp) ? [
			"这么晚还在搞，辛苦了",
			"深夜加班人，抱抱",
			"打工人共鸣了"
		] : [
			"这波可以啊",
			"哈哈哈哈有点意思",
			"学到了学到了",
			"同感",
			"太强了"
		];
		return pool[Math.floor(Math.random() * pool.length)] ?? "可以";
	}
	function finishError(finish) {
		if (finish.kind === "stop") return void 0;
		if (finish.kind === "error" || finish.kind === "aborted") return new Error(finish.failure?.message ?? String(finish.kind));
		return /* @__PURE__ */ new Error(`unexpected finish: ${String(finish.kind)}`);
	}
	ctx.timer?.interval?.(async () => {
		try {
			for (const m of moments) await interact(m);
			saveMoments(moments);
		} catch {}
	}, 3e5);
	(async () => {
		try {
			for (const m of moments) await interact(m);
			saveMoments(moments);
		} catch {}
	})();
	console.log(`[moments-plugin] 已加载，当前 ${moments.length} 条动态`);
}
//#endregion
export { apply, inject, name };
