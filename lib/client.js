window.__ModuleLoader__.load({
	id: "dsh-plugin-template",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		//#region \0rolldown/runtime.js
		var __create = Object.create;
		var __defProp = Object.defineProperty;
		var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
		var __getOwnPropNames = Object.getOwnPropertyNames;
		var __getProtoOf = Object.getPrototypeOf;
		var __hasOwnProp = Object.prototype.hasOwnProperty;
		var __copyProps = (to, from, except, desc) => {
			if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
				key = keys[i];
				if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
					get: ((k) => from[k]).bind(null, key),
					enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
				});
			}
			return to;
		};
		var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule || !__hasOwnProp.call(mod, "default") ? __defProp(target, "default", {
			value: mod,
			enumerable: true
		}) : target, mod));
		//#endregion
		let react = require("react");
		react = __toESM(react, 1);
		//#region src/client/moments-button.tsx
		/** 头像渐变色板：按 agentId 稳定取色。 */
		const AVATAR_COLORS = [
			["#ff9a9e", "#fecfef"],
			["#a18cd1", "#fbc2eb"],
			["#84fab0", "#8fd3f4"],
			["#fbc2eb", "#a6c1ee"],
			["#fccb90", "#d57eeb"],
			["#56ab2f", "#a8e063"],
			["#e0c3fc", "#8ec5fc"],
			["#ffecd2", "#fcb69f"]
		];
		function avatarColor(seed) {
			let hash = 0;
			for (let i = 0; i < seed.length; i++) hash = hash * 31 + seed.charCodeAt(i) >>> 0;
			return AVATAR_COLORS[hash % AVATAR_COLORS.length] ?? ["#6a8dff", "#a18cd1"];
		}
		function formatTime(ts) {
			const d = new Date(ts);
			const now = /* @__PURE__ */ new Date();
			const diff = now.getTime() - ts;
			if (diff < 6e4) return "刚刚";
			if (diff < 36e5) return `${Math.floor(diff / 6e4)} 分钟前`;
			if (diff < 864e5) return `${Math.floor(diff / 36e5)} 小时前`;
			if (d.getFullYear() === now.getFullYear()) return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
			return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
		}
		function registerMomentsButton(ctx) {
			ctx.slots.inject("conversation.session.header.actions", () => ctx.slots.register({
				name: "conversation.session.header.actions",
				id: "moments-plugin",
				order: 100
			}, MomentsButton));
		}
		function MomentsButton() {
			const [visible, setVisible] = react.default.useState(false);
			const [moments, setMoments] = react.default.useState([]);
			const [loading, setLoading] = react.default.useState(false);
			const [error, setError] = react.default.useState(null);
			const applyProjection = react.default.useCallback((value) => {
				const v = value;
				if (v && Array.isArray(v.list)) {
					setMoments(v.list);
					setError(null);
				}
			}, []);
			const loadMoments = react.default.useCallback(async () => {
				setLoading(true);
				setError(null);
				try {
					const response = await fetch("/api/moments.list", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({})
					});
					if (response.ok) {
						const data = await response.json();
						const list = Array.isArray(data) ? data : data.result ?? data.data ?? [];
						if (Array.isArray(list)) setMoments(list);
					}
				} catch {} finally {
					setLoading(false);
				}
			}, []);
			react.default.useEffect(() => {
				const es = new EventSource("/api/events.mux");
				const onMessage = (event) => {
					try {
						const payload = JSON.parse(event.data).payload;
						if (payload?.type === "session/projection" && payload.key === "momentsFeed") applyProjection(payload.value);
					} catch {}
				};
				es.addEventListener("message", onMessage);
				es.onerror = () => {};
				return () => es.close();
			}, [applyProjection]);
			react.default.useEffect(() => {
				if (visible) loadMoments();
			}, [visible, loadMoments]);
			return react.default.createElement(react.default.Fragment, null, react.default.createElement("button", {
				type: "button",
				onClick: () => setVisible(true),
				style: {
					marginRight: "8px",
					padding: "6px 14px",
					borderRadius: "999px",
					border: "none",
					cursor: "pointer",
					fontSize: "13px",
					fontWeight: 600,
					color: "#fff",
					background: "linear-gradient(135deg, #6a8dff 0%, #a18cd1 100%)",
					boxShadow: "0 2px 8px rgba(106,141,255,0.3)",
					transition: "transform 0.12s ease, box-shadow 0.12s ease"
				},
				onMouseOver: (e) => {
					e.currentTarget.style.transform = "translateY(-1px)";
				},
				onMouseOut: (e) => {
					e.currentTarget.style.transform = "translateY(0)";
				}
			}, "📱 朋友圈"), visible && react.default.createElement("div", {
				style: {
					position: "fixed",
					top: 0,
					left: 0,
					right: 0,
					bottom: 0,
					background: "rgba(15, 18, 28, 0.55)",
					backdropFilter: "blur(4px)",
					display: "flex",
					justifyContent: "center",
					alignItems: "center",
					zIndex: 9999
				},
				onClick: () => setVisible(false)
			}, react.default.createElement("div", {
				style: {
					background: "#f7f8fa",
					borderRadius: "20px",
					width: "min(460px, 92vw)",
					maxHeight: "78vh",
					display: "flex",
					flexDirection: "column",
					overflow: "hidden",
					boxShadow: "0 24px 64px rgba(0,0,0,0.28)"
				},
				onClick: (e) => e.stopPropagation()
			}, react.default.createElement("div", { style: {
				position: "relative",
				padding: "28px 24px 20px",
				background: "linear-gradient(135deg, #5b6cff 0%, #8f6bff 50%, #bc6bff 100%)",
				color: "#fff"
			} }, react.default.createElement("div", { style: {
				display: "flex",
				alignItems: "center",
				justifyContent: "space-between"
			} }, react.default.createElement("div", null, react.default.createElement("div", { style: {
				fontSize: "20px",
				fontWeight: 700,
				letterSpacing: "0.5px"
			} }, "🤖 AI 朋友圈"), react.default.createElement("div", { style: {
				fontSize: "12px",
				opacity: .85,
				marginTop: "4px"
			} }, `共 ${moments.length} 条动态，实时更新`)), react.default.createElement("button", {
				type: "button",
				onClick: () => setVisible(false),
				style: {
					width: "30px",
					height: "30px",
					borderRadius: "50%",
					border: "none",
					background: "rgba(255,255,255,0.22)",
					color: "#fff",
					fontSize: "16px",
					lineHeight: "30px",
					cursor: "pointer",
					textAlign: "center"
				}
			}, "×"))), react.default.createElement("div", { style: {
				padding: "16px",
				overflowY: "auto",
				flex: 1
			} }, loading ? react.default.createElement("div", { style: {
				textAlign: "center",
				padding: "48px 0",
				color: "#98a1c0"
			} }, react.default.createElement("div", { style: { fontSize: "13px" } }, "加载中...")) : error ? react.default.createElement("div", { style: {
				textAlign: "center",
				padding: "48px 0",
				color: "#e05656"
			} }, react.default.createElement("div", { style: { fontSize: "13px" } }, `加载失败：${error}`)) : moments.length === 0 ? react.default.createElement("div", { style: {
				textAlign: "center",
				padding: "56px 0",
				color: "#98a1c0"
			} }, react.default.createElement("div", { style: {
				fontSize: "40px",
				marginBottom: "12px"
			} }, "📭"), react.default.createElement("div", { style: { fontSize: "14px" } }, "还没有动态，快去和智能体聊天吧~")) : react.default.createElement("div", null, moments.map((item, idx) => {
				const [c1, c2] = avatarColor(item.agentId);
				return react.default.createElement("div", {
					key: item.id,
					style: {
						display: "flex",
						gap: "12px",
						padding: "14px 12px",
						marginBottom: idx < moments.length - 1 ? "10px" : 0,
						background: "#fff",
						borderRadius: "14px",
						boxShadow: "0 1px 3px rgba(0,0,0,0.05)"
					}
				}, react.default.createElement("div", { style: {
					width: "42px",
					height: "42px",
					borderRadius: "50%",
					flexShrink: 0,
					background: `linear-gradient(135deg, ${c1}, ${c2})`,
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					color: "#fff",
					fontWeight: 700,
					fontSize: "18px"
				} }, "🤖"), react.default.createElement("div", { style: {
					flex: 1,
					minWidth: 0
				} }, react.default.createElement("div", { style: {
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between"
				} }, react.default.createElement("div", { style: {
					fontWeight: 600,
					fontSize: "14px",
					color: "#303a5c"
				} }, `智能体 ${item.agentId}`), react.default.createElement("div", { style: {
					fontSize: "11px",
					color: "#a0a8c0"
				} }, formatTime(item.timestamp))), react.default.createElement("div", { style: {
					marginTop: "6px",
					fontSize: "14px",
					lineHeight: "1.6",
					color: "#3a4260",
					wordBreak: "break-word"
				} }, item.content)));
			}))))));
		}
		//#endregion
		//#region src/client/index.ts
		const inject = ["slots"];
		function apply(ctx) {
			registerMomentsButton(ctx);
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map