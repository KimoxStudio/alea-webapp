import 'server-only'

// Server-only Supabase config getters.
// This file is guarded by `server-only` and will throw a build error
// if accidentally imported in a Client Component or browser bundle.
// Only exports the secret key getter (SUPABASE_SECRET_DEFAULT_KEY).
//
// For public-safe getters (URL and publishable key), import from ./config.client.

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

export function getSupabaseSecretKey(): string {
  return requiredEnv('SUPABASE_SECRET_DEFAULT_KEY')
}
