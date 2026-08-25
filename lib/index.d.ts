import { Context } from "@deepseek-ai/cordis";
//#region src/index.d.ts
declare module '@deepseek-ai/cordis' {
  interface Context {
    sessionProjections: {
      register(definition: Record<string, unknown>): () => void;
      onChanged(listener: (session: unknown, key: string, value: unknown, seq: number) => void): () => void;
      stateOf(session: unknown, key: string): unknown;
    };
    webServer: {
      register(route: {
        kind: 'exact' | 'prefix';
        path: string;
        handler: (req: unknown, res: {
          writeHead: (status: number, headers?: Record<string, string>) => void;
          end: (body?: string) => void;
        }) => void | Promise<void>;
      }): () => void;
    };
  }
}
declare const name = "moments-plugin";
declare const inject: string[];
declare function apply(ctx: Context): void;
//#endregion
export { apply, inject, name };