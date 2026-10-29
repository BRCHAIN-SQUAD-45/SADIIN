/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const proxyTarget = env.VITE_DEV_PROXY_TARGET || 'http://localhost:8000';

  return {
    plugins: [react()],
    server: {
      port: 5173,
      // Em `VITE_DATA_MODE=api` com `VITE_API_URL` vazio, as chamadas vão para
      // a mesma origem (/api/...) e este proxy as repassa ao back-end local,
      // evitando CORS durante o desenvolvimento.
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
        },
      },
    },
    preview: {
      port: 4173,
    },
    test: {
      // jsdom + AbortController nativo do Node (ver src/test/jsdom-native-abort.env.ts)
      environment: './src/test/jsdom-native-abort.env.ts',
      globals: true,
      setupFiles: ['./src/test/setup.ts'],
      css: false,
      coverage: {
        provider: 'v8',
        include: ['src/features/**', 'src/api/**', 'src/utils/**'],
        exclude: ['**/*.test.{ts,tsx}'],
        thresholds: { lines: 70, functions: 70, statements: 70, branches: 60 },
      },
    },
  };
});
