import { defineConfig } from 'vitest/config'
import path, { resolve } from 'node:path'
import solid from 'vite-plugin-solid'

export default defineConfig({
  plugins: [solid({ hot: !process.env.VITEST })],
  resolve: {
    alias: {
      '@s-primitives/web': path.resolve(import.meta.dirname, 'packages/web/src'),
      '@s-primitives/shared': path.resolve(import.meta.dirname, 'packages/shared/src'),
    },
    dedupe: ['solid-js'],
  },
  cacheDir: resolve(import.meta.dirname, 'node_modules/.vite'),
  test: {
    reporters: 'dot',
    exclude: ['**/node_modules/**', '**/dist/**'],
    coverage: {
      include: ['packages/**/*.{ts,tsx}'],
      exclude: ['**/.test/**', '**/dist/**', '**/types.ts', '**/*.config.{ts,tsx}'],
    },
    projects: [
      'packages/*/vitest.config.ts',
      {
        extends: './vitest.config.ts',
        test: {
          name: 'unit',
          environment: 'jsdom',
          setupFiles: [resolve(import.meta.dirname, 'packages/.test/setup.ts')],
          include: ['packages/**/*.{test,spec}.{ts,tsx}', 'test/*.{test,spec}.{ts,tsx}'],
          exclude: ['packages/**/*.{browser,server}.{test,spec}.{ts,tsx}'],
          server: {
            deps: {
              inline: ['solid-js'],
            },
          },
        },
      },
    ],
  },
})
