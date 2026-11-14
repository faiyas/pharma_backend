import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
  plugins: [react(), basicSsl()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_API_BASE || 'https://8000-agq5qlr2uletnjyzudtddvxrdq.instabox.tech',
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
