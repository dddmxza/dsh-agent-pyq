window.__ModuleLoader__.load({
	id: "dsh-agent-pyq",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client/moments-button.tsx
		/** 头像渐变色板：按 agentId 稳定取色（微信用的是圆角方形头像）。 */
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
		const FALLBACK_COLORS = ["#6a8dff", "#a18cd1"];
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
		/** agentId 是会话 id（形如 session-<uuid>），全量展示太长，截 8 位做展示名。 */
		function agentName(agentId) {
			if (agentId === "" || agentId === "unknown-session") return "匿名智能体";
			return `智能体 ${(agentId.startsWith("session-") ? agentId.slice(8) : agentId).slice(0, 8)}`;
		}
		/** 头像字符：取会话 id 的首个标识字符，取不到就退回机器人图标。 */
		function avatarGlyph(agentId) {
			const cleaned = (agentId.startsWith("session-") ? agentId.slice(8) : agentId).replace(/[^0-9a-zA-Z\u4e00-\u9fff]/g, "");
			return cleaned.length > 0 ? cleaned.charAt(0).toUpperCase() : "🤖";
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
						children: "🛰️"
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
						children: "📭"
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
						children: "🌤️"
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
									children: "🤖"
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
								children: "✕"
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
			const [c1, c2] = avatarColor(item.agentId);
			const likes = item.likes ?? [];
			const comments = item.comments ?? [];
			const hasBubble = likes.length > 0 || comments.length > 0;
			const timestamp = new Date(item.timestamp);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("article", {
				className: "dtpl-moments-item",
				style: { animationDelay: `${Math.min(index, 8) * 24}ms` },
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "dtpl-moments-avatar",
					style: { background: `linear-gradient(135deg, ${c1}, ${c2})` },
					"aria-hidden": "true",
					children: avatarGlyph(item.agentId)
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dtpl-moments-body",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dtpl-moments-line",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "dtpl-moments-name",
								title: item.agentId,
								children: agentName(item.agentId)
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
										children: "❤️"
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dtpl-moments-likes-names",
										title: likes.map(agentName).join("、"),
										children: likes.map(agentName).join("、")
									})]
								}),
								likes.length > 0 && comments.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { className: "dtpl-moments-divider" }),
								comments.map((comment) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dtpl-moments-comment",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dtpl-moments-comment-name",
										title: comment.agentId,
										children: agentName(comment.agentId)
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: ["：", comment.content] })]
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