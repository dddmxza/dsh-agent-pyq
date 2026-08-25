import { Context, Service } from "@deepseek-ai/cordis";
//#region src/service.d.ts
declare module '@deepseek-ai/cordis' {
  interface Context {
    templateService: TemplateService;
  }
}
/** 示例服务：暴露给其他插件的能力。 */
declare class TemplateService extends Service {
  /** 本服务依赖的其他服务；就绪后本插件才加载。 */
  static inject: string[];
  constructor(ctx: Context);
  /** 公共方法：记录一次事件。 */
  record(event: string): void;
}
//#endregion
export { TemplateService, TemplateService as default };