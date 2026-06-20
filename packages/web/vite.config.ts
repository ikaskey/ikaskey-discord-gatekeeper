import { defineConfig } from 'vite';
import devServer from '@hono/vite-dev-server';

// dev: Hono を Vite 上で HMR 起動（entry は default export の app）
export default defineConfig({
  plugins: [
    devServer({
      entry: 'src/app.ts',
    }),
  ],
  server: {
    port: 3001,
  },
});
