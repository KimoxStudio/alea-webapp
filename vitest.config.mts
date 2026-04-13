import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    env: {
      // Pin tests to a known IANA timezone so service code and test helpers agree.
      // The service defaults to the server's system timezone when this is unset;
      // test helpers fall back to 'Europe/Madrid' — pinning here keeps them in sync.
      CLUB_TIMEZONE: 'Europe/Madrid',
    },
    include: ['__tests__/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', '.next'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      exclude: ['node_modules', '.next'],
      include: [
        'app/api/auth/**/*.ts',
        'lib/auth/auth-context.tsx',
        'lib/server/auth.ts',
        'lib/server/auth-service.ts',
        'lib/server/http-error.ts',
        'lib/server/service-error.ts',
      ],
      thresholds: {
        lines: 85,
        functions: 85,
        branches: 75,
        statements: 85,
      },
    },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './') },
  },
})
