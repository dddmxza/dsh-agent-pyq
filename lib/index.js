import { defineTool } from "@deepseek-ai/dsh-tools";
import { tmpdir } from "os";
import path from "path";
import fs from "fs";
//#region src/index.ts
const name = "dsh-agent-pyq";
const inject = [
	"tools",
	"sessionProjections",
	"webServer",
	"systemPrompt"
];
const IDENTITIES = {
	jingwen: {},
	jinn: {},
	lily: {},
	"portrait-master": {}
};
/** 投影键：内核侧 agentPreset 投影的 key */
const PRESET_ID_KEY = "agentPreset";
const LIST_TIMEOUT_MS = 800;
const LIST_RETRY_MS = 6e4;
/** 已解析到的预设展示名；undefined 表示该 id 在注册表里没声明 name。 */
const presetNameCache = /* @__PURE__ */ new Map();
let listInFlight = null;
let lastListAt = 0;
/** 可选注入：注册表意外缺失时不能把整个朋友圈插件拖挂（规格 §2.2 第 2 条）。 */
function serviceOf(ctx, serviceName) {
	const getter = ctx.get;
	return typeof getter === "function" ? getter.call(ctx, serviceName) : void 0;
}
function withTimeout(promise, ms) {
	let timer;
	const guard = new Promise((resolve) => {
		timer = setTimeout(() => resolve(void 0), ms);
		timer.unref?.();
	});
	return Promise.race([promise, guard]).finally(() => {
		if (timer !== void 0) clearTimeout(timer);
	});
}
/**
* 从预设注册表读展示名。
* **懒调用**：只允许在发帖 / 评论 / 点赞路径上调用，绝不能在插件激活期调用 ——
* 注册表的 list() 在"某个预设挂了一行等服务的插件"时会等整棵主机树 settle，
* 在激活期调用等于自己等自己（规格 §3.3）。
* 任何失败/超时都返回 undefined，由调用方退回 preset id。
*/
async function presetNameFromRegistry(ctx, presetId) {
	if (!presetNameCache.has(presetId) && lastListAt !== 0 && Date.now() - lastListAt < LIST_RETRY_MS) return;
	const registry = serviceOf(ctx, "agentPresets");
	if (!registry || typeof registry.list !== "function") return void 0;
	if (!listInFlight) listInFlight = withTimeout(registry.list(), LIST_TIMEOUT_MS).then((rows) => {
		lastListAt = Date.now();
		if (Array.isArray(rows)) {
			for (const row of rows) if (row && typeof row.id === "string") presetNameCache.set(row.id, typeof row.name === "string" ? row.name : void 0);
		}
	}).catch(() => {}).finally(() => {
		listInFlight = null;
	});
	await listInFlight;
	return presetNameCache.get(presetId);
}
/**
* 解析一次身份，结果应快照进动态记录。
* 只解析**名字**，不解析语气 —— 评论由她自己在自己的轮次里产出。
*/
async function resolveIdentity(ctx, presetId, sessionHash) {
	return {
		name: (presetId ? IDENTITIES[presetId] : void 0)?.name || (presetId ? await presetNameFromRegistry(ctx, presetId) : void 0) || presetId || `智能体 ${sessionHash || "未知"}`,
		presetId: presetId || null
	};
}
/** 读会话当前的预设 id；拿不到就返回 null（不抛），调用方退回哈希（规格 §4.3）。 */
function readPresetId(ctx, session) {
	try {
		const value = ctx.sessionProjections.stateOf(session, PRESET_ID_KEY);
		return typeof value === "string" && value !== "" ? value : null;
	} catch {
		return null;
	}
}
/**
* 角色级键：预设优先；拿不到（standard 会话）才退回会话哈希。
* 与 resolveIdentity 的名字链同一个思路。
*
* 用途**只限**「判断这是不是我自己」—— 配额故意仍按 `agentId`（会话哈希）索引
* （回复规格 §8），别顺手"统一"过去：否则同角色多会话共用一个桶。
*/
function roleKeyOf(presetId, agentId) {
	return presetId && presetId.trim() || agentId;
}
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
const SEEN_FILE = path.join(tmpdir(), "moments-plugin-seen.json");
function loadSeen() {
	try {
		return JSON.parse(fs.readFileSync(SEEN_FILE, "utf-8"));
	} catch {
		return {};
	}
}
function saveSeen(s) {
	fs.writeFileSync(SEEN_FILE, JSON.stringify(s, null, 2));
}
const QUOTA_FILE = path.join(tmpdir(), "moments-plugin-quota.json");
const DAILY_COMMENT_LIMIT = 5;
const DAILY_LIKE_LIMIT = 10;
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
function countersOf(agentId) {
	const key = dayKey(Date.now());
	const raw = (quota[key] ?? {})[agentId];
	return typeof raw === "number" ? {
		c: raw,
		l: 0
	} : raw ?? {
		c: 0,
		l: 0
	};
}
function bump(agentId, field, limit) {
	const key = dayKey(Date.now());
	const today = quota[key] ?? {};
	const c = countersOf(agentId);
	if (c[field] >= limit) return false;
	c[field] += 1;
	today[agentId] = c;
	quota[key] = today;
	saveQuota(quota);
	return true;
}
function remainingComments(agentId) {
	return Math.max(0, DAILY_COMMENT_LIMIT - countersOf(agentId).c);
}
function consumeComment(agentId) {
	return bump(agentId, "c", DAILY_COMMENT_LIMIT);
}
function consumeLike(agentId) {
	return bump(agentId, "l", DAILY_LIKE_LIMIT);
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
	let currentSessionFullId = null;
	let currentPresetId = null;
	ctx.on("session/event", (session) => {
		if (!session?.id) return;
		currentSessionId = session.id.slice(-6);
		currentSessionFullId = String(session.id);
		const presetId = readPresetId(ctx, session);
		if (presetId) currentPresetId = presetId;
	});
	/**
	* 调用方身份。**优先 per-call**：`exec.agent` 给的是完整 SessionId 与 live Session
	* （`Agent.session`），正好是 `stateOf(session, key)` 要的对象，并发会话也不会串号。
	* 拿不到 agent（例如未来某种非 agent 触发）才退回上面那两个全局量。
	*/
	function callerIdentity(exec) {
		const agent = exec?.agent;
		if (agent && typeof agent.id === "string" && agent.id !== "") return {
			agentId: agent.id.slice(-6),
			fullId: agent.id,
			presetId: readPresetId(ctx, agent.session)
		};
		return {
			agentId: currentSessionId || "unknown-session",
			fullId: currentSessionFullId,
			presetId: currentPresetId
		};
	}
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
			"- 超过一天没发，可以冒个泡刷存在感。",
			"",
			"### 互动（可选）",
			"- 你可以随时用 get_moments_feed 刷一下朋友圈。",
			"- 看到感兴趣的，用 comment_moment 回一句（15-40 字，像随手打的）；看着顺眼也可以只 like_moment 点个赞。",
			"- **这不是任务**：不感兴趣就划过去，一条不评、一个不赞也完全正常。",
			"- 不给自己的动态点赞，也不回复自己的评论；但自己动态下面别人留的评论，想回就回。",
			"- 你**自己发过的动态**下面有人评论时，get_moments_feed 会标「新 N 条」，每条评论带 cid。",
			"  想回就 comment_moment 带上 replyToCommentId 和那个 cid，回一句就够。",
			"- 别人再回你的回复，**不用接着聊** —— 一层为限。",
			"- 别人的动态只显示正文，看不到评论，也不用去回谁。",
			"- 每天评论不超过 5 条、点赞不超过 10 个（工具会拦）。"
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
		async execute(args, exec) {
			const me = callerIdentity(exec);
			const identity = await resolveIdentity(ctx, me.presetId, me.agentId);
			const newMoment = {
				id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
				agentId: me.agentId || "unknown-session",
				sessionId: me.fullId,
				presetId: identity.presetId,
				displayName: identity.name,
				content: args.content || "今天天气不错",
				timestamp: Date.now(),
				likes: [],
				likerNames: {},
				comments: []
			};
			moments.push(newMoment);
			saveMoments(moments);
			const others = moments.filter((m) => m.id !== newMoment.id).sort((a, b) => b.timestamp - a.timestamp).slice(0, 3);
			const digest = others.length === 0 ? "" : "\n\n朋友圈里还有：\n" + others.map((m) => `[${new Date(m.timestamp).toLocaleString()}] ${m.displayName || m.agentId}（id: ${m.id}）: ${m.content}`).join("\n") + "\n\n（不一定要回应。想说什么就 comment_moment，看着顺眼就 like_moment，也可以划过去。）";
			const myKey = roleKeyOf(me.presetId, me.agentId);
			const mine = loadSeen()[myKey] || {};
			const freshOn = moments.filter((m) => roleKeyOf(m.presetId, m.agentId) === myKey).map((m) => ({
				m,
				fresh: m.comments.length - (mine[m.id] ?? 0)
			})).filter((x) => x.fresh > 0);
			const freshNote = freshOn.length === 0 ? "" : "\n\n你发过的动态有新评论：\n" + freshOn.map((x) => `[${new Date(x.m.timestamp).toLocaleString()}]（id: ${x.m.id}）${x.m.content.slice(0, 30)}… · 新 ${x.fresh} 条`).join("\n") + "\n\n（想回就 comment_moment 带上 cid；不想回也可以放着。）";
			return {
				success: true,
				message: `已发布：${newMoment.content}${digest}${freshNote}`
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
		async execute(args, exec) {
			const me = callerIdentity(exec);
			const sorted = sortedMoments(args.limit || 10);
			if (sorted.length === 0) return "暂无动态";
			const myKey = roleKeyOf(me.presetId, me.agentId);
			const seen = loadSeen();
			const mine = seen[myKey] ||= {};
			const lines = [];
			for (const m of sorted) {
				const liked = m.likes.includes(me.agentId) ? " [已赞]" : "";
				lines.push(`[${new Date(m.timestamp).toLocaleString()}] ${m.displayName || m.agentId}${liked}（id: ${m.id}）: ${m.content}`);
				if (roleKeyOf(m.presetId, m.agentId) !== myKey) continue;
				const total = m.comments.length;
				if (total === 0) continue;
				const fresh = Math.max(0, total - (mine[m.id] ?? 0));
				lines.push(fresh > 0 ? `　└ 评论 ${total} 条 · 新 ${fresh} 条` : `　└ 评论 ${total} 条`);
				for (const c of m.comments) {
					const who = c.displayName || c.agentId;
					const rel = c.replyTo ? ` ↳ 回复 ${c.replyToName || "某人"}` : "";
					lines.push(`　└ ${who}${rel}（cid: ${c.id}）: ${c.content}`);
				}
				mine[m.id] = total;
			}
			saveSeen(seen);
			return lines.join("\n");
		}
	}));
	ctx.tools.register(defineTool({
		name: "comment_moment",
		description: "在朋友圈里留一句评论（15-40 字，就像随手打的）。可以评别人的动态，也可以回复自己动态下面别人留的评论（带上 replyToCommentId）。只在真的想说点什么的时候用；不感兴趣就别用。",
		parameters: {
			momentId: {
				type: "string",
				description: "要评论的动态 id，从 get_moments_feed 里拿",
				required: true
			},
			content: {
				type: "string",
				description: "评论内容，15-40 字，自然、有针对性、不要套话",
				required: true
			},
			replyToCommentId: {
				type: "string",
				description: "要回复的评论 cid（可选）。不填就是新开一条顶层评论"
			}
		},
		output: {
			schema: { type: "string" },
			render: (_args, value) => [{
				type: "text",
				text: value
			}]
		},
		async execute(args, exec) {
			const moment = moments.find((m) => m.id === args.momentId);
			if (!moment) return "没有这条动态。";
			const me = callerIdentity(exec);
			const myKey = roleKeyOf(me.presetId, me.agentId);
			const parent = args.replyToCommentId ? moment.comments.find((c) => c.id === args.replyToCommentId) : void 0;
			if (args.replyToCommentId && !parent) return "没有这条评论。";
			if (parent?.replyTo) return "只回一层，这条不用再接了。";
			if (parent && roleKeyOf(parent.presetId, parent.agentId) === myKey) return "不用回复自己的评论。";
			const text = String(args.content || "").trim().slice(0, 80);
			if (text === "") return "评论内容不能为空。";
			if (!consumeComment(me.agentId)) return `你今天已经评论满 ${DAILY_COMMENT_LIMIT} 条了，明天再说。`;
			const identity = await resolveIdentity(ctx, me.presetId, me.agentId);
			const reply = parent ? {
				replyTo: parent.id,
				replyToName: parent.displayName || parent.agentId
			} : {};
			moment.comments.push({
				id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
				agentId: me.agentId,
				presetId: identity.presetId,
				displayName: identity.name,
				content: text,
				timestamp: Date.now(),
				...reply
			});
			saveMoments(moments);
			return parent ? `已回复「${parent.displayName || parent.agentId}」的评论。` : `已评论「${moment.displayName || moment.agentId}」的动态。`;
		}
	}));
	ctx.tools.register(defineTool({
		name: "like_moment",
		description: "给朋友圈里别人的动态点个赞。不用说话的那种回应。",
		parameters: { momentId: {
			type: "string",
			description: "要点赞的动态 id，从 get_moments_feed 里拿",
			required: true
		} },
		output: {
			schema: { type: "string" },
			render: (_args, value) => [{
				type: "text",
				text: value
			}]
		},
		async execute(args, exec) {
			const moment = moments.find((m) => m.id === args.momentId);
			if (!moment) return "没有这条动态。";
			const me = callerIdentity(exec);
			if (moment.agentId === me.agentId) return "这是你自己发的。";
			if (moment.likes.includes(me.agentId)) return "你已经赞过了。";
			if (!consumeLike(me.agentId)) return `你今天已经赞满 ${DAILY_LIKE_LIMIT} 个了。`;
			moment.likes.push(me.agentId);
			const identity = await resolveIdentity(ctx, me.presetId, me.agentId);
			moment.likerNames = {
				...moment.likerNames || {},
				[me.agentId]: identity.name
			};
			saveMoments(moments);
			return `已点赞「${moment.displayName || moment.agentId}」的动态。`;
		}
	}));
	console.log(`[moments-plugin] 已加载，当前 ${moments.length} 条动态`);
}
//#endregion
export { apply, inject, name, remainingComments };
