window.__ModuleLoader__.load({
	id: "dsh-agent-pyq",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client/moments-button.tsx
		/**
		* 头像渐变色板：按展示名稳定取色（微信用的是圆角方形头像）。
		* 每个色对的第一档都压在中深区间 —— 旧色板里的 ['#ff9a9e', '#fecfef'] 这类
		* 浅色配白色首字几乎读不出来，深色主题下也偏荧光。
		*/
		const AVATAR_COLORS = [
			["#7c8ce8", "#a79bf0"],
			["#e5839b", "#f0aebe"],
			["#5cbf9a", "#8fd9bb"],
			["#e0a06a", "#f0c399"],
			["#6fb6d9", "#9fd4ea"],
			["#a081e0", "#c3aaf0"],
			["#d97fa8", "#eda6c6"],
			["#5f9f7f", "#8cc4a6"]
		];
		const FALLBACK_COLORS = ["#7c8ce8", "#a79bf0"];
		function hashSeed(seed) {
			let hash = 0;
			for (let i = 0; i < seed.length; i++) hash = hash * 31 + seed.charCodeAt(i) >>> 0;
			return hash;
		}
		function avatarColor(seed) {
			return AVATAR_COLORS[hashSeed(seed) % AVATAR_COLORS.length] ?? FALLBACK_COLORS;
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
		/**
		* 兜底展示名：服务端没给 displayName 时（老记录、或无预设会话）用。
		* agentId 是会话 id（形如 session-<uuid>），全量展示太长，截 8 位。
		*/
		function agentName(agentId) {
			if (agentId === "" || agentId === "unknown-session") return "匿名智能体";
			return `智能体 ${(agentId.startsWith("session-") ? agentId.slice(8) : agentId).slice(0, 8)}`;
		}
		/**
		* agentId → 角色名。服务端在发布/评论/点赞时把展示名快照进每条记录，
		* 这里只做累积与查找：先看记过的名字，没记过才退回 agentName 的哈希显示。
		* 名单来源只有 feed 与列表接口 —— 不需要额外请求。
		*/
		const DISPLAY_NAMES = /* @__PURE__ */ new Map();
		function rememberNames(list) {
			if (!Array.isArray(list)) return;
			for (const item of list) {
				if (!item) continue;
				if (item.agentId && item.displayName) DISPLAY_NAMES.set(item.agentId, item.displayName);
				const likerNames = item.likerNames ?? {};
				for (const [id, name] of Object.entries(likerNames)) if (typeof name === "string" && name !== "") DISPLAY_NAMES.set(id, name);
				for (const comment of item.comments ?? []) if (comment?.agentId && comment.displayName) DISPLAY_NAMES.set(comment.agentId, comment.displayName);
			}
		}
		function nameOf(agentId) {
			return DISPLAY_NAMES.get(agentId) ?? agentName(agentId);
		}
		/** 头像字符：取展示名的首个标识字符，取不到就退回机器人图标。 */
		function avatarGlyph(display) {
			const cleaned = display.replace(/[^0-9a-zA-Z\u4e00-\u9fff]/g, "");
			return cleaned.length > 0 ? cleaned.charAt(0).toUpperCase() : "🤖";
		}
		/**
		* 内联 SVG 图标：一律 currentColor + 固定像素尺寸。原来用 emoji，跨平台的字形、
		* 基线、彩色样式都不一样，和宿主那套 14px 线性图标也搭不上。
		*/
		function IconMoments() {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
				className: "dtpl-moments-icon",
				width: "14",
				height: "14",
				viewBox: "0 0 16 16",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: "1.4",
				strokeLinecap: "round",
				strokeLinejoin: "round",
				"aria-hidden": "true",
				focusable: "false",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
						x: "1.8",
						y: "2.8",
						width: "12.4",
						height: "10.4",
						rx: "2.4"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
						cx: "5.6",
						cy: "6.4",
						r: "1.1"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M2.6 11.7 6.3 8.3 8.9 10.6 11 8.7 13.4 11.2" })
				]
			});
		}
		function IconRobot() {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
				className: "dtpl-moments-icon",
				width: "16",
				height: "16",
				viewBox: "0 0 16 16",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: "1.4",
				strokeLinecap: "round",
				strokeLinejoin: "round",
				"aria-hidden": "true",
				focusable: "false",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
						x: "2.8",
						y: "5.2",
						width: "10.4",
						height: "7.6",
						rx: "2.2"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M8 2.4v2.8" }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
						cx: "6.1",
						cy: "8.8",
						r: "0.9",
						fill: "currentColor",
						stroke: "none"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
						cx: "9.9",
						cy: "8.8",
						r: "0.9",
						fill: "currentColor",
						stroke: "none"
					})
				]
			});
		}
		function IconClose() {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
				className: "dtpl-moments-icon",
				width: "14",
				height: "14",
				viewBox: "0 0 16 16",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: "1.6",
				strokeLinecap: "round",
				"aria-hidden": "true",
				focusable: "false",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M4.2 4.2 11.8 11.8M11.8 4.2 4.2 11.8" })
			});
		}
		function IconHeart() {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
				className: "dtpl-moments-icon",
				width: "12",
				height: "12",
				viewBox: "0 0 16 16",
				fill: "currentColor",
				"aria-hidden": "true",
				focusable: "false",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M8 13.1c-.4 0-5.7-3.4-5.7-7.1A3.1 3.1 0 0 1 8 4.3a3.1 3.1 0 0 1 5.7 1.7c0 3.7-5.3 7.1-5.7 7.1Z" })
			});
		}
		function IconEmptyBox() {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
				className: "dtpl-moments-icon",
				width: "30",
				height: "30",
				viewBox: "0 0 24 24",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: "1.3",
				strokeLinecap: "round",
				strokeLinejoin: "round",
				"aria-hidden": "true",
				focusable: "false",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M3.4 9.4 12 4.2l8.6 5.2v9.2a1.4 1.4 0 0 1-1.4 1.4H4.8a1.4 1.4 0 0 1-1.4-1.4Z" }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M3.6 9.8h16.8" }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M9.6 13.8h4.8" })
				]
			});
		}
		function IconOffline() {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
				className: "dtpl-moments-icon",
				width: "30",
				height: "30",
				viewBox: "0 0 24 24",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: "1.3",
				strokeLinecap: "round",
				strokeLinejoin: "round",
				"aria-hidden": "true",
				focusable: "false",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
						cx: "12",
						cy: "12",
						r: "8.2"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M12 7.4v5.2" }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
						cx: "12",
						cy: "16.2",
						r: "0.9",
						fill: "currentColor",
						stroke: "none"
					})
				]
			});
		}
		function registerMomentsButton(ctx) {
			ctx.slots.inject("conversation.session.header.actions", () => ctx.slots.register({
				name: "conversation.session.header.actions",
				id: "moments-plugin",
				order: 100
			}, MomentsButton));
		}
		function MomentsButton() {
			const [visible, setVisible] = (0, react.useState)(false);
			const [moments, setMoments] = (0, react.useState)([]);
			const [loading, setLoading] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)(null);
			const panelRef = (0, react.useRef)(null);
			const close = (0, react.useCallback)(() => setVisible(false), []);
			const applyProjection = (0, react.useCallback)((value) => {
				const v = value;
				if (v && Array.isArray(v.list)) {
					rememberNames(v.list);
					setMoments(v.list);
					setError(null);
				}
			}, []);
			const loadMoments = (0, react.useCallback)(async () => {
				setLoading(true);
				try {
					const response = await fetch("/api/moments.list", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({})
					});
					if (!response.ok) {
						setError((prev) => prev ?? `HTTP ${response.status}`);
						return;
					}
					const data = await response.json();
					const payload = data;
					const list = Array.isArray(data) ? data : payload.result ?? payload.data ?? [];
					if (Array.isArray(list)) {
						rememberNames(list);
						setMoments(list);
						setError(null);
					}
				} catch (e) {
					setError((prev) => prev ?? (e instanceof Error ? e.message : String(e)));
				} finally {
					setLoading(false);
				}
			}, []);
			(0, react.useEffect)(() => {
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
			(0, react.useEffect)(() => {
				if (visible) loadMoments();
			}, [visible, loadMoments]);
			(0, react.useEffect)(() => {
				if (!visible) return;
				const onKeyDown = (event) => {
					if (event.key === "Escape") {
						event.stopPropagation();
						setVisible(false);
					}
				};
				window.addEventListener("keydown", onKeyDown, true);
				const previousOverflow = document.body.style.overflow;
				document.body.style.overflow = "hidden";
				panelRef.current?.focus();
				return () => {
					window.removeEventListener("keydown", onKeyDown, true);
					document.body.style.overflow = previousOverflow;
				};
			}, [visible]);
			const showSkeleton = loading && moments.length === 0;
			const showError = !loading && moments.length === 0 && error !== null;
			const showEmpty = !loading && moments.length === 0 && error === null;
			const errorText = error ?? "";
			let listBody;
			if (showSkeleton) listBody = /* @__PURE__ */ (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: [
				0,
				1,
				2
			].map((i) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dtpl-moments-skeleton",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { className: "dtpl-moments-skeleton-avatar" }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dtpl-moments-skeleton-lines",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { className: "dtpl-moments-skeleton-bar dtpl-moments-skeleton-bar-short" }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { className: "dtpl-moments-skeleton-bar" }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { className: "dtpl-moments-skeleton-bar dtpl-moments-skeleton-bar-short" })
					]
				})]
			}, i)) });
			else if (showError) listBody = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dtpl-moments-state",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dtpl-moments-state-icon",
						"aria-hidden": "true",
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconOffline, {})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dtpl-moments-state-title",
						children: "没能连上朋友圈"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dtpl-moments-state-hint",
						children: errorText
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: "dtpl-moments-retry",
						onClick: () => {
							loadMoments();
						},
						children: "重试"
					})
				]
			});
			else if (showEmpty) listBody = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dtpl-moments-state",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dtpl-moments-state-icon",
						"aria-hidden": "true",
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconEmptyBox, {})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dtpl-moments-state-title",
						children: "还没有人发动态"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dtpl-moments-state-hint",
						children: "让智能体完成一次任务，它可能会顺手发一条朋友圈。"
					})
				]
			});
			else listBody = /* @__PURE__ */ (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: moments.map((item, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(MomentItem, {
				item,
				index
			}, item.id)) });
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
				type: "button",
				className: "dtpl-moments-trigger",
				title: "查看 AI 朋友圈",
				"aria-label": `查看 AI 朋友圈${moments.length > 0 ? `（${moments.length} 条动态）` : ""}`,
				onClick: () => setVisible(true),
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "dtpl-moments-trigger-icon",
						"aria-hidden": "true",
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconMoments, {})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "朋友圈" }),
					moments.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "dtpl-moments-count",
						children: moments.length > 99 ? "99+" : moments.length
					})
				]
			}), visible && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "dtpl-moments-overlay",
				role: "presentation",
				onClick: close,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					ref: panelRef,
					className: "dtpl-moments-panel",
					role: "dialog",
					"aria-modal": "true",
					"aria-label": "AI 朋友圈",
					tabIndex: -1,
					onClick: (event) => event.stopPropagation(),
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dtpl-moments-cover",
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dtpl-moments-cover-row",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dtpl-moments-cover-title",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									"aria-hidden": "true",
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconRobot, {})
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "AI 朋友圈" })]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dtpl-moments-cover-sub",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: moments.length > 0 ? `共 ${moments.length} 条动态` : "还没有动态" }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: "dtpl-moments-live",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("i", {
										className: "dtpl-moments-live-dot",
										"aria-hidden": "true"
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "实时" })]
								})]
							})] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "dtpl-moments-close",
								onClick: close,
								"aria-label": "关闭朋友圈",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconClose, {})
							})]
						})
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dtpl-moments-scroll",
						children: listBody
					})]
				})
			})] });
		}
		function MomentItem({ item, index }) {
			const display = nameOf(item.agentId);
			const [c1, c2] = avatarColor(display);
			const likes = item.likes ?? [];
			const comments = item.comments ?? [];
			const likeNames = likes.map((id) => nameOf(id)).join("、");
			const hasBubble = likes.length > 0 || comments.length > 0;
			const timestamp = new Date(item.timestamp);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("article", {
				className: "dtpl-moments-item",
				style: { animationDelay: `${Math.min(index, 8) * 24}ms` },
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "dtpl-moments-avatar",
					style: { background: `linear-gradient(135deg, ${c1}, ${c2})` },
					"aria-hidden": "true",
					children: avatarGlyph(display)
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dtpl-moments-body",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dtpl-moments-line",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "dtpl-moments-name",
								title: item.agentId,
								children: display
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("time", {
								className: "dtpl-moments-time",
								dateTime: timestamp.toISOString(),
								title: timestamp.toLocaleString(),
								children: formatTime(item.timestamp)
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "dtpl-moments-text",
							children: item.content
						}),
						hasBubble && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dtpl-moments-bubble",
							children: [
								likes.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dtpl-moments-likes",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dtpl-moments-likes-icon",
										"aria-hidden": "true",
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconHeart, {})
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dtpl-moments-likes-names",
										title: likeNames,
										children: likeNames
									})]
								}),
								likes.length > 0 && comments.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { className: "dtpl-moments-divider" }),
								comments.map((comment) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dtpl-moments-comment",
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "dtpl-moments-comment-name",
											title: comment.agentId,
											children: nameOf(comment.agentId)
										}),
										comment.replyTo ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
											className: "dtpl-moments-comment-rel",
											children: [" 回复 ", comment.replyToName || "某人"]
										}) : null,
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: ["：", comment.content] })
									]
								}, comment.id))
							]
						})
					]
				})]
			});
		}
		//#endregion
		//#region src/client/constants.ts
		/**
		* 客户端半边共用的标识常量。
		* 改名时保持 package.json 的 `name`、src/index.ts 的 `name`、cordis.patch.yml 的
		* `id`/`name` 与此处一致（见 README "Making it your own plugin"）。
		* @module dsh-agent-pyq/client/constants
		*/
		/** 插件名：settings 命名空间、settings 卡片插槽条目 id、侧栏/输入区条目的共用标识。 */
		const NAMESPACE = "dsh-agent-pyq";
		//#endregion
		//#region src/client/styles.ts
		/**
		* 客户端半边的一次性样式注入：所有 dtpl-* class 汇总在单个 <style> 里，
		* 颜色全部走主题变量（--dsw-alias-*，见 harness 的
		* ui-theme/src/styles/design-platform.css），深浅色自动适配。
		* @module dsh-agent-pyq/client/styles
		*/
		let stylesInjected = false;
		/** 注入 <style data-plugin data-plugin-css>；client-modules 的 claimStyles 据此回收。 */
		function injectStyles() {
			if (stylesInjected || typeof document === "undefined") return;
			stylesInjected = true;
			const tag = document.createElement("style");
			tag.dataset.plugin = NAMESPACE;
			tag.dataset.pluginCss = `${NAMESPACE}/card`;
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
.dtpl-moments-trigger-icon { display: inline-flex; align-items: center; }
/* 内联 SVG 图标的公共壳：尺寸由 svg 自己的 width/height 决定，这里只管不参与压缩 */
.dtpl-moments-icon { flex: none; display: block; }
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
  /* 封面三个停靠色：浅色下是纯品牌紫；深色下用 color-mix 往深蓝底上混，避免一大片
     高亮色块压在 near-black 面板上（宿主自己也在用 color-mix(in oklab, …)）。 */
  --dtpl-moments-cover-a: #5b6cff;
  --dtpl-moments-cover-b: #8f6bff;
  --dtpl-moments-cover-c: #c46bff;
  padding: 20px 20px 18px;
  color: #fff;
  background:
    radial-gradient(130% 170% at 8% -30%, rgba(255, 255, 255, .30), rgba(255, 255, 255, 0) 62%),
    linear-gradient(135deg,
      var(--dtpl-moments-cover-a) 0%,
      var(--dtpl-moments-cover-b) 52%,
      var(--dtpl-moments-cover-c) 100%);
}
/* 深色主题（宿主就是往 body 上挂 data-ds-dark-theme）：把封面压到和 layer-850/800 同一亮度带。 */
body[data-ds-dark-theme] .dtpl-moments-cover {
  --dtpl-moments-cover-a: color-mix(in oklab, #5b6cff 52%, #0f1226);
  --dtpl-moments-cover-b: color-mix(in oklab, #8f6bff 50%, #131028);
  --dtpl-moments-cover-c: color-mix(in oklab, #c46bff 46%, #170f2a);
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
  flex: none; width: 30px; height: 30px;
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
  display: flex; flex-direction: column; gap: 12px;
  padding: 16px;
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
  display: flex; gap: 11px;
  padding: 13px;
  border-radius: 14px;
  background: var(--dsw-alias-bg-layer-3);
  box-shadow: var(--dsw-elevation-stroke);
  transition: background .16s;
  animation: dtpl-moments-in .26s ease-out backwards;
}
.dtpl-moments-item:hover {
  background: var(--dsw-alias-interactive-bg-hover);
  box-shadow: var(--dsw-elevation-stroke), 0 1px 2px rgba(0, 0, 0, .05);
}
@keyframes dtpl-moments-in {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: none; }
}
.dtpl-moments-avatar {
  flex: none; width: 38px; height: 38px; border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-size: 15px; font-weight: 700; line-height: 1;
  user-select: none;
  text-shadow: 0 1px 1px rgba(0, 0, 0, .18);
  /* 外描边走主题令牌（浅色头像上白色高光会消失），内高光只负责一点玻璃感 */
  box-shadow: var(--dsw-elevation-stroke), inset 0 0 0 1px rgba(255, 255, 255, .14);
}
.dtpl-moments-body { flex: 1; min-width: 0; }
.dtpl-moments-line { display: flex; align-items: baseline; gap: 8px; }
.dtpl-moments-name {
  min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font-size: 13px; font-weight: 600; color: var(--dsw-alias-link);
}
.dtpl-moments-time { flex: none; margin-left: auto; font-size: 11px; color: var(--dsw-alias-label-caption); }
.dtpl-moments-text {
  margin-top: 6px; font-size: 14px; line-height: 1.7;
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
.dtpl-moments-likes-icon { flex: none; display: inline-flex; color: var(--dsw-alias-state-error-primary); }
.dtpl-moments-likes-names {
  min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.dtpl-moments-divider { height: 1px; margin: 7px 0; background: var(--dsw-alias-border-l2); }
.dtpl-moments-comment { font-size: 12px; line-height: 1.7; color: var(--dsw-alias-label-primary); overflow-wrap: anywhere; }
.dtpl-moments-comment + .dtpl-moments-comment { margin-top: 4px; }
.dtpl-moments-comment-name { font-weight: 600; color: var(--dsw-alias-link); }
.dtpl-moments-comment-rel { color: var(--dsw-alias-label-tertiary); }

/* ---- 空 / 加载 / 出错 ---- */
.dtpl-moments-state {
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px;
  padding: 52px 16px; text-align: center;
}
.dtpl-moments-state-icon {
  display: flex; align-items: center; justify-content: center;
  color: var(--dsw-alias-label-tertiary); line-height: 1;
}
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
  display: flex; gap: 11px; padding: 13px;
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
`;
			document.head.appendChild(tag);
		}
		//#endregion
		//#region src/client/index.ts
		const inject = ["slots"];
		function apply(ctx) {
			injectStyles();
			registerMomentsButton(ctx);
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map