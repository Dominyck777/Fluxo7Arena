// Minimal Deno ambient types for local TypeScript tooling in Node/Vite
// This is safe for build-time/editor only and does not affect runtime in Supabase Edge (Deno).
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};
