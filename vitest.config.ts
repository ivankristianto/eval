import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/lib/**/*.ts'],
      exclude: ['src/lib/types.ts']
    }
  },
  resolve: {
    alias: {
      '@lib': '/src/lib',
      '@components': '/src/components'
    }
  }
});
