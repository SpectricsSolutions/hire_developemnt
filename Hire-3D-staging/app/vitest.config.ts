import path from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        // Generated
        'src/client/**',
        'src/components/ui/**',
        // Infrastructure
        'src/main.tsx',
        'src/router.tsx',
        'src/constants/**',
        'src/types/**',
        'src/test/**',
        'src/**/*.d.ts',
        // Pure display components — no logic to unit test
        'src/components/layouts/**',
        'src/components/nav-*.tsx',
        'src/components/app-sidebar.tsx',
        'src/components/site-header.tsx',
        'src/components/theme-provider.tsx',
        'src/components/logo.tsx',
        'src/components/chart-area-interactive.tsx',
        'src/components/data-table.tsx',
        'src/components/section-cards.tsx',
        // Hooks
        'src/hooks/**',
        // Stub form components with no logic yet
        'src/components/forgot-password-form.tsx',
        'src/components/reset-password-form.tsx',
        // Thin page wrappers — just re-export a form component
        'src/pages/login.tsx',
        'src/pages/signup.tsx',
        'src/pages/forgot-password.tsx',
        'src/pages/reset-password.tsx',
        'src/pages/splash.tsx'
      ],
      thresholds: {
        lines: 85,
        functions: 85,
        branches: 80,
        statements: 85
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
})
