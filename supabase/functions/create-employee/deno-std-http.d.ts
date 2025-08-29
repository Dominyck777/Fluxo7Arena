// Ambient declaration to satisfy Node/TS language server for Deno URL import.
// This does not affect runtime on Supabase Edge (Deno).
declare module "https://deno.land/std@0.177.0/http/server.ts" {
  export interface ServeOptions {
    port?: number;
    hostname?: string;
    signal?: AbortSignal;
    onListen?: (params: { port: number; hostname: string }) => void;
  }

  export function serve(
    handler: (request: Request) => Response | Promise<Response>,
    options?: ServeOptions,
  ): void;
}
