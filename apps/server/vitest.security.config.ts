import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.security.test.ts'],
    environment: 'node',
    fileParallelism: false,
    testTimeout: 60000,
    hookTimeout: 120000,
  },
});
