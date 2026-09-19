import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { pathToFileURL } from 'url';
import { defineConfig } from 'vite';
import express from 'express';
import fs from 'fs';
import dotenv from 'dotenv';
const localEnvPath = path.resolve(__dirname, '.env.local');
const defaultEnvPath = path.resolve(__dirname, '.env');
dotenv.config({ path: fs.existsSync(localEnvPath) ? localEnvPath : defaultEnvPath });

const apiRoutes = {
  '/api/*': 'api/[...slug].js',
};

const vercelApiPlugin = () => ({
  name: 'vercel-api',
  configureServer(server: any) {
    const app = express();
    app.use(express.json({ limit: '16kb' }));
    app.use((req, res, next) => {
      if (!req.path?.startsWith('/api/')) return next();
      void (async () => {
        try {
          const handler = await import(pathToFileURL(path.resolve(__dirname, apiRoutes['/api/*'])).href);
          await handler.default(req, res);
        } catch (err) {
          console.error('Local API Error:', err);
          res.status(500).json({ error: 'Local API Server Error' });
        }
      })();
    });
    server.middlewares.use(app);
  }
});

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), vercelApiPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});