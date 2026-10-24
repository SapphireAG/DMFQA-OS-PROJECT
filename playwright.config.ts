import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  use: { baseURL: 'http://localhost:3100' },
  webServer: {
    command: 'npx serve@14.2.4 out -l 3100',
    port: 3100,
    reuseExistingServer: true,
  },
});
