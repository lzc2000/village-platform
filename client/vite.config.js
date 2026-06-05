import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: [
      '445tq3206gf7.vicp.fun',
      '.vicp.fun'  // 匹配所有 vicp.fun 子域名（穿透地址可能会变）
    ],
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      }
    }
  },
  build: {
    outDir: 'dist',
  }
});
