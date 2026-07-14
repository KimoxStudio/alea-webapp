# Pre-01: Fix Node crypto import in Edge middleware
Phase: Pre (Supabase to Neon migration blockers). Depends on: none.
Problem: lib/server/security.ts imports Node crypto module. It is imported (directly or transitively) by middleware.ts, which runs on Vercel Edge runtime. Edge runtime does not support Node crypto -- causes runtime failure on deploy.
Scope: Identify every function in lib/server/security.ts that uses Node crypto and is reachable from middleware.ts. Replace with Web Crypto API equivalents OR split module so middleware.ts only imports Edge-safe code. Do not change external behavior/signature of functions used outside middleware.ts unless required.
Acceptance criteria: middleware.ts and everything it imports contains no Node-only APIs (crypto, fs, net, etc). pnpm build succeeds. Existing tests for lib/server/security.ts still pass; add a regression test if the fix changes behavior.
Out of scope: No changes to lib/server/ files unrelated to the middleware import chain. No changes to auth/session logic beyond what is required.
